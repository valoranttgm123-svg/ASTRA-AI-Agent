/** Explicit read-only target-PC test. Does not run in CI or upload retrieved data. */
import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { getUnifiedMemoryContext } from "../lib/brain/unified-memory";
import { sonorMemorySource } from "../lib/memory/sonor";
import { getProjectRegistry } from "../lib/projects/registry";
import { searchMemorySources } from "../lib/memory/manager";

async function main() {
  loadEnvConfig(process.cwd());
  const registry = await getProjectRegistry();
  assert(registry.available, "Project registry is unavailable");
  const results = [];
  for (const [id, input] of [["astra", "ASTRA roadmap terakhir"], ["alurka", "lanjutkan ALURKA terakhir"]]) {
    const project = registry.projects.find(p => p.id === id);
    assert(project, `Register the exact ${id} project before live validation`);
    const start = performance.now();
    const source = await sonorMemorySource.search({input, project: project.name, limit: 6, maxChars: 4200});
    assert(source.available);
    assert(source.records.length > 0);
    assert(source.records.every(record => record.provenance.project === project.name));
    assert(source.records.every(record => record.tags?.includes(project.memoryNamespace)));
    for (const type of ["project", "obsidian", "graphify"]) assert(source.records.some(record => record.provenance.sourceType === type), `Missing real ${type} provenance`);
    assert(source.records.reduce((sum, record) => sum + record.content.length, 0) <= 4200);
    const unified = await getUnifiedMemoryContext(input, project);
    assert(unified.records.some(record => record.provenance.sourceType === "graphify"));
    assert(unified.records.every(record => !record.provenance.project || record.provenance.project === project.name));
    results.push({project: id, records: source.records.length, sources: [...new Set(source.records.map(r => r.provenance.sourceType))], ms: Math.round(performance.now() - start)});
  }
  const original = process.env.ASTRA_SONOR_URL;
  try {
    // Closed local port simulates genuine connection refusal without stopping the user's portal.
    process.env.ASTRA_SONOR_URL = "http://127.0.0.1:1";
    const local = {id:"fixture-local",type:"local" as const,async search(){return {source:"fixture-local",sourceType:"local" as const,available:true,detail:"Explicit fallback fixture",records:[]};}};
    const unavailable = await searchMemorySources({input:"ASTRA",limit:6,maxChars:2400},[local,sonorMemorySource]);
    assert.equal(unavailable.sources.find(s => s.source === "sonor")?.available, false);
    assert.equal(unavailable.sources[0].available, true);
  } finally { process.env.ASTRA_SONOR_URL = original; }
  await assert.rejects(sonorMemorySource.search({input:"ASTRA",limit:6,maxChars:2400,signal:AbortSignal.abort()}),{name:"AbortError"});
  console.log(JSON.stringify({verified:true,tests:results,outage:"real connection refusal; no production restart",cancellation:"pre-aborted real adapter; in-flight covered by HTTP fixture",privateContentPrinted:false},null,2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
