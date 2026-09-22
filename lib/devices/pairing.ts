import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import type { AstraPairingChallengePublic } from "./contracts";

type StoredPairingChallenge = {
  id: string;
  deviceId: string;
  tokenHash: Buffer;
  createdAt: string;
  expiresAt: string;
};

const MAX_PAIRING_CHALLENGES = 32;
const DEFAULT_PAIRING_TTL_MS = 5 * 60_000;
const MAX_PAIRING_TTL_MS = 10 * 60_000;

function tokenHash(token: string) {
  return createHash("sha256").update(token, "utf8").digest();
}

function cleanId(value: string, field: string) {
  const cleaned = value.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(cleaned)) {
    throw new Error("Pairing " + field + " is invalid.");
  }
  return cleaned;
}

function boundedTtl(value?: number) {
  if (value === undefined) return DEFAULT_PAIRING_TTL_MS;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Pairing TTL must be positive.");
  }
  return Math.min(MAX_PAIRING_TTL_MS, Math.floor(value));
}

export class AstraPairingRegistry {
  private readonly challenges = new Map<string, StoredPairingChallenge>();

  create({
    deviceId,
    ttlMs,
    now = new Date(),
  }: {
    deviceId: string;
    ttlMs?: number;
    now?: Date;
  }): AstraPairingChallengePublic {
    if (!Number.isFinite(now.getTime())) {
      throw new Error("Invalid pairing creation time.");
    }
    this.prune(now);
    if (this.challenges.size >= MAX_PAIRING_CHALLENGES) {
      throw new Error("Pairing challenge limit reached.");
    }

    const token = randomBytes(24).toString("base64url");
    const id = randomUUID();
    const challenge: StoredPairingChallenge = {
      id,
      deviceId: cleanId(deviceId, "deviceId"),
      tokenHash: tokenHash(token),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + boundedTtl(ttlMs)).toISOString(),
    };
    this.challenges.set(id, challenge);

    return {
      id,
      deviceId: challenge.deviceId,
      token,
      expiresAt: challenge.expiresAt,
    };
  }

  consume({
    challengeId,
    deviceId,
    token,
    now = new Date(),
  }: {
    challengeId: string;
    deviceId: string;
    token: string;
    now?: Date;
  }) {
    this.prune(now);
    const id = challengeId.trim();
    const stored = this.challenges.get(id);
    if (!stored) return false;

    // Pairing tokens are single-use even when verification fails.
    this.challenges.delete(id);

    if (stored.deviceId !== cleanId(deviceId, "deviceId")) return false;
    if (Date.parse(stored.expiresAt) <= now.getTime()) return false;

    const candidate = tokenHash(token.trim());
    return (
      candidate.length === stored.tokenHash.length &&
      timingSafeEqual(candidate, stored.tokenHash)
    );
  }

  revokeForDevice(deviceId: string) {
    const clean = cleanId(deviceId, "deviceId");
    for (const [id, challenge] of this.challenges) {
      if (challenge.deviceId === clean) this.challenges.delete(id);
    }
  }

  size(now = new Date()) {
    this.prune(now);
    return this.challenges.size;
  }

  private prune(now = new Date()) {
    if (!Number.isFinite(now.getTime())) {
      throw new Error("Invalid pairing prune time.");
    }
    for (const [id, challenge] of this.challenges) {
      if (Date.parse(challenge.expiresAt) <= now.getTime()) {
        this.challenges.delete(id);
      }
    }
  }
}
