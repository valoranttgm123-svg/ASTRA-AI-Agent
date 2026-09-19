import { randomUUID, createHash } from "node:crypto";
import type { Approval, BrainRequest } from "./types";
type Pending = { hash: string; expiresAt: number };
const globals = globalThis as typeof globalThis & { astraApprovals?: Map<string, Pending> };
const pending = globals.astraApprovals ??= new Map<string, Pending>();
function fingerprint(request: BrainRequest) {
  const { approvalId: _id, ...bound } = request;
  return createHash("sha256").update(JSON.stringify(bound)).digest("hex");
}
export function requireApproval(request: BrainRequest, label: string, detail: string): Approval | null {
  for (const [id, item] of pending) if (item.expiresAt <= Date.now()) pending.delete(id);
  if (request.approvalId) {
    const item = pending.get(request.approvalId); pending.delete(request.approvalId);
    if (!item || item.expiresAt <= Date.now() || item.hash !== fingerprint(request)) throw new Error("Persetujuan kedaluwarsa, sudah dipakai, atau tugas berubah.");
    return null;
  }
  if (pending.size >= 100) throw new Error("Terlalu banyak permintaan persetujuan.");
  const approval = { id: randomUUID(), label, detail, expiresAt: Date.now() + 300_000 };
  pending.set(approval.id, { hash: fingerprint(request), expiresAt: approval.expiresAt }); return approval;
}
