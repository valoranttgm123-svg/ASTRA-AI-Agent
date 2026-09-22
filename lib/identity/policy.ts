import type { AstraPermissionLevel } from "@/lib/agent/capabilities";
import type {
  AstraIdentityPermissionView,
  AstraIdentityScope,
  AstraIdentitySession,
} from "./contracts";

function dedupeScopes(scopes: readonly AstraIdentityScope[]) {
  return [...new Set(scopes)];
}

export function identityPermissionCeiling(
  session: AstraIdentitySession,
): AstraPermissionLevel {
  if (session.state !== "unlocked") return 1;
  if (session.role === "owner") return 3;
  if (session.role === "trusted_user") return 2;
  return 1;
}

export function sessionHasScope(
  session: AstraIdentitySession,
  scope: AstraIdentityScope,
) {
  return session.scopes.includes(scope);
}

export function sessionCanUseSecrets(session: AstraIdentitySession) {
  return (
    session.state === "unlocked" &&
    session.role !== "guest" &&
    sessionHasScope(session, "secrets.use")
  );
}

export function sessionCanRequestExternalWrite(
  session: AstraIdentitySession,
) {
  return (
    session.state === "unlocked" &&
    session.role === "owner" &&
    sessionHasScope(session, "external.write")
  );
}

export function identityPermissionView(
  session: AstraIdentitySession,
): AstraIdentityPermissionView {
  const permissionCeiling = identityPermissionCeiling(session);
  const canUseSecrets = sessionCanUseSecrets(session);
  const canRequestExternalWrite = sessionCanRequestExternalWrite(session);

  return {
    sessionId: session.id,
    role: session.role,
    state: session.state,
    permissionCeiling,
    scopes: dedupeScopes(session.scopes),
    canUseSecrets,
    canRequestExternalWrite,
    detail:
      "Identity establishes a maximum session scope only. ASTRA plan/tool permissions and explicit Level-3 approval remain independently required.",
  };
}
