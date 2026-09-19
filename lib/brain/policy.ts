import type { AstraBrainPermissionSnapshot } from "./types";

function envFlag(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "off", "no"].includes(value);
}

export function getPermissionPolicy(): AstraBrainPermissionSnapshot {
  return {
    requireApproval: envFlag("ASTRA_REQUIRE_APPROVAL", true),
    allowShell: envFlag("ASTRA_ALLOW_SHELL", false),
    allowFileWrite: envFlag("ASTRA_ALLOW_FILE_WRITE", false),
    allowExternalActions: envFlag("ASTRA_ALLOW_EXTERNAL_ACTIONS", false),
    allowPaidCloud: envFlag("ASTRA_ALLOW_PAID_CLOUD", false),
  };
}

export function permissionPolicyPrompt(policy = getPermissionPolicy()) {
  return [
    "ASTRA permission policy:",
    `- explicit approval required for side effects: ${policy.requireApproval ? "YES" : "NO"}`,
    `- shell execution with side effects: ${policy.allowShell ? "ALLOWED" : "BLOCKED"}`,
    `- file writes/edits: ${policy.allowFileWrite ? "ALLOWED" : "BLOCKED"}`,
    `- external actions (messages, pushes, remote actions, writes): ${policy.allowExternalActions ? "ALLOWED" : "BLOCKED"}`,
    `- paid cloud escalation: ${policy.allowPaidCloud ? "ALLOWED BY CONFIG" : "BLOCKED"}`,
    "Read-only inspection and reasoning are allowed.",
    "Never claim a blocked side effect was completed.",
  ].join("\n");
}

export function toolsPolicyDetail(policy = getPermissionPolicy()) {
  const enabled: string[] = ["read-only reasoning"];
  if (policy.allowShell) enabled.push("shell");
  if (policy.allowFileWrite) enabled.push("file write");
  if (policy.allowExternalActions) enabled.push("external actions");

  return `ASTRA tool policy active: ${enabled.join(", ")}. Side effects${policy.requireApproval ? " require approval" : " follow configured allow flags"}.`;
}
