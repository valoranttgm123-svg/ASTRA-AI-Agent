import type {
  ManualReleaseEvidence,
} from "./core-report";
import {
  validateManualReleaseEvidence,
} from "./core-report";
import { safePublicDetail } from "../security/redaction";

export type ReleaseContextUpdate = {
  recordedAt: string;
  commit: string;
  connected?: string[];
  requiresUserLogin?: string[];
  notImplemented?: string[];
  externalConfigurationRequired?: boolean;
};

function normalizeLabels(
  values: readonly string[] | undefined,
) {
  if (values === undefined) return undefined;

  const normalized = [
    ...new Set(
      values
        .map((value) =>
          safePublicDetail(
            value.trim(),
            "",
            160,
          ),
        )
        .filter(Boolean),
    ),
  ];

  if (normalized.length > 50) {
    throw new Error(
      "Release context list is too large.",
    );
  }

  return normalized;
}

export function updateReleaseContext(
  current: ManualReleaseEvidence | null,
  update: ReleaseContextUpdate,
): ManualReleaseEvidence {
  const base: ManualReleaseEvidence =
    current ?? {
      schemaVersion: 1,
      gates: [],
    };

  validateManualReleaseEvidence(base);

  if (
    Number.isNaN(Date.parse(update.recordedAt))
  ) {
    throw new Error(
      "Release context recordedAt must be a valid timestamp.",
    );
  }
  if (!/^[0-9a-f]{40}$/i.test(update.commit)) {
    throw new Error(
      "Release context commit must be a full Git commit.",
    );
  }

  const connected =
    normalizeLabels(update.connected);
  const requiresUserLogin =
    normalizeLabels(
      update.requiresUserLogin,
    );
  const notImplemented =
    normalizeLabels(
      update.notImplemented,
    );

  const next: ManualReleaseEvidence = {
    ...base,
    contextRecordedAt: update.recordedAt,
    contextCommit: update.commit.toLowerCase(),
    connected:
      connected ?? base.connected ?? [],
    requiresUserLogin:
      requiresUserLogin ??
      base.requiresUserLogin ??
      [],
    notImplemented:
      notImplemented ??
      base.notImplemented ??
      [],
    externalConfigurationRequired:
      update.externalConfigurationRequired ??
      base.externalConfigurationRequired ??
      true,
  };

  validateManualReleaseEvidence(next);
  return next;
}
