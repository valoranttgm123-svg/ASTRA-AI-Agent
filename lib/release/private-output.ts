import path from "node:path";

import {
  assertExistingPrivateAstraFile,
  preparePrivateAstraOutputFile,
} from "../security/private-output";

export function readinessEvidenceRoot() {
  return path.resolve(".astra", "readiness");
}

export function resolveReadinessEvidencePath(
  raw?: string,
  now = new Date(),
) {
  const root = readinessEvidenceRoot();
  const timestamp = now
    .toISOString()
    .replace(/[:.]/g, "-");

  const candidate = path.resolve(
    raw ||
      path.join(
        root,
        `self-check-${timestamp}.json`,
      ),
  );
  const relative = path.relative(root, candidate);

  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      "Readiness evidence output must stay inside .astra/readiness/.",
    );
  }

  return candidate;
}

export function prepareReadinessEvidencePath(
  raw?: string,
  now = new Date(),
) {
  return preparePrivateAstraOutputFile(
    resolveReadinessEvidencePath(
      raw,
      now,
    ),
    readinessEvidenceRoot(),
  );
}


export function releaseEvidenceRoot() {
  return path.resolve(".astra", "release");
}

export function resolveReleaseEvidencePath(
  raw: string | undefined,
  prefix: string,
  extension: "json" | "md" = "json",
  now = new Date(),
) {
  const root = releaseEvidenceRoot();
  const timestamp = now
    .toISOString()
    .replace(/[:.]/g, "-");

  const candidate = path.resolve(
    raw ||
      path.join(
        root,
        `${prefix}-${timestamp}.${extension}`,
      ),
  );
  const relative = path.relative(root, candidate);

  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      "Release evidence output must stay inside .astra/release/.",
    );
  }

  return candidate;
}

export function prepareReleaseEvidencePath(
  raw: string | undefined,
  prefix: string,
  extension: "json" | "md" = "json",
  now = new Date(),
) {
  return preparePrivateAstraOutputFile(
    resolveReleaseEvidencePath(
      raw,
      prefix,
      extension,
      now,
    ),
    releaseEvidenceRoot(),
  );
}

export function assertPrivateAstraEvidencePath(
  candidate: string,
) {
  const privateRoot = path.resolve(".astra");
  const resolved = path.resolve(candidate);
  const relative = path.relative(privateRoot, resolved);

  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      "Release evidence inputs must stay inside .astra/.",
    );
  }

  return resolved;
}


export function assertExistingPrivateAstraEvidenceFile(
  candidate: string,
) {
  const lexicalPath =
    assertPrivateAstraEvidencePath(candidate);

  try {
    return assertExistingPrivateAstraFile(
      lexicalPath,
    );
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Release evidence input invalid: ${error.message}`
        : "Release evidence input invalid.",
    );
  }
}
