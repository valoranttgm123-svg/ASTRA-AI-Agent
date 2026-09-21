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
    (!update.observedAt ||
      !update.evidencePath)
  ) {
    throw new Error(
      "PASS requires observedAt and evidencePath.",
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
