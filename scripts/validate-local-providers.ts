import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { ASTRA_AGENT_MAP } from "../lib/agent/roster";
import { chatWithCodex, getCodexStatus } from "../lib/brain/codex";
import { chatWithHermes, getHermesStatus } from "../lib/brain/hermes";

async function main() {
  loadEnvConfig(process.cwd());
  const policy = {requireApproval:true,allowShell:false,allowFileWrite:false,allowExternalActions:false,allowPaidCloud:false};
  const codex = await getCodexStatus(policy), hermes = await getHermesStatus();
  console.log(JSON.stringify({codex:{available:codex.available,model:codex.model,sandbox:codex.sandbox},hermes:{available:hermes.available,model:hermes.model,detail:hermes.detail}}));
  if(process.argv.includes("--codex")) {
    const start=performance.now();
    const result=await chatWithCodex({input:"Jawab persis ASTRA_CODEX_SIAP. Jangan jalankan alat atau membaca berkas.",agent:ASTRA_AGENT_MAP.developer,policy});
    assert.match(result.message,/ASTRA_CODEX_SIAP/);assert.equal(result.sandbox,"read-only");
    console.log(JSON.stringify({codexResponse:true,model:result.model,ms:Math.round(performance.now()-start)}));
  }
  if(process.argv.includes("--hermes")) {
    const start=performance.now();
    const result=await chatWithHermes({input:"Jawab satu kata: SIAP. Jangan gunakan alat.",agent:ASTRA_AGENT_MAP.chief_of_staff,policyText:"Read-only. No paid APIs or external actions."});
    assert.match(result.message,/SIAP/i);
    console.log(JSON.stringify({hermesResponse:true,model:result.model,ms:Math.round(performance.now()-start)}));
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
