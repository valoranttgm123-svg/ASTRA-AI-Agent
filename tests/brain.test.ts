import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { LocalPreferredBrainAdapter } from "../lib/brain/adapter";
import { requireApproval } from "../lib/brain/approvals";
import { getProject, projectFile, safeRelative, redact, listProjectFiles } from "../lib/brain/projects";
import { saveNote, retrieveContext } from "../lib/brain/memory";
import { guardRequest, parseBrainRequest, readJson } from "../lib/brain/http";
import { runProcess } from "../lib/brain/process";
import { readBrainStream } from "../lib/brain/client-stream";
import { graphStates } from "../lib/brain/graph-state";
import { selectAgent } from "../lib/agent/orchestrator";
import type { BrainRequest, AstraBrainEvent, AstraBrainChatResult } from "../lib/brain/types";

let root: string, fixture: Server, base: string;
const brain = new LocalPreferredBrainAdapter();
const request = (extra: Partial<BrainRequest> = {}): BrainRequest => ({ message: "Jelaskan proyek ASTRA", projectId: "test", provider: "auto", ...extra });
let chatCalls = 0;
let chatBodies: Array<Record<string, unknown>> = [];
before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "astra-tests-"));
  await mkdir(path.join(root, "docs"));
  await writeFile(path.join(root, "README.md"), "# ASTRA\nHumanoid and local memory project.");
  await writeFile(path.join(root, "docs", "PLAN.md"), "Engineering roadmap: implement cancellable work and verify tests.");
  await writeFile(path.join(root, ".env"), "SECRET=dummy-fixture-never-index");
  fixture = createServer(async (req,res) => {
    if (req.url === "/api/tags") { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ models: [{ name: "fixture-model:local" }] })); return; }
    if (req.url === "/v1/capabilities") { res.setHeader("content-type", "application/json"); res.end("{}"); return; }
    if (req.url === "/api/chat") {
      chatCalls++;
      const parts = []; for await (const p of req) parts.push(p);
      const input = JSON.parse(Buffer.concat(parts).toString());
      chatBodies.push(input);
      const message = input.messages.find((m: { role: string }) => m.role === "user")?.content;
      res.setHeader("content-type", "application/json");
      if (message === "slow") { const timer = setTimeout(() => res.end(JSON.stringify({ message: { content: "late" } })), 3000); res.on("close", () => clearTimeout(timer)); return; }
      if (message === "failure") { res.statusCode = 503; res.end("private upstream diagnostic"); return; }
      if (message === "use tool" && !input.messages.some((m: { role: string }) => m.role === "tool")) {
        res.end(JSON.stringify({ message: { content: "", tool_calls: [{ function: { name: input.tools[0].function.name, arguments: {} } }] } })); return;
      }
      res.end(JSON.stringify({ message: { content: "Fixture response · bukan inferensi model nyata" } })); return;
    }
    res.statusCode = 404; res.end();
  });
  fixture.listen(0, "127.0.0.1"); await once(fixture, "listening");
  base = "http://127.0.0.1:" + (fixture.address() as { port: number }).port;
});
beforeEach(() => {
  process.env.ASTRA_PROJECTS = JSON.stringify([{ id: "test", name: "Test", root }]);
  process.env.ASTRA_HERMES_ENABLED = "false";
  process.env.ASTRA_HERMES_AGENT_APPROVAL = "false";
  process.env.ASTRA_OLLAMA_ENABLED = "false";
  process.env.ASTRA_CODEX_ENABLED = "false";
  process.env.ASTRA_OLLAMA_URL = base;
  process.env.ASTRA_HERMES_URL = base;
  process.env.ASTRA_MCP_SERVERS = "[]";
  delete process.env.ASTRA_OLLAMA_MODEL;
  delete process.env.ASTRA_OLLAMA_THINKING;
  delete process.env.ASTRA_OLLAMA_MAX_TOKENS;
  chatCalls = 0;
  chatBodies = [];
});
after(async () => {
  fixture.closeAllConnections(); fixture.close();
  // This directory was created by this test, never a user/project directory.
  assert.ok(root.startsWith(path.join(os.tmpdir(), "astra-tests-")));
  await rm(root, { recursive: true, force: true });
});

test("routing requires full words; pr does not match arbitrary phrases", () => {
  assert.equal(selectAgent("saya perlu bantuan"), "chief_of_staff");
  assert.equal(selectAgent("review pull request"), "github");
  assert.equal(selectAgent("cari bug typescript"), "developer");
});
test("provider-free mode is honest and context is bounded", async () => {
  const events: AstraBrainEvent[] = [];
  const result = await brain.chat(request(), { emit: e => events.push(e) });
  assert.equal(result.state, "needs_provider"); assert.equal(result.brain.execution, "routing_only");
  assert.ok(events.some(e => e.type === "memory.retrieved"));
  assert.ok(!events.some(e => e.type === "agent.completed"));
  assert.ok(result.brain.sources?.includes("README.md"));
});
test("read-only tools execute without model or approval", async () => {
  const result = await brain.chat(request({ tool: { name: "project.read_file", arguments: { path: "README.md" } } }));
  assert.equal(result.state, "completed"); assert.match(result.message, /ASTRA/);
  assert.deepEqual(result.brain.events.filter(e => e.type.startsWith("tool.")).map(e => e.type), ["tool.started", "tool.completed"]);
});
test("traversal, secret files, absolute paths and ADS are denied", async () => {
  const project = await getProject("test");
  for (const file of ["../README.md", ".env", "docs/../../README.md", "C:/Windows/win.ini", "README.md:stream", "auth.json", ".git/config", ".codex/config.toml"]) {
    assert.equal(safeRelative(file), false, file); await assert.rejects(projectFile(project,file));
  }
  assert.ok(!(await listProjectFiles(project)).includes(".env"));
  assert.ok(!(await listProjectFiles(project)).some(file => file.startsWith(".playwright-cli/")));
});
test("symlink/junction escape is denied", async () => {
  const outside = await mkdtemp(path.join(os.tmpdir(), "astra-outside-"));
  try {
    await writeFile(path.join(outside,"hidden.md"), "outside");
    await symlink(outside, path.join(root,"escape"), process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(projectFile(await getProject("test"), "escape/hidden.md"));
  } finally { await rm(path.join(root,"escape"), { force: true }); await rm(outside, { recursive: true, force: true }); }
});
test("memory write requires one-time approval bound to exact task", async () => {
  const input = request({ tool: { name: "memory.save", arguments: { text: "Test decision: use bounded context." } } });
  const blocked = await brain.chat(input);
  assert.equal(blocked.requiresApproval, true); assert.equal(blocked.brain.execution, "blocked");
  await assert.rejects(readFile(path.join(root,".astra/memory/notes.jsonl")));
  const approved = { ...input, approvalId: blocked.brain.approval!.id };
  const result = await brain.chat(approved); assert.equal(result.state, "completed");
  assert.equal((await brain.chat(approved)).state, "error");
  const context = await retrieveContext(await getProject("test"), "bounded context", undefined, 6000);
  assert.ok(context.text.length <= 6000); assert.match(context.text, /Test decision/);
});
test("approval cannot authorize a changed task", () => {
  const input = request(); const approval = requireApproval(input,"test","test")!;
  assert.throws(() => requireApproval({ ...input, message: "changed", approvalId: approval.id },"test","test"));
});
test("memory refuses obvious credentials", async () => {
  await assert.rejects(saveNote(await getProject("test"), "api_key=fixture-secret"));
  assert.equal(redact("password=abc"), "password=[REDACTED]");
});
test("unknown tools cannot execute", async () => {
  const result = await brain.chat(request({ tool: { name: "shell.run", arguments: { command: "anything" } } }));
  assert.equal(result.state,"error"); assert.ok(!result.brain.events.some(e => e.type === "tool.started"));
});
test("Ollama selected model and real lifecycle events", async () => {
  process.env.ASTRA_OLLAMA_ENABLED = "true";
  const events: AstraBrainEvent[] = [];
  const promise = brain.chat(request({ provider:"ollama", model:"fixture-model:local" }), { emit:e => events.push(e) });
  const result = await promise;
  assert.equal(result.state,"completed"); assert.equal(result.brain.model,"fixture-model:local");
  assert.equal(chatCalls,1);
  assert.ok(events.findIndex(e => e.type === "agent.started") < events.findIndex(e => e.type === "agent.completed"));
});
test("Ollama fast chat skips project context and unnecessary tools", async () => {
  process.env.ASTRA_OLLAMA_ENABLED = "true";
  const result = await brain.chat(request({ message:"Halo ASTRA", provider:"ollama", model:"fixture-model:local" }));
  assert.equal(result.state,"completed");
  assert.equal(result.brain.sources?.length,0);
  assert.equal(chatBodies[0].think,false);
  assert.deepEqual(chatBodies[0].options,{ num_predict:1024 });
  assert.equal("tools" in chatBodies[0],false);
});
test("explicit missing model does not silently switch", async () => {
  process.env.ASTRA_OLLAMA_ENABLED="true";
  const result = await brain.chat(request({ provider:"ollama", model:"missing" }));
  assert.equal(result.state,"error"); assert.equal(chatCalls,0);
});
test("Ollama calls allowlisted read-only tools with actual events", async () => {
  process.env.ASTRA_OLLAMA_ENABLED="true";
  const result = await brain.chat(request({ message:"use tool",provider:"ollama" }));
  assert.equal(result.state,"completed"); assert.equal(chatCalls,2);
  assert.ok(result.brain.events.some(e => e.type === "tool.completed"));
});
test("provider errors never become success or leak raw diagnostics", async () => {
  process.env.ASTRA_OLLAMA_ENABLED="true";
  const result = await brain.chat(request({ message:"failure",provider:"ollama" }));
  assert.equal(result.state,"error"); assert.doesNotMatch(result.message,/private upstream/);
  assert.ok(!result.brain.events.some(e => e.type === "agent.completed"));
});
test("cancel reaches upstream before late model response", async () => {
  process.env.ASTRA_OLLAMA_ENABLED="true";
  const controller = new AbortController(), events: AstraBrainEvent[] = [];
  const promise = brain.chat(request({ message:"slow",provider:"ollama" }), { signal:controller.signal, emit:e => { events.push(e); if(e.type === "agent.started") setTimeout(() => controller.abort(),50); } });
  await assert.rejects(promise, { name:"AbortError" });
  assert.ok(events.some(e => e.type === "request.cancelled"));
  assert.ok(!events.some(e => e.type === "agent.completed"));
});
test("Hermes is gated even when reachable", async () => {
  process.env.ASTRA_HERMES_ENABLED="true";
  assert.equal((await brain.chat(request({provider:"hermes"}))).brain.execution,"blocked");
  process.env.ASTRA_HERMES_AGENT_APPROVAL="true";
  assert.equal((await brain.chat(request({provider:"hermes"}))).requiresApproval,true);
});
test("Codex stays disabled unless configured; never paid fallback", async () => {
  const result=await brain.chat(request({provider:"codex"}));
  assert.equal(result.brain.provider,"codex"); assert.equal(result.brain.execution,"blocked");
  assert.equal(chatCalls,0);
});
test("HTTP guards reject cross-site, remote host, simple POST", () => {
  assert.throws(() => guardRequest(new Request("http://evil.example/api/agent")));
  assert.throws(() => guardRequest(new Request("http://localhost:3000/api/agent",{headers:{origin:"https://evil.example"}})));
  assert.throws(() => guardRequest(new Request("http://localhost:3000/api/agent"),true));
  guardRequest(new Request("http://localhost:3000/api/agent",{headers:{origin:"http://localhost:3000","content-type":"application/json","x-astra-client":"1"}}),true);
});
test("input types, sizes and malformed JSON are validated", async () => {
  for(const data of [{message:42},{message:"x",provider:"cloud"},{message:"x",tool:{name:"x",arguments:[]}},{message:"x".repeat(4001)}]) assert.throws(() => parseBrainRequest(data));
  await assert.rejects(readJson(new Request("http://localhost",{method:"POST",body:"{"})));
  await assert.rejects(readJson(new Request("http://localhost",{method:"POST",body:JSON.stringify({message:"x".repeat(17000)})})));
});
test("process timeout/cancellation kills owned child, no hanging result", async () => {
  const controller = new AbortController();
  const work = runProcess(process.execPath,["-e","setInterval(()=>{},1000)"],{cwd:root,signal:controller.signal});
  setTimeout(()=>controller.abort(),100);
  await assert.rejects(work,{name:"AbortError"});
});
test("stream decoding handles split UTF-8 and requires a final result", async () => {
  const event: AstraBrainEvent={id:randomUUID(),requestId:randomUUID(),type:"agent.started",at:Date.now(),label:"Uji suara ✓"};
  const result={message:"Selesai ✓"} as AstraBrainChatResult;
  const bytes=new TextEncoder().encode(JSON.stringify({type:"event",event})+"\n"+JSON.stringify({type:"result",result})+"\n");
  const stream=new ReadableStream({start(c){for(let i=0;i<bytes.length;i++)c.enqueue(bytes.slice(i,i+1));c.close();}});
  const events:AstraBrainEvent[]=[]; assert.equal((await readBrainStream(new Response(stream),e=>events.push(e))).message,result.message);
  assert.equal(events[0].label,event.label);
  await assert.rejects(readBrainStream(new Response(""),()=>{}));
});
test("graph activity is task-scoped and stops on cancel", () => {
  const id=randomUUID(), base={id:randomUUID(),requestId:id,at:Date.now(),label:"test",visualNode:"engineering"};
  const events:AstraBrainEvent[]=[{...base,type:"agent.started"}];
  assert.equal(graphStates(events,null).engineering,"running");
  events.push({...base,id:randomUUID(),type:"request.cancelled"});
  assert.equal(graphStates(events,null).engineering,"ready");
  assert.equal(graphStates([],null).engineering,undefined);
});
