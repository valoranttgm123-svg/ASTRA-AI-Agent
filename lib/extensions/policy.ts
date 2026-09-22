import type {
  AstraEnvironmentActionPlan,
  AstraEnvironmentDevice,
  AstraExtensionMutationAction,
  AstraExtensionMutationPlan,
  AstraExtensionSkillManifest,
} from "./contracts";

export function planExtensionMutation({
  skill,
  action,
}: {
  skill: AstraExtensionSkillManifest;
  action: AstraExtensionMutationAction;
}): AstraExtensionMutationPlan {
  const base = {
    skillId: skill.id,
    action,
    currentState: skill.installState,
    requiredPermissionLevel: 2 as const,
    executionAuthority: false as const,
  };

  switch (action) {
    case "install":
      if (skill.installState === "installed") {
        return { ...base, allowed: false, detail: "Skill is already installed." };
      }
      if (skill.installState === "incompatible") {
        return {
          ...base,
          allowed: false,
          detail:
            "Skill is incompatible and cannot be installed until compatibility is resolved.",
        };
      }
      if (skill.trust === "unreviewed") {
        return {
          ...base,
          allowed: false,
          detail:
            "Unreviewed third-party/local skill cannot be installed automatically. Review provenance, permissions, network and secret requirements first.",
        };
      }
      return {
        ...base,
        allowed: true,
        targetState: "installed",
        detail:
          "Dry-run governance plan only. Installation requires a verified provider-specific mechanism and ASTRA local mutation approval.",
      };
    case "update":
      return skill.installState === "installed" ||
        skill.installState === "disabled"
        ? {
            ...base,
            allowed: skill.trust !== "unreviewed",
            targetState: skill.installState,
            detail:
              skill.trust === "unreviewed"
                ? "Unreviewed skill cannot be updated automatically."
                : "Dry-run update plan; provider-specific updater and verification remain required.",
          }
        : {
            ...base,
            allowed: false,
            detail: "Only installed/disabled skills can be updated.",
          };
    case "enable":
      return skill.installState === "disabled"
        ? {
            ...base,
            allowed: skill.trust !== "unreviewed",
            targetState: "installed",
            detail:
              skill.trust === "unreviewed"
                ? "Unreviewed skill cannot be enabled."
                : "Dry-run enable plan; this does not grant tool execution authority.",
          }
        : {
            ...base,
            allowed: false,
            detail: "Only a disabled skill can be enabled.",
          };
    case "disable":
      return skill.installState === "installed"
        ? {
            ...base,
            allowed: true,
            targetState: "disabled",
            detail: "Dry-run disable plan.",
          }
        : {
            ...base,
            allowed: false,
            detail: "Only an installed skill can be disabled.",
          };
    case "remove":
      return skill.installState === "installed" ||
        skill.installState === "disabled"
        ? {
            ...base,
            allowed: true,
            targetState: "available",
            detail:
              "Dry-run remove plan; provider-specific uninstall and verification remain required.",
          }
        : {
            ...base,
            allowed: false,
            detail: "Only installed/disabled skills can be removed.",
          };
    case "rollback":
      if (!skill.rollback.supported) {
        return {
          ...base,
          allowed: false,
          detail: "Skill does not declare rollback support.",
        };
      }
      if (
        skill.installState !== "installed" &&
        skill.installState !== "disabled"
      ) {
        return {
          ...base,
          allowed: false,
          detail: "Only installed/disabled skills can be rolled back.",
        };
      }
      return {
        ...base,
        allowed: skill.trust !== "unreviewed",
        targetState: skill.installState,
        detail:
          skill.trust === "unreviewed"
            ? "Unreviewed skill cannot be rolled back automatically."
            : "Dry-run rollback plan; exact provider rollback mechanism and post-rollback verification are required.",
      };
  }
}

export function planEnvironmentCapability({
  device,
  capabilityId,
}: {
  device: AstraEnvironmentDevice;
  capabilityId: string;
}): AstraEnvironmentActionPlan {
  const id = capabilityId.trim();
  const capability = device.capabilities.find(
    (candidate) => candidate.id === id,
  );

  if (!capability) {
    return {
      deviceId: device.id,
      capabilityId: id,
      access: "read",
      allowed: false,
      requiredPermissionLevel: 1,
      requiresApproval: false,
      executionAuthority: false,
      detail: "Requested capability is not registered for this device.",
    };
  }

  const base = {
    deviceId: device.id,
    capabilityId: capability.id,
    access: capability.access,
    requiredPermissionLevel: capability.permissionLevel,
    requiresApproval: capability.permissionLevel >= 2,
    executionAuthority: false as const,
    ...(capability.toolId ? { toolId: capability.toolId } : {}),
  };

  if (device.state !== "registered") {
    return {
      ...base,
      allowed: false,
      detail:
        "Environment device is disabled/revoked and cannot be used.",
    };
  }

  if (!capability.toolId) {
    return {
      ...base,
      allowed: false,
      detail:
        "Capability is registered as metadata only; no Tool Runtime mapping is configured.",
    };
  }

  return {
    ...base,
    allowed: true,
    detail:
      capability.access === "write"
        ? "Capability is registered, but execution still requires Tool Runtime permission/approval and verified completion."
        : "Read capability is registered; Tool Runtime remains the execution and verification authority.",
  };
}
