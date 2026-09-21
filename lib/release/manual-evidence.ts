import {
  REQUIRED_MANUAL_GATE_IDS,
  type ManualGateId,
  type ManualGateStatus,
  type ManualReleaseEvidence,
  validateManualReleaseEvidence,
} from "./core-report";

export type ManualGateUpdate = {
  gate: ManualGateId;
  status: ManualGateStatus;
  observedAt?: string;
  evidencePath?: string;
  evidenceSha256?: string;
  evidenceBytes?: number;
  commit?: string;
  note?: string;
};

export function isManualGateId(
  value: string,
): value is ManualGateId {
  return (
    REQUIRED_MANUAL_GATE_IDS as readonly string[]
  ).includes(value);
}

export function upsertManualGate(
  current: ManualReleaseEvidence | null,
  update: ManualGateUpdate,
): ManualReleaseEvidence {
  if (!isManualGateId(update.gate)) {
    throw new Error(
      `Unknown manual release gate: ${update.gate}`,
    );
  }

  if (
    update.status === "PASS" &&
    (
      !update.observedAt ||
      !update.evidencePath ||
      !update.evidenceSha256 ||
      update.evidenceBytes === undefined ||
      !update.commit
    )
  ) {
    throw new Error(
      "PASS requires observedAt, evidencePath, evidenceSha256, evidenceBytes, and commit.",
    );
  }

  const base: ManualReleaseEvidence =
    current ?? {
      schemaVersion: 1,
      gates: [],
      connected: [],
      requiresUserLogin: [],
      notImplemented: [],
      externalConfigurationRequired: true,
    };

  validateManualReleaseEvidence(base);

  const next: ManualReleaseEvidence = {
    ...base,
    gates: [
      ...base.gates.filter(
        (gate) => gate.id !== update.gate,
      ),
      {
        id: update.gate,
        status: update.status,
        ...(update.observedAt
          ? { observedAt: update.observedAt }
          : {}),
        ...(update.evidencePath
          ? { evidencePath: update.evidencePath }
          : {}),
        ...(update.evidenceSha256
          ? {
              evidenceSha256:
                update.evidenceSha256,
            }
          : {}),
        ...(update.evidenceBytes !== undefined
          ? {
              evidenceBytes:
                update.evidenceBytes,
            }
          : {}),
        ...(update.commit
          ? { commit: update.commit }
          : {}),
        ...(update.note
          ? { note: update.note.slice(0, 1000) }
          : {}),
      },
    ].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
  };

  validateManualReleaseEvidence(next);
  return next;
}
