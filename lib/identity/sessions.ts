import { randomUUID } from "node:crypto";

import type {
  AstraIdentityScope,
  AstraIdentitySession,
  AstraSessionUnlockEvidence,
  AstraTrustRole,
} from "./contracts";

const MAX_SESSIONS = 32;
const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60_000;
const MAX_SESSION_TTL_MS = 24 * 60 * 60_000;

function iso(value: string, field: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Identity " + field + " must be a timestamp.");
  }
  return new Date(parsed).toISOString();
}

function cleanId(value: string, field: string, max = 120) {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) {
    throw new Error(
      "Identity " + field + " must contain 1-" + max + " characters.",
    );
  }
  return cleaned;
}

function boundedTtl(value?: number) {
  if (value === undefined) return DEFAULT_SESSION_TTL_MS;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Identity session TTL must be positive.");
  }
  return Math.min(MAX_SESSION_TTL_MS, Math.floor(value));
}

export class AstraIdentitySessionRegistry {
  private readonly sessions = new Map<string, AstraIdentitySession>();

  create({
    principalId,
    role,
    deviceId,
    scopes,
    ttlMs,
    now = new Date(),
  }: {
    principalId: string;
    role: AstraTrustRole;
    deviceId?: string;
    scopes: AstraIdentityScope[];
    ttlMs?: number;
    now?: Date;
  }) {
    if (!Number.isFinite(now.getTime())) {
      throw new Error("Invalid identity session creation time.");
    }
    this.prune(now);
    if (this.sessions.size >= MAX_SESSIONS) {
      throw new Error("Identity session limit reached.");
    }

    const id = randomUUID();
    const createdAt = now.toISOString();
    const session: AstraIdentitySession = {
      id,
      principalId: cleanId(principalId, "principalId"),
      role,
      ...(deviceId?.trim()
        ? { deviceId: cleanId(deviceId, "deviceId") }
        : {}),
      state: "locked",
      scopes: [...new Set(scopes)],
      createdAt,
      expiresAt: new Date(now.getTime() + boundedTtl(ttlMs)).toISOString(),
      lastActivityAt: createdAt,
    };
    this.sessions.set(id, session);
    return { ...session, scopes: [...session.scopes] };
  }

  get(id: string, now = new Date()) {
    this.prune(now);
    const session = this.sessions.get(id.trim());
    return session
      ? { ...session, scopes: [...session.scopes] }
      : undefined;
  }

  unlock({
    sessionId,
    evidence,
    now = new Date(),
  }: {
    sessionId: string;
    evidence: AstraSessionUnlockEvidence;
    now?: Date;
  }) {
    this.prune(now);
    const id = sessionId.trim();
    const current = this.sessions.get(id);
    if (!current) throw new Error("Identity session was not found.");

    const verifiedAt = iso(evidence.verifiedAt, "unlockEvidence.verifiedAt");
    if (Date.parse(verifiedAt) > now.getTime() + 60_000) {
      throw new Error("Identity unlock evidence is too far in the future.");
    }
    const detail = cleanId(evidence.detail, "unlockEvidence.detail", 500);
    const unlocked: AstraIdentitySession = {
      ...current,
      state: "unlocked",
      lastActivityAt: now.toISOString(),
      unlockedAt: now.toISOString(),
      unlockEvidence: {
        method: evidence.method,
        verifiedAt,
        detail,
      },
    };
    this.sessions.set(id, unlocked);
    return { ...unlocked, scopes: [...unlocked.scopes] };
  }

  lock(sessionId: string, now = new Date()) {
    this.prune(now);
    const id = sessionId.trim();
    const current = this.sessions.get(id);
    if (!current) throw new Error("Identity session was not found.");

    const locked: AstraIdentitySession = {
      ...current,
      state: "locked",
      lastActivityAt: now.toISOString(),
      unlockedAt: undefined,
      unlockEvidence: undefined,
    };
    this.sessions.set(id, locked);
    return { ...locked, scopes: [...locked.scopes] };
  }

  revoke(sessionId: string) {
    return this.sessions.delete(sessionId.trim());
  }

  list(now = new Date()) {
    this.prune(now);
    return [...this.sessions.values()].map((session) => ({
      ...session,
      scopes: [...session.scopes],
    }));
  }

  private prune(now = new Date()) {
    if (!Number.isFinite(now.getTime())) {
      throw new Error("Invalid identity session prune time.");
    }
    for (const [id, session] of this.sessions) {
      if (Date.parse(session.expiresAt) <= now.getTime()) {
        this.sessions.delete(id);
      }
    }
  }
}
