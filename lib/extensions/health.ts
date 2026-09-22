import { safePublicDetail } from "@/lib/security/redaction";
import type {
  AstraExtensionHealthObservation,
  AstraExtensionHealthState,
  AstraExtensionSkillManifest,
} from "./contracts";

function healthState(value: AstraExtensionHealthState) {
  if (
    value === "healthy" ||
    value === "degraded" ||
    value === "unavailable" ||
    value === "not_configured" ||
    value === "unknown"
  ) {
    return value;
  }
  throw new Error("Extension health state is invalid.");
}

export function normalizeExtensionHealthObservation({
  skill,
  state,
  checkedAt,
  detail,
}: {
  skill: AstraExtensionSkillManifest;
  state: AstraExtensionHealthState;
  checkedAt: string;
  detail: string;
}): AstraExtensionHealthObservation {
  const parsed = Date.parse(checkedAt);
  if (!Number.isFinite(parsed)) {
    throw new Error("Extension health timestamp is invalid.");
  }

  let normalizedState = healthState(state);
  let normalizedDetail = safePublicDetail(
    detail,
    "Extension health was observed.",
    800,
  );

  if (
    skill.installState === "available" ||
    skill.installState === "disabled"
  ) {
    normalizedState = "not_configured";
    normalizedDetail =
      "Skill is not active; health cannot be reported as operational.";
  } else if (skill.installState === "incompatible") {
    normalizedState = "unavailable";
    normalizedDetail =
      "Skill is marked incompatible and cannot be operational.";
  } else if (skill.verification === "none" && normalizedState === "healthy") {
    normalizedState = "unknown";
    normalizedDetail =
      "Skill has no verification method; healthy status cannot be claimed.";
  }

  return {
    skillId: skill.id,
    state: normalizedState,
    checkedAt: new Date(parsed).toISOString(),
    detail: normalizedDetail,
  };
}
