"use client";

/**
 * ApexWorld - the Apex app's CURRENT main screen, replicated for the site.
 * Layers: app-blue backdrop → clickable orb core (ring + particles, same tap
 * cycle) → ReasoningWeb (verbatim copy from the app: circuit traces, orbit
 * rings, the full asymmetric roster, ambient motes) → OrbStatusBar (equalizer
 * + STANDBY cluster at the bottom).
 * Clicking any node opens the site's AGENT OVERVIEW window template; the
 * orb's tap cycle drives the whole web (standby → processing → speaking).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import ApexHeroOrb, { type OrbState } from "./ApexHeroOrb";
import ReasoningWebJs from "./ReasoningWeb";
import ShaderBackgroundJs from "./ShaderBackground";
import OrbStatusBar from "./OrbStatusBar";
import { useAstraRuntime } from "./AstraRuntime";
import {
  ASTRA_CAPABILITY_NODES,
  capabilityStateLabel,
  type AstraCapabilityNodeKey,
  type AstraCapabilityState,
} from "@/lib/agent/capabilities";
import {
  capabilityStateIsLive,
  deriveCapabilityRuntimeMap,
} from "@/lib/agent/capability-runtime";

export type NodeSel = { name: string; key: string; color: string };

// the copied .jsx defaults onSelect to null, which TS infers as `null | undefined`
const ReasoningWeb = ReasoningWebJs as unknown as React.ComponentType<{
  state?: string; trace?: unknown; mode?: string; coreless?: boolean;
  onSelect?: (n: NodeSel) => void; light?: boolean;
  roster?: ReadonlyArray<readonly [
    string,
    string,
    string,
    number,
    number,
    boolean,
    number,
    number,
    AstraCapabilityState,
  ]>;
}>;
const ShaderBackground = ShaderBackgroundJs as unknown as React.ComponentType<{
  opacity?: number; voiceActive?: boolean; gold?: boolean;
}>;
type AgentInfo = {
  role: string;
  caps: string[];
  asks?: string[];
  status: AstraCapabilityState;
  implementation: "implemented" | "partial" | "planned";
};

export const ROSTER: { key: string; name: string; color: string }[] =
  ASTRA_CAPABILITY_NODES.map((node) => ({
    key: node.key,
    name: node.label,
    color: node.color,
  }));

export const INFO = Object.fromEntries(
  ASTRA_CAPABILITY_NODES.map((node) => [
    node.key,
    {
      role: node.role,
      caps: node.capabilities,
      asks: node.examples,
      status: node.defaultState,
      implementation: node.implementation,
    },
  ]),
) as Record<string, AgentInfo>;

const STATUS_LINE: Record<AstraCapabilityState, { color: string; text: string }> = {
  READY: { color: "#34d399", text: capabilityStateLabel("READY") },
  ACTIVE: { color: "#63eaff", text: capabilityStateLabel("ACTIVE") },
  WAITING_APPROVAL: { color: "#f5b942", text: capabilityStateLabel("WAITING_APPROVAL") },
  BLOCKED: { color: "#ff9d66", text: capabilityStateLabel("BLOCKED") },
  OFFLINE: { color: "#64748b", text: capabilityStateLabel("OFFLINE") },
  NOT_CONFIGURED: { color: "#7f9bb3", text: capabilityStateLabel("NOT_CONFIGURED") },
  ERROR: { color: "#ff5f6d", text: capabilityStateLabel("ERROR") },
};

/* ── AGENT OVERVIEW window - the site's template (the app opens live cockpits) ── */
export function AgentOverview({
  sel,
  onClose,
  statusOverride,
  statusDetail,
}: {
  sel: NodeSel;
  onClose: () => void;
  statusOverride?: AstraCapabilityState;
  statusDetail?: string;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ sx: number; sy: number } | null>(null);
  const info = INFO[sel.key] ?? { role: "Specialist", status: "NOT_CONFIGURED" as const, implementation: "planned" as const, caps: ["No registered ASTRA capability yet"] };
  const c = sel.color;
  const effectiveStatus = statusOverride ?? info.status;
  const status = STATUS_LINE[effectiveStatus];

  useEffect(() => {
    setPos({ x: Math.max(8, window.innerWidth / 2 - 170), y: Math.max(90, window.innerHeight * 0.16) });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Move focus into the window when it opens and hand it back on close, so the
  // keyboard does not stay stranded on the agent list behind it.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pos) return;
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => { if (opener && document.contains(opener)) opener.focus(); };
  }, [pos]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!pos) return;
    dragRef.current = { sx: e.clientX - pos.x, sy: e.clientY - pos.y };
    const move = (ev: MouseEvent) => {
      if (dragRef.current) setPos({ x: ev.clientX - dragRef.current.sx, y: ev.clientY - dragRef.current.sy });
    };
    const up = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  if (!pos) return null;
  return (
    <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`${sel.name} overview`} style={{
      position: "fixed", left: pos.x, top: pos.y,
      width: "min(340px, 92vw)", zIndex: 60,
      background: "rgba(4,3,12,0.92)",
      backdropFilter: "blur(24px)",
      border: `1px solid ${c}44`,
      borderRadius: 16,
      boxShadow: `0 0 40px ${c}18, 0 8px 32px rgba(0,0,0,0.6)`,
      overflow: "hidden",
    }}>
      {/* header - drag handle */}
      <div onMouseDown={onMouseDown} style={{
        display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
        borderBottom: `1px solid ${c}22`, cursor: "grab", userSelect: "none",
        background: `linear-gradient(135deg, ${c}0a 0%, transparent 100%)`,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", background: `${c}14`,
          border: `1px solid ${c}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: c, boxShadow: `0 0 10px ${c}` }} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", color: c }}>{sel.name.toUpperCase()}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{info.role}</div>
        </div>
        <button onClick={onClose} aria-label="Close"
          style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "6px 8px", transition: "color 0.2s" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.75)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
        >×</button>
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: "0.14em", color: `${c}99`, marginBottom: 8, fontFamily: "var(--font-mono)" }}>WHAT IT HANDLES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {info.caps.map((cap) => (
              <div key={cap} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                <div style={{ width: 3, height: 3, borderRadius: "50%", background: `${c}99`, marginTop: 6, flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.55 }}>{cap}</span>
              </div>
            ))}
          </div>
        </div>

        {info.asks && info.asks.length > 0 && (
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.14em", color: `${c}99`, marginBottom: 8, fontFamily: "var(--font-mono)" }}>EXAMPLE REQUESTS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {info.asks.map((task) => (
                <span key={task} style={{
                  padding: "4px 10px", background: `${c}0d`, border: `1px solid ${c}2a`,
                  borderRadius: 20, fontSize: 10.5, color: `${c}cc`,
                }}>{task}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 7, borderTop: `1px solid ${c}1a`, paddingTop: 12 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: status.color, boxShadow: `0 0 8px ${status.color}` }} />
          <span style={{ fontSize: 9.5, letterSpacing: "0.1em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>{status.text}</span>
        </div>
        {statusDetail ? (
          <div style={{ marginTop: -10, fontSize: 9, lineHeight: 1.45, color: "rgba(255,255,255,0.32)" }}>
            {statusDetail}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ── The world ── */
export default function ApexWorld() {
  const runtime = useAstraRuntime();
  const [selected, setSelected] = useState<NodeSel | null>(null);
  const [reduced, setReduced] = useState(false);

  // A tap cycles idle → thinking → speaking → idle. That state drives the
  // backdrop, the light-cast and the reasoning web's activity level.
  const [showState, setShowState] = useState<OrbState>("idle");
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orbState: OrbState = runtime.orbState !== "idle" ? runtime.orbState : showState;

  const boost = () => {
    const next: OrbState = showState === "idle" ? "thinking" : showState === "thinking" ? "speaking" : "idle";
    setShowState(next);
    if (showTimer.current) clearTimeout(showTimer.current);
    showTimer.current = setTimeout(() => setShowState("idle"), 8000);
  };
  useEffect(() => () => { if (showTimer.current) clearTimeout(showTimer.current); }, []);

  useEffect(() => {
    if (runtime.orbState === "idle") return;
    if (showTimer.current) clearTimeout(showTimer.current);
    showTimer.current = null;
    setShowState("idle");
  }, [runtime.orbState]);

  // Single entry point for opening an agent, shared by the SVG graph and the
  // hidden accessible list, so both routes behave identically.
  const openAgent = (n: NodeSel) => {
    setSelected(n);
  };

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // orb tap cycle → the web's activity level (same states the app streams)
  const webState = orbState === "thinking" ? "processing" : orbState === "speaking" ? "speaking" : "standby";

  const capabilityRuntime = useMemo(
    () =>
      deriveCapabilityRuntimeMap(
        runtime.brainStatus,
        runtime.brainEvents,
      ),
    [runtime.brainEvents, runtime.brainStatus],
  );

  const liveReasoningRoster = useMemo(
    () =>
      ASTRA_CAPABILITY_NODES.map((node) => {
        const live = capabilityRuntime[node.key];
        return [
          node.key,
          node.label,
          node.layer,
          node.visual.x,
          node.visual.y,
          capabilityStateIsLive(live.state),
          node.visual.bend,
          node.visual.radius,
          live.state,
        ] as const;
      }),
    [capabilityRuntime],
  );

  const currentPlan = runtime.lastResponse?.brain.plan;
  const currentInput = runtime.lastResponse?.brain.context?.input;
  const completedPlanSteps =
    currentPlan?.steps.filter((step) => step.status === "completed").length ?? 0;
  const approvalRequest = runtime.lastResponse?.approvalRequest;
  const selectedRuntime = selected
    ? capabilityRuntime[selected.key as AstraCapabilityNodeKey]
    : undefined;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", userSelect: "none" }}>
      {/* backdrop - the app's EXACT stack (Chat.jsx dark mode): base radial page
          gradient, waves at 0.12, the cyan breathing glow behind the orb, and the
          dark moat disc directly behind the particle cloud that makes it pop. */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 95% 88% at 50% 42%, #122c43 0%, #0c1d30 38%, #07111f 72%, #050b14 100%)",
      }} />

      {/* background waves - the app's WebGL shader at the app's opacity */}
      {!reduced && (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <ShaderBackground opacity={0.12} voiceActive={orbState === "speaking"} gold={false} />
        </div>
      )}

      {/* cyan LIGHT-CAST - app copy exactly: mixBlendMode screen (only ever LIFTS the
          navy, never darkens), brightens while speaking. The app has NO dark moat disc
          in dark mode - that layer is its light-theme "reactor well" only. */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none", mixBlendMode: "screen",
        background: `radial-gradient(circle at 50% 42%, rgba(13,210,255,${orbState === "speaking" ? 0.30 : 0.18}) 0%, rgba(13,170,228,0.08) 30%, rgba(8,17,31,0) 62%)`,
        transition: "background 0.6s ease",
      }} />

      {/* the reasoning web - app z-order: web (z13) sits BELOW the orb canvas (z15),
          so the bloom haze washes over the lines near the centre, exactly like the app */}
      {/* ReasoningWeb is a verbatim copy from the Apex app: its 18 agent nodes are
          imperative SVG hit-areas with no tabindex, inside an svg[role=img] that
          collapses the whole graph into a single image. Rather than edit the copy,
          the graph is marked decorative here and the same onSelect path is exposed
          through the equivalent list of real buttons below. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }}>
        <ReasoningWeb
          roster={liveReasoningRoster}
          state={webState}
          trace={runtime.brainTrace}
          mode="full"
          coreless
          onSelect={(n: NodeSel) => { openAgent(n); }}
        />
      </div>

      {/* Keyboard and screen-reader equivalent of the agent graph. */}
      <nav className="visually-hidden" aria-label="ASTRA capabilities">
        <ul>
          {ROSTER.map((a) => (
            <li key={a.key}>
              <button type="button" onClick={() => openAgent({ key: a.key, name: a.name, color: a.color })}>
                {a.name} - {capabilityStateLabel(
                  capabilityRuntime[a.key as AstraCapabilityNodeKey].state,
                )} - {INFO[a.key]?.role ?? "Specialist"}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* the core - painted ABOVE the web (app order); display-only, the tap target
          is the circular disc below so agent nodes near the ring stay clickable */}
      <div style={{ position: "absolute", left: "50%", top: "50%", width: "min(560px, 58vw)", height: "min(500px, 56vw, 70vh)", transform: "translate(-50%, -50%)", zIndex: 3, pointerEvents: "none" }}>
        <ApexHeroOrb state={orbState} interactive={false} />
      </div>

      {/* central tap disc - covers the ring only (nodes orbit outside it) */}
      <div
        role="button"
        tabIndex={0}
        aria-label="ASTRA core - tap to energize"
        onClick={boost}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); boost(); } }}
        onMouseDown={(e) => e.preventDefault()}
        style={{
          position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
          width: "min(340px, 36vw)", height: "min(340px, 36vw)", borderRadius: "50%",
          zIndex: 4, cursor: "pointer", background: "transparent", border: "none", userSelect: "none",
        }}
      />

      {/* equalizer + STANDBY cluster */}
      <OrbStatusBar state={orbState} />

      <aside
        aria-label="ASTRA Brain activity"
        style={{
          position: "absolute",
          top: 88,
          right: 22,
          zIndex: 6,
          width: "min(280px, 30vw)",
          minWidth: 220,
          padding: "11px 12px",
          border: "1px solid rgba(0,229,255,.18)",
          borderRadius: 12,
          background: "rgba(4,10,18,.72)",
          color: "rgba(230,249,255,.72)",
          fontFamily: "var(--font-mono)",
          fontSize: 9.5,
          letterSpacing: ".04em",
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 5 }}>
          <span style={{ color: "#71efff", letterSpacing: ".16em" }}>ASTRA BRAIN</span>
          <span
            style={{
              color:
                runtime.brainProvider === "hermes"
                  ? "#8ef6b8"
                  : runtime.brainProvider === "ollama"
                    ? "#63eaff"
                    : runtime.brainProvider === "codex"
                      ? "#d7a2ff"
                      : runtime.brainProvider === "cloud"
                        ? "#ffb96b"
                        : runtime.brainProvider === "routing_only"
                          ? "#ffbf69"
                          : "rgba(255,255,255,.34)",
            }}
          >
            {(runtime.brainProvider ?? "standby").toUpperCase()}
          </span>
        </div>
        <div
          style={{
            marginBottom: 5,
            color: "rgba(215,244,250,.42)",
            fontSize: 8.5,
            letterSpacing: ".07em",
          }}
        >
          {runtime.brainStatus
            ? `${runtime.brainStatus.mode.toUpperCase()} · ${runtime.brainStatus.model ?? "ROUTER"}`
            : "CHECKING LOCAL BRAIN..."}
          {" · "}
          <span style={{ color: runtime.brainStreaming ? "#83ffbc" : "rgba(215,244,250,.34)" }}>
            SSE {runtime.brainStreaming ? "LIVE" : "IDLE"}
          </span>
        </div>
        {runtime.brainStatus?.features && (
          <div
            style={{
              marginBottom: 8,
              display: "flex",
              flexWrap: "wrap",
              gap: "3px 7px",
              color: "rgba(215,244,250,.34)",
              fontSize: 7.8,
              letterSpacing: ".06em",
            }}
          >
            {([
              ["MEM", runtime.brainStatus.features.memory],
              ["SKILL", runtime.brainStatus.features.skills],
              ["CODEX", runtime.brainStatus.features.codex],
              ["INT", runtime.brainStatus.features.integrations],
              ["CREATIVE", runtime.brainStatus.features.creative],
              ["PC", runtime.brainStatus.features.computer],
              ["MM", runtime.brainStatus.features.multimodal],
              ["TOOLS", runtime.brainStatus.features.tools],
              ["CLOUD", runtime.brainStatus.features.cloud],
            ] as const).map(([label, feature]) => (
              <span
                key={label}
                style={{
                  color: feature.available
                    ? "#83ffbc"
                    : feature.enabled
                      ? "#ffbf69"
                      : "rgba(215,244,250,.28)",
                }}
              >
                {label}:{feature.state ?? (feature.available ? "READY" : feature.enabled ? "WAIT" : "OFF")}
              </span>
            ))}
          </div>
        )}

        {currentInput && (
          <div
            style={{
              marginBottom: 8,
              padding: "6px 7px",
              border: "1px solid rgba(99,234,255,.10)",
              borderRadius: 7,
              background: "rgba(99,234,255,.025)",
              color: "rgba(215,244,250,.48)",
              fontSize: 7.8,
              lineHeight: 1.45,
            }}
          >
            INPUT · {currentInput.source.toUpperCase()} · {currentInput.trigger.replace(/_/g, " ").toUpperCase()}
            <br />
            MODALITY · {currentInput.modalities.join(" + ").toUpperCase()} · VISUAL PIXELS: NO
          </div>
        )}

        {currentPlan && (
          <div
            style={{
              marginBottom: 8,
              padding: "7px 8px",
              border: "1px solid rgba(215,162,255,.14)",
              borderRadius: 8,
              background: "rgba(215,162,255,.03)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
              <span style={{ color: "#d7a2ff", letterSpacing: ".12em", fontSize: 8 }}>
                PLAN
              </span>
              <span style={{ color: "rgba(235,252,255,.52)", fontSize: 8 }}>
                {completedPlanSteps}/{currentPlan.steps.length} · {currentPlan.status.toUpperCase()}
              </span>
            </div>
            <div style={{ display: "grid", gap: 3 }}>
              {currentPlan.steps.slice(0, 5).map((step) => (
                <div
                  key={step.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "7px 1fr auto",
                    gap: 5,
                    alignItems: "start",
                    fontSize: 7.7,
                    lineHeight: 1.35,
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      marginTop: 3,
                      background:
                        step.status === "completed"
                          ? "#83ffbc"
                          : step.status === "running"
                            ? "#63eaff"
                            : step.status === "waiting_approval"
                              ? "#f5b942"
                              : step.status === "failed"
                                ? "#ff5f6d"
                                : step.status === "cancelled"
                                  ? "#ff9d66"
                                  : "rgba(215,244,250,.28)",
                    }}
                  />
                  <span style={{ color: "rgba(235,252,255,.62)" }}>{step.title}</span>
                  <span style={{ color: "rgba(215,244,250,.34)" }}>{step.status.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {approvalRequest && (
          <div
            style={{
              marginBottom: 8,
              padding: "6px 7px",
              border: "1px solid rgba(245,185,66,.24)",
              borderRadius: 7,
              background: "rgba(245,185,66,.05)",
              color: "#f5b942",
              fontSize: 8,
              lineHeight: 1.45,
            }}
          >
            WAITING APPROVAL · LEVEL {approvalRequest.level}
            <br />
            {approvalRequest.title} · {approvalRequest.toolId}
          </div>
        )}

        <div style={{ marginBottom: 4, color: "rgba(215,244,250,.34)", fontSize: 7.6, letterSpacing: ".12em" }}>
          LIVE TIMELINE
        </div>
        <div style={{ display: "grid", gap: 5 }}>
          {runtime.brainEvents.length === 0 ? (
            <div style={{ color: "rgba(220,244,250,.38)" }}>No brain events yet.</div>
          ) : (
            runtime.brainEvents.slice(-8).map((event) => (
              <div
                key={event.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "7px 1fr",
                  gap: 7,
                  alignItems: "start",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    marginTop: 3,
                    background:
                      event.type === "agent.blocked" || event.type === "plan.cancelled"
                        ? "#ff9d66"
                        : event.type === "tool.failed" || event.type === "plan.step.failed"
                          ? "#ff5f6d"
                          : event.type === "approval.requested"
                            ? "#f5b942"
                            : event.type === "agent.completed" || event.type === "response.ready"
                              ? "#83ffbc"
                              : event.type === "provider.selected" || event.type === "skill.selected"
                                ? "#d7a2ff"
                                : event.type === "memory.loaded"
                                  ? "#6fffd4"
                                  : event.type === "policy.applied"
                                    ? "#9aaeb8"
                                    : "#63eaff",
                  }}
                />
                <span>
                  <strong style={{ color: "rgba(235,252,255,.82)", fontWeight: 500 }}>
                    {event.label}
                  </strong>
                  {event.agent ? " · " + event.agent.replace(/_/g, " ") : ""}
                  <span style={{ display: "block", marginTop: 1, color: "rgba(215,244,250,.31)", fontSize: 7.4 }}>
                    {event.type}
                  </span>
                </span>
              </div>
            ))
          )}
        </div>
      </aside>

      {selected && (
        <AgentOverview
          sel={selected}
          onClose={() => setSelected(null)}
          statusOverride={selectedRuntime?.state}
          statusDetail={selectedRuntime?.detail}
        />
      )}
    </div>
  );
}
