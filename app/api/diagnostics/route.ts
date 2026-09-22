import { loadAuditStore, queryAuditEntries } from "@/lib/diagnostics/audit";
import type {
  AstraAuditCategory,
  AstraAuditOutcome,
} from "@/lib/diagnostics/contracts";
import { createLocalDiagnosticsRegistry } from "@/lib/diagnostics/runtime";
import {
  errorResponse,
  guardRequest,
  RequestError,
} from "@/lib/brain/http";

export const dynamic = "force-dynamic";

const CATEGORIES = new Set<AstraAuditCategory>([
  "brain",
  "tool",
  "automation",
  "task",
  "event",
  "provider",
  "memory",
  "system",
  "security",
]);

const OUTCOMES = new Set<AstraAuditOutcome>([
  "success",
  "failure",
  "blocked",
  "cancelled",
]);

function parseLimit(value: string | null) {
  if (!value) return 50;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) {
    throw new RequestError("limit must be an integer between 1 and 200.");
  }
  return parsed;
}

function parseCategory(value: string | null) {
  if (!value) return undefined;
  if (!CATEGORIES.has(value as AstraAuditCategory)) {
    throw new RequestError("category is invalid.");
  }
  return value as AstraAuditCategory;
}

function parseOutcome(value: string | null) {
  if (!value) return undefined;
  if (!OUTCOMES.has(value as AstraAuditOutcome)) {
    throw new RequestError("outcome is invalid.");
  }
  return value as AstraAuditOutcome;
}

export async function GET(request: Request) {
  try {
    guardRequest(request);
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get("limit"));
    const category = parseCategory(url.searchParams.get("category"));
    const outcome = parseOutcome(url.searchParams.get("outcome"));
    const projectId = url.searchParams.get("projectId")?.trim() || undefined;
    if (projectId && projectId.length > 120) {
      throw new RequestError("projectId is too long.");
    }

    const registry = createLocalDiagnosticsRegistry();
    const diagnostics = await registry.capture({
      connectivity: "unknown",
      signal: request.signal,
    });

    const audit = await loadAuditStore();
    const entries = audit.available
      ? queryAuditEntries({
          entries: audit.store.entries,
          limit,
          category,
          outcome,
          projectId,
        })
      : [];

    return Response.json({
      ok: diagnostics.unavailable === 0 && audit.available,
      diagnostics,
      audit: {
        available: audit.available,
        detail: audit.detail,
        entries,
      },
      truthBoundary:
        "Connectivity remains UNKNOWN until a real connectivity probe is wired. Recovery proposals are non-executing.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
