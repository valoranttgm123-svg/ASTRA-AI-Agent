import path from "node:path";

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
