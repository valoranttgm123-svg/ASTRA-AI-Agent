import path from "node:path";

import {
  preparePrivateAstraOutputFile,
} from "../security/private-output";

export function validationEvidenceRoot() {
  return path.resolve(".astra", "validation");
}

export function resolveValidationEvidencePath(
  raw?: string,
  now = new Date(),
) {
  const root = validationEvidenceRoot();
  const timestamp = now
    .toISOString()
    .replace(/[:.]/g, "-");

  const candidate = path.resolve(
    raw ||
      path.join(
        root,
        `full-system-preflight-${timestamp}.json`,
      ),
  );
  const relative = path.relative(root, candidate);

  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      "Validation evidence output must stay inside .astra/validation/.",
    );
  }

  return candidate;
}


export function prepareValidationEvidencePath(
  raw?: string,
  now = new Date(),
) {
  return preparePrivateAstraOutputFile(
    resolveValidationEvidencePath(
      raw,
      now,
    ),
    validationEvidenceRoot(),
  );
}
