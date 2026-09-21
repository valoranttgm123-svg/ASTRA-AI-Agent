import type {
  ManualReleaseEvidence,
} from "./core-report";
import {
  validateManualReleaseEvidence,
} from "./core-report";
import { safePublicDetail } from "../security/redaction";

export type ReleaseContextUpdate = {
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
      connected: [],
      requiresUserLogin: [],
      notImplemented: [],
      externalConfigurationRequired: true,
    };

  validateManualReleaseEvidence(base);

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
    ...(connected !== undefined
      ? { connected }
      : {}),
    ...(requiresUserLogin !== undefined
      ? { requiresUserLogin }
      : {}),
    ...(notImplemented !== undefined
      ? { notImplemented }
      : {}),
    ...(update.externalConfigurationRequired !==
    undefined
      ? {
          externalConfigurationRequired:
            update.externalConfigurationRequired,
        }
      : {}),
  };

  validateManualReleaseEvidence(next);
  return next;
}
