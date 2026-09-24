import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { probeWebGL2 } from "../lib/performance/webgl-availability";

test("WebGL probe fails closed for denied, throwing or lost contexts", () => {
  assert.equal(probeWebGL2(() => ({getContext: () => null}) as unknown as HTMLCanvasElement), false);
  assert.equal(probeWebGL2(() => { throw new Error("blocked"); }), false);
  assert.equal(probeWebGL2(() => ({getContext: () => ({isContextLost: () => true, getExtension: () => null})}) as unknown as HTMLCanvasElement), false);
});

test("WebGL probe uses WebGL2 and releases the temporary context", () => {
  let calls = 0; let released = 0;
  const canvas = {getContext: (type: string) => {
    calls++; assert.equal(type, "webgl2");
    return {isContextLost: () => false, getExtension: (name: string) => {
      assert.equal(name, "WEBGL_lose_context");return {loseContext: () => {released++;}};
    }};
  }};
  assert.equal(probeWebGL2(() => canvas as unknown as HTMLCanvasElement), true);
  assert.equal(calls, 1);assert.equal(released, 1);
});

test("GPU denial preserves the approved artwork and cannot create fake performance evidence", () => {
  const lab=readFileSync("components/lab/HumanoidLabV9.tsx", "utf8");
  assert.match(lab, /showReferenceOnly = view === "reference" \|\| !effects \|\| !rendererAvailable/);
  assert.match(lab, /showParticles = view !== "reference" && effects && rendererAvailable/);
  assert.equal((lab.match(/!rendererAvailable \|\| !gpuInfo/g) ?? []).length, 6);
  assert.match(lab, /\/assets\/astra-humanoid\/astra-idle-v1\.webp/);
  const core=readFileSync("components/ApexCore3D.jsx", "utf8");
  assert.match(core, /webgl === 'available' && <OrbBoundary>/);
  assert.match(core, /data-webgl-fallback/);
  const hook=readFileSync("components/useWebGLAvailability.ts", "utf8");
  assert.match(hook, /}, \[\]\)/);
  assert.doesNotMatch(hook, /setTimeout|setInterval|requestAnimationFrame/);
});
