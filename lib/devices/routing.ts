import type {
  AstraDeviceAdvertisement,
  AstraDeviceNode,
  AstraDeviceRouteCandidate,
  AstraDeviceRoutePlan,
  AstraDeviceRouteRequest,
  AstraDeviceTransport,
} from "./contracts";

const TRANSPORT_ORDER: Record<AstraDeviceTransport, number> = {
  local: 0,
  lan: 1,
  ssh: 2,
  relay: 3,
};

function cleanCapability(value: string) {
  const capability = value.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/.test(capability)) {
    throw new Error("Device routing capability is invalid.");
  }
  return capability;
}

export function planDeviceRoute({
  request,
  devices,
  advertisements,
  trustedDeviceIds,
  now = new Date(),
}: {
  request: AstraDeviceRouteRequest;
  devices: readonly AstraDeviceNode[];
  advertisements: readonly AstraDeviceAdvertisement[];
  trustedDeviceIds: ReadonlySet<string>;
  now?: Date;
}): AstraDeviceRoutePlan {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid device route planning time.");
  }

  const capability = cleanCapability(request.capability);
  const advertisementByDevice = new Map(
    advertisements.map((advertisement) => [
      advertisement.deviceId.toLowerCase(),
      advertisement,
    ]),
  );

  const candidates: AstraDeviceRouteCandidate[] = [];

  for (const device of devices) {
    if (device.state !== "paired") continue;
    if (!trustedDeviceIds.has(device.trustedDeviceId.toLowerCase())) continue;
    if (device.maxPermissionLevel < request.requiredPermissionLevel) continue;
    if (!device.capabilities.includes(capability)) continue;

    const advertisement = advertisementByDevice.get(device.id.toLowerCase());
    if (!advertisement?.online) continue;
    if (Date.parse(advertisement.expiresAt) <= now.getTime()) continue;
    if (!advertisement.capabilities.includes(capability)) continue;

    candidates.push({
      deviceId: device.id,
      label: device.label,
      transport: device.transport,
      capability,
      permissionCeiling: device.maxPermissionLevel,
      requiresApproval: request.requiredPermissionLevel >= 2,
      detail:
        request.requiredPermissionLevel >= 2
          ? "Route candidate is trusted and online, but ASTRA approval remains required for this task."
          : "Route candidate is trusted, online, capability-matched, and within its permission ceiling.",
    });
  }

  candidates.sort(
    (left, right) =>
      TRANSPORT_ORDER[left.transport] -
        TRANSPORT_ORDER[right.transport] ||
      left.deviceId.localeCompare(right.deviceId),
  );

  return {
    selected: candidates[0],
    candidates,
    detail:
      candidates.length > 0
        ? "Selected the highest-priority eligible device. This route does not bypass task/tool approval."
        : "No trusted, paired, online device satisfies the requested capability and permission ceiling.",
  };
}
