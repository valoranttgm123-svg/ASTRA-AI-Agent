import type { ManualGateId } from "./core-report";

export type ManualObservationGateId = Exclude<
  ManualGateId,
  "browser-humanoid-performance"
>;

export type ManualObservationCheckStatus =
  | "PASS"
  | "FAIL";

export type ManualGateObservation = {
  schemaVersion: 1;
  kind: "astra-manual-gate-observation";
  gate: ManualObservationGateId;
  observedAt: string;
  commit: string;
  workingTreeClean: true;
  releaseVerdict: "NOT_EVALUATED";
  checks: Array<{
    id: string;
    status: ManualObservationCheckStatus;
  }>;
};

export const REQUIRED_MANUAL_OBSERVATION_CHECKS: Record<
  ManualObservationGateId,
  readonly string[]
> = {
  "automation-approval-stop": [
    "level2_waits_for_approval",
    "level3_exact_scope_single_use",
    "unattended_level2_3_blocked",
    "stop_during_owned_occurrence",
    "no_late_success_after_stop",
  ],
  "sonor-graph-memory": [
    "real_sonor_source_reachable",
    "graphify_provenance_visible",
    "obsidian_provenance_visible",
    "cancellation_safe",
    "offline_degrades_truthfully",
  ],
  "full-system-approved-actions": [
    "project_continuation_real",
    "engineering_approved_write_real",
    "alurka_project_isolation_real",
    "communication_integration_truthful",
    "permission_denial_blocks_execution",
    "failure_variants_reviewed",
  ],
  "emergency-stop": [
    "operation_active_before_stop",
    "stop_abort_observed",
    "no_late_success",
    "no_auto_retry",
    "runtime_ui_settled_truthfully",
  ],
  "windows-install-update-reinstall": [
    "install_passed",
    "startup_logon_passed",
    "update_ff_only_passed",
    "reinstall_passed",
    "loopback_only_passed",
    "env_local_preserved",
    "private_runtime_preserved",
  ],
};

export function isManualObservationGateId(
  value: string,
): value is ManualObservationGateId {
  return value in REQUIRED_MANUAL_OBSERVATION_CHECKS;
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isGitCommit(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{40}$/i.test(value)
  );
}

export function validateManualGateObservation(
  value: unknown,
  expectedGate: ManualObservationGateId,
  expectedCommit: string,
  options: {
    requireAllPass?: boolean;
  } = {},
) {
  if (!isRecord(value)) {
    throw new Error(
      "Manual gate observation must be a JSON object.",
    );
  }

  if (
    value.schemaVersion !== 1 ||
    value.kind !==
      "astra-manual-gate-observation" ||
    value.gate !== expectedGate ||
    value.workingTreeClean !== true ||
    value.releaseVerdict !== "NOT_EVALUATED" ||
    typeof value.observedAt !== "string" ||
    Number.isNaN(Date.parse(value.observedAt)) ||
    !isGitCommit(value.commit) ||
    value.commit.toLowerCase() !==
      expectedCommit.toLowerCase() ||
    !Array.isArray(value.checks)
  ) {
    throw new Error(
      "Manual gate observation provenance or schema is invalid.",
    );
  }

  const required =
    REQUIRED_MANUAL_OBSERVATION_CHECKS[
      expectedGate
    ];
  const seen = new Set<string>();

  for (const check of value.checks) {
    if (
      !isRecord(check) ||
      typeof check.id !== "string" ||
      (
        check.status !== "PASS" &&
        check.status !== "FAIL"
      )
    ) {
      throw new Error(
        "Manual gate observation contains an invalid check.",
      );
    }
    if (seen.has(check.id)) {
      throw new Error(
        `Manual gate observation contains duplicate check: ${check.id}`,
      );
    }
    seen.add(check.id);
  }

  if (
    value.checks.length !== required.length ||
    !required.every((id) => seen.has(id))
  ) {
    throw new Error(
      `Manual gate observation for ${expectedGate} must contain exactly the required checks.`,
    );
  }

  const failed = value.checks.filter(
    (check) =>
      isRecord(check) &&
      check.status !== "PASS",
  );

  if (
    options.requireAllPass !== false &&
    failed.length > 0
  ) {
    throw new Error(
      `Manual gate observation for ${expectedGate} is not all PASS.`,
    );
  }

  return value as ManualGateObservation;
}
