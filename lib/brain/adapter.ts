import { runAgent, selectAgent } from "@/lib/agent/orchestrator";
import { ASTRA_AGENT_MAP } from "@/lib/agent/roster";
import type { AstraAgentKey } from "@/lib/agent/types";
import {
  chatWithCodex,
  codexMayReceiveMemory,
  getCodexStatus,
} from "./codex";
import {
  chatWithCloud,
  cloudMayReceiveMemory,
  getCloudStatus,
} from "./cloud";
import { chatWithHermes, getHermesStatus } from "./hermes";
import { getMemoryContext, type AstraMemoryContext } from "./memory";
import { chatWithOllama, getOllamaStatus } from "./ollama";
import {
  getPermissionPolicy,
  permissionPolicyPrompt,
  toolsPolicyDetail,
} from "./policy";
import { getSkillContext, type AstraSkillContext } from "./skills";
import type {
  AstraBrain,
  AstraBrainChatResult,
  AstraBrainEvent,
  AstraBrainPermissionSnapshot,
  AstraBrainProvider,
  AstraBrainRunOptions,
  AstraBrainStatus,
} from "./types";

const VISUAL_NODE_BY_AGENT: Record<AstraAgentKey, string> = {
  chief_of_staff: "chief_of_staff",
  memory: "memory",
  researcher: "researcher",
  developer: "developer",
  computer: "ops",
  files: "drive",
  github: "developer",
  communication: "email",
  business: "ops",
  trading: "finance",
};

type ExecutionContext = {
  memory: AstraMemoryContext;
  skills: AstraSkillContext;
  policy: AstraBrainPermissionSnapshot;
  policyText: string;
  localContext: string;
  skillOnlyContext: string;
};

function visualNode(agent: AstraAgentKey) {
  return VISUAL_NODE_BY_AGENT[agent];
}

function routeFor(selected: AstraAgentKey): AstraAgentKey[] {
  return selected === "chief_of_staff"
    ? ["chief_of_staff"]
    : ["chief_of_staff", selected];
}

function isEngineeringRoute(selected: AstraAgentKey) {
  return selected === "developer" || selected === "github";
}

function isLocalExecutionRoute(selected: AstraAgentKey) {
  return (
    selected === "chief_of_staff" ||
    selected === "developer" ||
    selected === "github" ||
    selected === "files" ||
    selected === "computer"
  );
}

async function buildExecutionContext(
  input: string,
  selected: AstraAgentKey,
): Promise<ExecutionContext> {
  const policy = getPermissionPolicy();
  const [memory, skills] = await Promise.all([
    getMemoryContext(input),
    getSkillContext(selected),
  ]);

  const skillOnlyContext = skills.text;
  const localContext = [skills.text, memory.text].filter(Boolean).join("\n\n");

  return {
    memory,
    skills,
    policy,
    policyText: permissionPolicyPrompt(policy),
    localContext,
    skillOnlyContext,
  };
}

function baseEvents(selected: AstraAgentKey, now = Date.now()): AstraBrainEvent[] {
  const events: AstraBrainEvent[] = [
    {
      id: `${now}-request`,
      type: "request.received",
      at: now,
      agent: "chief_of_staff",
      visualNode: "chief_of_staff",
      label: "Request received",
      detail: "ASTRA Core accepted the request.",
    },
  ];

  if (selected !== "chief_of_staff") {
    events.push({
      id: `${now}-route`,
      type: "router.selected",
      at: now + 1,
      agent: selected,
      visualNode: visualNode(selected),
      label: "Route selected",
      detail: `Chief routed the request to ${selected}.`,
    });
  }

  return events;
}

function contextEvents(
  selected: AstraAgentKey,
  context: ExecutionContext,
  now: number,
): AstraBrainEvent[] {
  const events: AstraBrainEvent[] = [];
  let offset = 2;

  if (context.memory.entries.length > 0) {
    events.push({
      id: `${now}-memory`,
      type: "memory.loaded",
      at: now + offset,
      agent: "memory",
      visualNode: "memory",
      label: "Memory loaded",
      detail: `Retrieved ${context.memory.entries.length} relevant local memory entr${context.memory.entries.length === 1 ? "y" : "ies"}.`,
    });
    offset += 1;
  }

  if (context.skills.skills.length > 0) {
    events.push({
      id: `${now}-skills`,
      type: "skill.selected",
      at: now + offset,
      agent: selected,
      visualNode: visualNode(selected),
      label: "Skills loaded",
      detail: context.skills.skills.map((skill) => skill.id).join(", "),
    });
    offset += 1;
  }

  events.push({
    id: `${now}-policy`,
    type: "policy.applied",
    at: now + offset,
    agent: selected,
    label: "Permission policy applied",
    detail: toolsPolicyDetail(context.policy),
  });

  return events;
}

function providerLabel(provider: AstraBrainProvider) {
  switch (provider) {
    case "hermes":
      return "Hermes";
    case "ollama":
      return "Ollama";
    case "codex":
      return "Codex";
    case "cloud":
      return "Cloud";
    default:
      return "Routing";
  }
}

let liveEventSequence = 0;

function emitLiveEvent(
  options: AstraBrainRunOptions | undefined,
  event: Omit<AstraBrainEvent, "id" | "at">,
) {
  const at = Date.now();
  liveEventSequence += 1;
  const live: AstraBrainEvent = {
    ...event,
    id: `live-${at}-${liveEventSequence}-${event.type}`,
    at,
  };
  options?.onEvent?.(live);
  return live;
}

function emitLiveStart(
  selected: AstraAgentKey,
  options?: AstraBrainRunOptions,
) {
  emitLiveEvent(options, {
    type: "request.received",
    agent: "chief_of_staff",
    visualNode: "chief_of_staff",
    label: "Request received",
    detail: "ASTRA Brain accepted the request.",
  });

  if (selected !== "chief_of_staff") {
    emitLiveEvent(options, {
      type: "router.selected",
      agent: selected,
      visualNode: visualNode(selected),
      label: "Route selected",
      detail: `Chief routed the request to ${selected}.`,
    });
  }
}

function emitLiveContext(
  selected: AstraAgentKey,
  context: ExecutionContext,
  options?: AstraBrainRunOptions,
) {
  if (context.memory.entries.length > 0) {
    emitLiveEvent(options, {
      type: "memory.loaded",
      agent: "memory",
      visualNode: "memory",
      label: "Memory loaded",
      detail: `Retrieved ${context.memory.entries.length} relevant local memory entr${context.memory.entries.length === 1 ? "y" : "ies"}.`,
    });
  }

  if (context.skills.skills.length > 0) {
    emitLiveEvent(options, {
      type: "skill.selected",
      agent: selected,
      visualNode: visualNode(selected),
      label: "Skills loaded",
      detail: context.skills.skills.map((skill) => skill.id).join(", "),
    });
  }

  emitLiveEvent(options, {
    type: "policy.applied",
    agent: selected,
    visualNode: visualNode(selected),
    label: "Permission policy applied",
    detail: toolsPolicyDetail(context.policy),
  });
}

function emitLiveProviderStart(
  selected: AstraAgentKey,
  provider: Exclude<AstraBrainProvider, "routing_only">,
  options?: AstraBrainRunOptions,
) {
  const label = providerLabel(provider);
  emitLiveEvent(options, {
    type: "provider.selected",
    provider,
    agent: selected,
    visualNode: provider === "codex" ? "developer" : visualNode(selected),
    label: `${label} selected`,
    detail:
      provider === "codex"
        ? "ASTRA selected the local authenticated Codex CLI engineering specialist."
        : provider === "cloud"
          ? "ASTRA selected the explicitly opted-in cloud fallback."
          : `ASTRA Brain selected the local ${label} provider.`,
  });
  emitLiveEvent(options, {
    type: "agent.started",
    provider,
    agent: selected,
    visualNode: visualNode(selected),
    label: "Agent started",
    detail: `${ASTRA_AGENT_MAP[selected].name} started execution through ${label}.`,
  });
}

function emitLiveProviderUnavailable(
  selected: AstraAgentKey,
  provider: Exclude<AstraBrainProvider, "routing_only">,
  detail: string,
  options?: AstraBrainRunOptions,
) {
  emitLiveEvent(options, {
    type: "provider.unavailable",
    provider,
    agent: selected,
    visualNode: provider === "codex" ? "developer" : visualNode(selected),
    label: `${providerLabel(provider)} unavailable`,
    detail,
  });
}

function emitLiveProviderComplete(
  selected: AstraAgentKey,
  provider: Exclude<AstraBrainProvider, "routing_only">,
  options?: AstraBrainRunOptions,
) {
  const label = providerLabel(provider);
  emitLiveEvent(options, {
    type: "agent.completed",
    provider,
    agent: selected,
    visualNode: visualNode(selected),
    label: "Agent completed",
    detail: `${ASTRA_AGENT_MAP[selected].name} completed the ${label} turn.`,
  });
  emitLiveEvent(options, {
    type: "response.ready",
    provider,
    agent: selected,
    visualNode: "chief_of_staff",
    label: "Response ready",
    detail: `${label} returned the final response to ASTRA Runtime.`,
  });
}

function emitLiveBlocked(
  selected: AstraAgentKey,
  detail: string,
  options?: AstraBrainRunOptions,
) {
  emitLiveEvent(options, {
    type: "agent.blocked",
    provider: "routing_only",
    agent: selected,
    visualNode: visualNode(selected),
    label: "Execution blocked",
    detail,
  });
  emitLiveEvent(options, {
    type: "response.ready",
    provider: "routing_only",
    agent: selected,
    visualNode: "chief_of_staff",
    label: "Response ready",
    detail: "ASTRA returned a blocked/routing-only result.",
  });
}

function providerEvents(
  selected: AstraAgentKey,
  provider: Exclude<AstraBrainProvider, "routing_only">,
  context: ExecutionContext,
): AstraBrainEvent[] {
  const now = Date.now();
  const label = providerLabel(provider);
  const contextTrace = contextEvents(selected, context, now);
  const startAt = now + 2 + contextTrace.length;

  return [
    ...baseEvents(selected, now),
    ...contextTrace,
    {
      id: `${now}-provider`,
      type: "provider.selected",
      at: startAt,
      agent: selected,
      visualNode: provider === "codex" ? "developer" : visualNode(selected),
      label: `${label} selected`,
      detail:
        provider === "codex"
          ? "ASTRA selected the local authenticated Codex CLI engineering specialist."
          : provider === "cloud"
            ? "ASTRA selected the explicitly opted-in cloud fallback."
            : `ASTRA Brain selected the local ${label} provider.`,
    },
    {
      id: `${now}-started`,
      type: "agent.started",
      at: startAt + 1,
      agent: selected,
      visualNode: visualNode(selected),
      label: "Agent started",
      detail: `${ASTRA_AGENT_MAP[selected].name} started execution through ${label}.`,
    },
    {
      id: `${now}-completed`,
      type: "agent.completed",
      at: startAt + 2,
      agent: selected,
      visualNode: visualNode(selected),
      label: "Agent completed",
      detail: `${ASTRA_AGENT_MAP[selected].name} completed the ${label} turn.`,
    },
    {
      id: `${now}-response`,
      type: "response.ready",
      at: startAt + 3,
      agent: selected,
      visualNode: "chief_of_staff",
      label: "Response ready",
      detail: `${label} returned the final response to ASTRA Runtime.`,
    },
  ];
}

function routingOnlyEvents(
  selected: AstraAgentKey,
  state: AstraBrainChatResult["state"],
  context: ExecutionContext,
  providerDetail?: string,
): AstraBrainEvent[] {
  const now = Date.now();
  const contextTrace = contextEvents(selected, context, now);
  const events: AstraBrainEvent[] = [
    ...baseEvents(selected, now),
    ...contextTrace,
  ];
  let offset = 2 + contextTrace.length;

  if (providerDetail) {
    events.push({
      id: `${now}-provider-unavailable`,
      type: "provider.unavailable",
      at: now + offset,
      agent: selected,
      visualNode: visualNode(selected),
      label: "Execution providers unavailable",
      detail: providerDetail,
    });
    offset += 1;
  }

  if (state === "needs_provider" || state === "blocked") {
    events.push({
      id: `${now}-blocked`,
      type: "agent.blocked",
      at: now + offset,
      agent: selected,
      visualNode: visualNode(selected),
      label: state === "blocked" ? "Execution blocked" : "Execution waiting",
      detail:
        providerDetail ||
        (state === "blocked"
          ? "ASTRA permission policy blocked this execution request."
          : "No permitted execution provider is currently available."),
    });
    offset += 1;
  }

  events.push({
    id: `${now}-response`,
    type: "response.ready",
    at: now + offset,
    agent: selected,
    visualNode: "chief_of_staff",
    label: "Response ready",
    detail:
      state === "needs_provider"
        ? "Routing and context retrieval completed; execution did not run."
        : state === "blocked"
          ? "Execution was blocked by approval or permission policy."
          : "ASTRA completed the request.",
  });

  return events;
}

function envelopeContext(context: ExecutionContext) {
  return {
    context: {
      memoryEntries: context.memory.entries.length,
      skills: context.skills.skills.map((skill) => skill.id),
    },
    permissions: context.policy,
  };
}

class RoutingOnlyBrainAdapter implements AstraBrain {
  async chat(input: string): Promise<AstraBrainChatResult> {
    const response = await runAgent(input);
    const route = routeFor(response.agent);
    const context = await buildExecutionContext(input, response.agent);

    return {
      ...response,
      brain: {
        provider: "routing_only",
        execution: response.state === "completed" ? "executed" : "routing_only",
        route,
        visualNodes: route.map(visualNode),
        events: routingOnlyEvents(response.agent, response.state, context),
        ...envelopeContext(context),
      },
    };
  }

  async execute(task: { input: string; approved?: boolean }): Promise<AstraBrainChatResult> {
    const response = await this.chat(task.input);
    return {
      ...response,
      brain: {
        ...response.brain,
        requestedMode: "execute" as const,
      },
    };
  }

  async cancel() {
    // Routing-only mode has no long-running backend process to cancel.
  }

  async status(): Promise<AstraBrainStatus> {
    const policy = getPermissionPolicy();
    return {
      ready: true,
      provider: "routing_only",
      mode: "routing_only",
      detail: "ASTRA routing-only fallback is ready.",
      permissions: policy,
    };
  }
}

class LocalPreferredBrainAdapter implements AstraBrain {
  private readonly fallback = new RoutingOnlyBrainAdapter();

  async chat(input: string): Promise<AstraBrainChatResult> {
    const selected = selectAgent(input);
    const agent = ASTRA_AGENT_MAP[selected];
    const route = routeFor(selected);
    const context = await buildExecutionContext(input, selected);
    const failures: string[] = [];

    if (isEngineeringRoute(selected)) {
      try {
        const codexContext = [
          context.skillOnlyContext,
          codexMayReceiveMemory() ? context.memory.text : "",
        ]
          .filter(Boolean)
          .join("\n\n");
        const result = await chatWithCodex({
          input,
          agent,
          context: codexContext,
          policyText: context.policyText,
          policy: context.policy,
        });

        return {
          ok: true,
          agent: selected,
          agentName: agent.name,
          state: "completed",
          message: result.message,
          requiresApproval: false,
          brain: {
            provider: "codex",
            execution: "executed",
            requestedMode: "chat",
            route,
            visualNodes: route.map(visualNode),
            events: providerEvents(selected, "codex", context),
            ...envelopeContext(context),
          },
        };
      } catch (error) {
        failures.push(
          `Codex: ${error instanceof Error ? error.message : "unavailable"}`,
        );
      }
    }

    try {
      const result = await chatWithHermes({
        input,
        agent,
        context: context.localContext,
        policyText: context.policyText,
      });

      return {
        ok: true,
        agent: selected,
        agentName: agent.name,
        state: "completed",
        message: result.message,
        requiresApproval: false,
        brain: {
          provider: "hermes",
          execution: "executed",
          requestedMode: "chat",
          route,
          visualNodes: route.map(visualNode),
          events: providerEvents(selected, "hermes", context),
          ...envelopeContext(context),
        },
      };
    } catch (error) {
      failures.push(
        `Hermes: ${error instanceof Error ? error.message : "unavailable"}`,
      );
    }

    try {
      const result = await chatWithOllama({
        input,
        agent,
        context: context.localContext,
        policyText: context.policyText,
      });

      return {
        ok: true,
        agent: selected,
        agentName: agent.name,
        state: "completed",
        message: result.message,
        requiresApproval: false,
        brain: {
          provider: "ollama",
          execution: "executed",
          requestedMode: "chat",
          route,
          visualNodes: route.map(visualNode),
          events: providerEvents(selected, "ollama", context),
          ...envelopeContext(context),
        },
      };
    } catch (error) {
      failures.push(
        `Ollama: ${error instanceof Error ? error.message : "unavailable"}`,
      );
    }

    if (context.policy.allowPaidCloud) {
      try {
        const cloudContext = [
          context.skillOnlyContext,
          cloudMayReceiveMemory(context.policy) ? context.memory.text : "",
        ]
          .filter(Boolean)
          .join("\n\n");

        const result = await chatWithCloud({
          input,
          agent,
          context: cloudContext,
          policyText: context.policyText,
          policy: context.policy,
        });

        return {
          ok: true,
          agent: selected,
          agentName: agent.name,
          state: "completed",
          message: result.message,
          requiresApproval: false,
          brain: {
            provider: "cloud",
            execution: "executed",
            requestedMode: "chat",
            route,
            visualNodes: route.map(visualNode),
            events: providerEvents(selected, "cloud", context),
            ...envelopeContext(context),
          },
        };
      } catch (error) {
        failures.push(
          `Cloud: ${error instanceof Error ? error.message : "unavailable"}`,
        );
      }
    }

    const fallback = await this.fallback.chat(input);
    return {
      ...fallback,
      brain: {
        ...fallback.brain,
        route,
        visualNodes: route.map(visualNode),
        events: routingOnlyEvents(
          selected,
          fallback.state,
          context,
          failures.join(" | "),
        ),
        ...envelopeContext(context),
      },
    };
  }

  async execute(task: { input: string; approved?: boolean }): Promise<AstraBrainChatResult> {
    const input = task.input.trim();
    const selected = selectAgent(input);
    const agent = ASTRA_AGENT_MAP[selected];
    const route = routeFor(selected);
    const context = await buildExecutionContext(input, selected);
    const failures: string[] = [];

    const blocked = (
      message: string,
      detail: string,
      requiresApproval = false,
    ): AstraBrainChatResult => ({
      ok: false,
      agent: selected,
      agentName: agent.name,
      state: "blocked",
      message,
      requiresApproval,
      brain: {
        provider: "routing_only",
        execution: "blocked",
        requestedMode: "execute",
        route,
        visualNodes: route.map(visualNode),
        events: routingOnlyEvents(selected, "blocked", context, detail),
        ...envelopeContext(context),
      },
    });

    if (context.policy.requireApproval && !task.approved) {
      return blocked(
        "ASTRA siap menjalankan tugas ini, tetapi eksekusi membutuhkan approval eksplisit. Gunakan EXECUTE TASK untuk menyetujui eksekusi.",
        "Execution mode requested without explicit user approval.",
        true,
      );
    }

    if (isLocalExecutionRoute(selected)) {
      const codexStatus = await getCodexStatus(context.policy);

      if (!codexStatus.available) {
        failures.push(codexStatus.detail);
      } else if (codexStatus.sandbox !== "workspace-write") {
        return blocked(
          "Codex tersedia, tetapi ASTRA masih dalam mode read-only. Aktifkan ASTRA_ALLOW_FILE_WRITE=true dan ASTRA_CODEX_SANDBOX=workspace-write di .env.local, lalu restart ASTRA.",
          "Codex execution is blocked because its effective sandbox is read-only.",
        );
      } else if (selected === "computer" && !context.policy.allowShell) {
        return blocked(
          "Tugas komputer membutuhkan izin shell. Set ASTRA_ALLOW_SHELL=true di .env.local, lalu restart ASTRA.",
          "Computer execution is blocked because ASTRA_ALLOW_SHELL is false.",
        );
      } else {
        try {
          const codexContext = [
            context.skillOnlyContext,
            codexMayReceiveMemory() ? context.memory.text : "",
          ]
            .filter(Boolean)
            .join("\n\n");

          const result = await chatWithCodex({
            input,
            agent,
            context: codexContext,
            policyText: context.policyText,
            policy: context.policy,
            executionRequested: true,
          });

          return {
            ok: true,
            agent: selected,
            agentName: agent.name,
            state: "completed",
            message: result.message,
            requiresApproval: false,
            brain: {
              provider: "codex",
              execution: "executed",
              requestedMode: "execute",
              route,
              visualNodes: route.map(visualNode),
              events: providerEvents(selected, "codex", context),
              ...envelopeContext(context),
            },
          };
        } catch (error) {
          failures.push(
            `Codex: ${error instanceof Error ? error.message : "execution failed"}`,
          );
        }
      }
    }

    try {
      const result = await chatWithHermes({
        input,
        agent,
        context: context.localContext,
        policyText: [
          context.policyText,
          "EXECUTION MODE: perform the requested task with real Hermes tools when available and permitted. Do not merely describe an action. Do not claim completion unless the tool actually completed it.",
        ].join("\n"),
      });

      return {
        ok: true,
        agent: selected,
        agentName: agent.name,
        state: "completed",
        message: result.message,
        requiresApproval: false,
        brain: {
          provider: "hermes",
          execution: "executed",
          requestedMode: "execute",
          route,
          visualNodes: route.map(visualNode),
          events: providerEvents(selected, "hermes", context),
          ...envelopeContext(context),
        },
      };
    } catch (error) {
      failures.push(
        `Hermes: ${error instanceof Error ? error.message : "unavailable"}`,
      );
    }

    return blocked(
      "ASTRA tidak menemukan executor yang dapat menjalankan tugas ini. Untuk tugas repo/file lokal, aktifkan Codex workspace-write. Untuk aksi aplikasi/email/web eksternal, sambungkan Hermes + tools/MCP dan izinkan aksi yang diperlukan.",
      failures.join(" | ") || "No execution-capable provider is available.",
    );
  }

  async cancel() {
    // Provider calls are request-scoped. Client AbortController cancels the HTTP turn.
    // Codex child processes are terminated by their own timeout/completion lifecycle.
  }

  async status(): Promise<AstraBrainStatus> {
    const policy = getPermissionPolicy();
    const [
      hermes,
      ollama,
      codex,
      cloud,
      memory,
      skills,
    ] = await Promise.all([
      getHermesStatus(),
      getOllamaStatus(),
      getCodexStatus(policy),
      getCloudStatus(policy),
      getMemoryContext("ASTRA status"),
      getSkillContext("chief_of_staff"),
    ]);

    const features: NonNullable<AstraBrainStatus["features"]> = {
      memory: {
        enabled: memory.enabled,
        available: memory.available,
        detail: memory.detail,
        endpoint: memory.source,
      },
      skills: {
        enabled: skills.enabled,
        available: skills.available,
        detail: skills.detail,
      },
      codex: {
        enabled: codex.enabled,
        available: codex.available,
        detail: codex.detail,
        endpoint: codex.endpoint,
        model: codex.model ?? undefined,
      },
      tools: {
        enabled: true,
        available:
          hermes.available ||
          (codex.available && codex.sandbox === "workspace-write"),
        detail: `${toolsPolicyDetail(policy)} Codex sandbox: ${codex.sandbox}. Tool execution is delegated to permitted Hermes/Codex capabilities; ASTRA does not invent tool activity when no provider reports it.`,
      },
      cloud: {
        enabled: cloud.enabled,
        available: cloud.available,
        detail: cloud.detail,
        endpoint: cloud.endpoint,
        model: cloud.model ?? undefined,
      },
    };

    if (hermes.available) {
      return {
        ready: true,
        provider: "hermes",
        mode: "local",
        endpoint: hermes.endpoint,
        model: hermes.model,
        fallback: "ollama",
        detail:
          "ASTRA Brain is connected to Hermes. Ollama is the local fallback; Codex is available for engineering when configured.",
        permissions: policy,
        features,
      };
    }

    if (ollama.available) {
      return {
        ready: true,
        provider: "ollama",
        mode: "local",
        endpoint: ollama.endpoint,
        model: ollama.model ?? undefined,
        fallback: "routing_only",
        detail: `${hermes.detail} ASTRA is using local Ollama model ${ollama.model}.`,
        permissions: policy,
        features,
      };
    }

    return {
      ready: true,
      provider: "routing_only",
      mode: "routing_only",
      endpoint: ollama.endpoint,
      model: ollama.model ?? undefined,
      fallback: "routing_only",
      detail: `${hermes.detail} ${ollama.detail} ASTRA is using routing-only fallback. Engineering requests can still use Codex when the local CLI is available.`,
      permissions: policy,
      features,
    };
  }
}

export const astraBrain: AstraBrain = new LocalPreferredBrainAdapter();
