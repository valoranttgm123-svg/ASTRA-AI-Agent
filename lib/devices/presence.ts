import type { AstraDeviceAdvertisement } from "./contracts";

const MAX_ADVERTISEMENTS = 64;
const MAX_ADVERTISEMENT_TTL_MS = 5 * 60_000;

function cleanDeviceId(value: string) {
  const cleaned = value.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(cleaned)) {
    throw new Error("Device advertisement id is invalid.");
  }
  return cleaned;
}

function cleanCapabilities(values: readonly string[]) {
  if (!Array.isArray(values) || values.length > 32) {
    throw new Error("Device advertisement capabilities are invalid.");
  }
  const result = values.map((value) => {
    const clean = value.trim();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/.test(clean)) {
      throw new Error("Device capability is invalid.");
    }
    return clean;
  });
  return [...new Set(result)];
}

export class AstraDevicePresenceRegistry {
  private readonly advertisements = new Map<
    string,
    AstraDeviceAdvertisement
  >();

  advertise({
    deviceId,
    capabilities,
    ttlMs = 60_000,
    now = new Date(),
  }: {
    deviceId: string;
    capabilities: string[];
    ttlMs?: number;
    now?: Date;
  }) {
    if (!Number.isFinite(now.getTime())) {
      throw new Error("Invalid device advertisement time.");
    }
    if (
      !Number.isFinite(ttlMs) ||
      ttlMs <= 0 ||
      ttlMs > MAX_ADVERTISEMENT_TTL_MS
    ) {
      throw new Error("Device advertisement TTL is invalid.");
    }
    this.prune(now);
    if (
      !this.advertisements.has(deviceId.trim()) &&
      this.advertisements.size >= MAX_ADVERTISEMENTS
    ) {
      throw new Error("Device advertisement limit reached.");
    }

    const cleanId = cleanDeviceId(deviceId);
    const advertisement: AstraDeviceAdvertisement = {
      deviceId: cleanId,
      online: true,
      capabilities: cleanCapabilities(capabilities),
      observedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + Math.floor(ttlMs)).toISOString(),
    };
    this.advertisements.set(cleanId, advertisement);
    return { ...advertisement, capabilities: [...advertisement.capabilities] };
  }

  get(deviceId: string, now = new Date()) {
    this.prune(now);
    const advertisement = this.advertisements.get(deviceId.trim());
    return advertisement
      ? {
          ...advertisement,
          capabilities: [...advertisement.capabilities],
        }
      : undefined;
  }

  list(now = new Date()) {
    this.prune(now);
    return [...this.advertisements.values()].map((advertisement) => ({
      ...advertisement,
      capabilities: [...advertisement.capabilities],
    }));
  }

  remove(deviceId: string) {
    return this.advertisements.delete(deviceId.trim());
  }

  private prune(now = new Date()) {
    if (!Number.isFinite(now.getTime())) {
      throw new Error("Invalid device advertisement prune time.");
    }
    for (const [id, advertisement] of this.advertisements) {
      if (Date.parse(advertisement.expiresAt) <= now.getTime()) {
        this.advertisements.delete(id);
      }
    }
  }
}
