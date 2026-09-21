import {
  realpathSync,
  statSync,
} from "node:fs";
import path from "node:path";

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
  const privateRoot = path.resolve(".astra");

  let realRoot: string;
  let realCandidate: string;
  try {
    realRoot = realpathSync(privateRoot);
    realCandidate = realpathSync(lexicalPath);
  } catch {
    throw new Error(
      "Release evidence input must exist inside .astra/.",
    );
  }

  const relative = path.relative(
    realRoot,
    realCandidate,
  );
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      "Release evidence input resolved outside .astra/.",
    );
  }

  if (!statSync(realCandidate).isFile()) {
    throw new Error(
      "Release evidence input must be a regular file.",
    );
  }

  return realCandidate;
}
