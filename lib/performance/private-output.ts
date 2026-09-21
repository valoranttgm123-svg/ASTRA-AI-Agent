import path from "node:path";

import {
  preparePrivateAstraOutputFile,
} from "../security/private-output";

export function browserPerformanceRoot() {
  return path.resolve(".astra", "performance");
}

export function resolveBrowserPerformancePath(
  scenario: string,
  now = new Date(),
) {
  const root = browserPerformanceRoot();
  const timestamp = now
    .toISOString()
    .replace(/[:.]/g, "-");
  const safeScenario = scenario
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .slice(0, 40);

  const candidate = path.resolve(
    root,
    `browser-${safeScenario}-${timestamp}.json`,
  );
  const relative = path.relative(root, candidate);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      "Browser performance output must stay inside .astra/performance/.",
    );
  }
  return candidate;
}


export function resolveRuntimePerformancePath(
  raw?: string,
  now = new Date(),
) {
  const root = browserPerformanceRoot();
  const timestamp = now
    .toISOString()
    .replace(/[:.]/g, "-");
  const candidate = path.resolve(
    raw ||
      path.join(
        root,
        `runtime-${timestamp}.json`,
      ),
  );
  const relative = path.relative(
    root,
    candidate,
  );

  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      "Runtime performance output must stay inside .astra/performance/.",
    );
  }

  return candidate;
}

export function prepareRuntimePerformancePath(
  raw?: string,
  now = new Date(),
) {
  return preparePrivateAstraOutputFile(
    resolveRuntimePerformancePath(
      raw,
      now,
    ),
    browserPerformanceRoot(),
  );
}

export function prepareBrowserPerformancePath(
  scenario: string,
  now = new Date(),
) {
  return preparePrivateAstraOutputFile(
    resolveBrowserPerformancePath(
      scenario,
      now,
    ),
    browserPerformanceRoot(),
  );
}

export function prepareBrowserBundlePath(
  now = new Date(),
) {
  const timestamp = now
    .toISOString()
    .replace(/[:.]/g, "-");
  return preparePrivateAstraOutputFile(
    path.join(
      browserPerformanceRoot(),
      `browser-release-bundle-${timestamp}.json`,
    ),
    browserPerformanceRoot(),
  );
}
