import type {
  AstraExecutableToolRegistry,
  AstraToolDefinition,
  AstraToolExecutionPolicy,
  AstraToolExecutionResult,
  AstraToolHandler,
  AstraToolLifecycleEvent,
} from "./contracts";
import { createToolRegistry } from "./registry";
import { safeErrorDetail, safePublicDetail } from "@/lib/security/redaction";

const MAX_INPUT_CHARS = 16_000;
const MAX_OUTPUT_CHARS = 64_000;

function safeJsonLength(value: unknown) {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function emit(
  callback: ((event: AstraToolLifecycleEvent) => void) | undefined,
  event: AstraToolLifecycleEvent,
) {
  callback?.(event);
}

function policyAllows(
  definition: AstraToolDefinition,
  policy: AstraToolExecutionPolicy,
) {
  switch (definition.sideEffect) {
    case "read":
      return true;
    case "local_write":
      if (definition.category === "shell" || definition.category === "computer") {
        return policy.allowShell;
      }
      return policy.allowFileWrite;
    case "external_write":
      return policy.allowExternalActions;
    case "high_impact":
      if (!policy.allowExternalActions) return false;
      if (definition.category === "shell" || definition.category === "computer") {
        return policy.allowShell;
      }
      return policy.allowFileWrite || policy.allowExternalActions;
  }
}

function blocked(
  definition: AstraToolDefinition,
  detail: string,
): AstraToolExecutionResult {
  return {
    status: "blocked",
    detail,
    verified: false,
    provider: definition.provider,
  };
}

function failed(
  definition: AstraToolDefinition,
  detail: string,
): AstraToolExecutionResult {
  return {
    status: "failed",
    detail,
    verified: false,
    provider: definition.provider,
  };
}

async function withTimeout<T>(
  timeoutMs: number,
  externalSignal: AbortSignal | undefined,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException(
          "Tool execution timed out.",
          "TimeoutError",
        ),
      ),
    timeoutMs,
  );

  const onAbort = () =>
    controller.abort(
      externalSignal?.reason ??
        new DOMException(
          "Tool execution cancelled.",
          "AbortError",
        ),
    );

  if (externalSignal?.aborted) {
    onAbort();
  } else {
    externalSignal?.addEventListener("abort", onAbort, {
      once: true,
    });
  }

  let removeControllerAbort = () => {};

  const aborted = new Promise<never>((_resolve, reject) => {
    const rejectAbort = () => {
      const reason = controller.signal.reason;
      reject(
        reason instanceof Error
          ? reason
          : new DOMException(
              "Tool execution cancelled.",
              "AbortError",
            ),
      );
    };

    if (controller.signal.aborted) {
      rejectAbort();
      return;
    }

    controller.signal.addEventListener(
      "abort",
      rejectAbort,
      { once: true },
    );
    removeControllerAbort = () =>
      controller.signal.removeEventListener(
        "abort",
        rejectAbort,
      );
  });

  try {
    return await Promise.race([
      run(controller.signal),
      aborted,
    ]);
  } finally {
    clearTimeout(timer);
    removeControllerAbort();
    externalSignal?.removeEventListener("abort", onAbort);
  }
}

function normalizeOutput(
  definition: AstraToolDefinition,
  result: AstraToolExecutionResult,
): AstraToolExecutionResult {
  if (result.status === "completed" && result.verified !== true) {
    return failed(
      definition,
      "Tool handler returned completed without verified evidence.",
    );
  }

  if (
    result.output !== undefined &&
    safeJsonLength(result.output) > MAX_OUTPUT_CHARS
  ) {
    return failed(definition, "Tool output exceeded the ASTRA safety limit.");
  }

  return {
    ...result,
    detail: safePublicDetail(
      result.detail,
      result.status === "completed"
        ? "Tool execution completed."
        : "Tool execution failed.",
    ),
    provider: result.provider || definition.provider,
  };
}

export function createExecutableToolRegistry(
  definitions: readonly AstraToolDefinition[],
  handlers: Readonly<Record<string, AstraToolHandler>>,
): AstraExecutableToolRegistry {
  const registry = createToolRegistry(definitions);
  const normalizedHandlers = new Map<string, AstraToolHandler>();

  for (const [id, handler] of Object.entries(handlers)) {
    const definition = registry.get(id);
    if (!definition) {
      throw new Error("Handler registered for unknown tool: " + id);
    }
    normalizedHandlers.set(definition.id, handler);
  }

  return {
    ...registry,

    async execute(id, input, options) {
      const definition = registry.get(id);

      if (!definition) {
        return {
          status: "failed",
          detail: "Unknown tool: " + id,
          verified: false,
        };
      }

      if (options.signal?.aborted) {
        throw new DOMException("Tool execution cancelled.", "AbortError");
      }

      if (definition.availability !== "READY") {
        return blocked(
          definition,
          "Tool " +
            definition.id +
            " is " +
            definition.availability +
            " and cannot execute.",
        );
      }

      if (options.approvedPermissionLevel < definition.permissionLevel) {
        return blocked(
          definition,
          "Tool " +
            definition.id +
            " requires permission level " +
            definition.permissionLevel +
            ".",
        );
      }

      if (!policyAllows(definition, options.policy)) {
        return blocked(
          definition,
          "ASTRA policy does not permit this tool side effect.",
        );
      }

      if (
        definition.sideEffect !== "read" &&
        !definition.supportsCancellation
      ) {
        return blocked(
          definition,
          "Side-effecting tools must support cancellation before ASTRA can execute them.",
        );
      }

      if (safeJsonLength(input) > MAX_INPUT_CHARS) {
        return failed(definition, "Tool input exceeded the ASTRA safety limit.");
      }

      const handler = normalizedHandlers.get(definition.id);
      if (!handler) {
        return blocked(
          definition,
          "No executable handler is registered for this tool.",
        );
      }

      emit(options.onEvent, {
        type: "tool.started",
        toolId: definition.id,
        toolName: definition.name,
        category: definition.category,
        provider: definition.provider,
        detail: "Tool execution started.",
      });

      try {
        const result = normalizeOutput(
          definition,
          await withTimeout(
            definition.timeoutMs,
            options.signal,
            (signal) =>
              handler(input, {
                definition,
                signal,
              }),
          ),
        );

        emit(options.onEvent, {
          type:
            result.status === "completed"
              ? "tool.completed"
              : "tool.failed",
          toolId: definition.id,
          toolName: definition.name,
          category: definition.category,
          provider: result.provider || definition.provider,
          detail: result.detail,
        });

        return result;
      } catch (error) {
        if (options.signal?.aborted) {
          throw new DOMException("Tool execution cancelled.", "AbortError");
        }

        const name = error instanceof Error ? error.name : "";
        const detail =
          name === "TimeoutError"
            ? "Tool execution timed out."
            : safeErrorDetail(
                error,
                "Tool execution failed.",
              );

        const result = failed(definition, detail);
        emit(options.onEvent, {
          type: "tool.failed",
          toolId: definition.id,
          toolName: definition.name,
          category: definition.category,
          provider: definition.provider,
          detail,
        });
        return result;
      }
    },
  };
}
