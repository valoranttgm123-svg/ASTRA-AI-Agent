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
