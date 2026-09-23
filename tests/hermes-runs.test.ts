import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { chatWithHermesRun, verifyHermesRunProfile } from "../lib/brain/hermes-runs";

test("official Hermes runs validate read-only profile, final state and real server STOP", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(),"astra-hermes-runs-"));
  const previous = {...process.env};
  const bridge = path.join(root,"read-only-bridge.mjs");
  const profilePath = path.join(root,"config.json");
  const profile = {platform_toolsets:{api_server:["mcp-sonor"]},mcp_servers:{sonor:{command:process.execPath,args:[bridge],sampling:{enabled:false}}}};
  await writeFile(profilePath,JSON.stringify(profile));
  Object.assign(process.env,{ASTRA_HERMES_PROFILE:profilePath,ASTRA_HERMES_SONOR_MCP_SCRIPT:bridge,ASTRA_HERMES_READONLY_REVIEWED:"true"});
  let mode = "complete", stopped = 0, calls = 0;
  let streaming: (()=>void) | undefined;
  const server = http.createServer((req,res)=>{
    calls++;
    assert.equal(req.headers.authorization,"Bearer fixture-key");
    res.setHeader("content-type","application/json");
    if(req.url==="/v1/capabilities") res.end(JSON.stringify({platform:"hermes-agent",features:{run_status:true,run_stop:true}}));
    else if(req.url==="/v1/toolsets") res.end(JSON.stringify({data:[]}));
    else if(req.url==="/v1/runs") res.end(JSON.stringify({run_id:"run_fixture"}));
    else if(req.url?.endsWith("/events")) {
      res.setHeader("content-type","text/event-stream");res.flushHeaders();
      if(mode==="hang") {streaming?.();return;}
      res.end("event: run.completed\ndata: {}\n\n");
    } else if(req.url?.endsWith("/stop")) {stopped++;res.end(JSON.stringify({status:"cancelled"}));}
    else res.end(JSON.stringify({status:mode==="malformed"?"failed":"completed",output:"fixture response",runtime:{model:"fixture-local"}}));
  });
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const config={rootUrl:`http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}`,apiKey:"fixture-key",chatTimeoutMs:2000,model:"fixture"};
  try {
    assert.equal((await chatWithHermesRun(config,"hello","read-only fixture")).message,"fixture response");
    assert.equal(stopped,0);
    mode="malformed";
    await assert.rejects(chatWithHermesRun(config,"hello","fixture"),/did not complete/);
    mode="hang";
    const controller=new AbortController();
    const incoming=new Promise<void>(resolve=>{streaming=resolve;});
    const pending=chatWithHermesRun(config,"hello","fixture",controller.signal);
    const rejection=assert.rejects(pending,{name:"AbortError"});
    await incoming;controller.abort();await rejection;
    assert.equal(stopped,1,"Closing the HTTP stream alone must not leave the Hermes run alive");
    const before=calls;
    profile.platform_toolsets.api_server.push("terminal");await writeFile(profilePath,JSON.stringify(profile));
    await assert.rejects(verifyHermesRunProfile(config,AbortSignal.timeout(1000)),/not the reviewed/);
    assert.equal(calls,before,"Unsafe profile must fail before network execution");
  } finally {
    for(const key of Object.keys(process.env)) if(!(key in previous)) delete process.env[key];
    Object.assign(process.env,previous);
    server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
    await rm(root,{recursive:true,force:true});
  }
});
