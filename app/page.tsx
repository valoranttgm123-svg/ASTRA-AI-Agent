import ApexWorld from "@/components/ApexWorld";
import ApexOverviewPanel from "@/components/ApexOverviewPanel";
import AstraConsole from "@/components/AstraConsole";
import AstraAutomationPanel from "@/components/AstraAutomationPanel";
import AstraHumanoidPortal from "@/components/AstraHumanoidPortal";
import { AstraRuntimeProvider } from "@/components/AstraRuntime";
import UiPerformanceProbe from "@/components/UiPerformanceProbe";
import AstraOperationsPanel from "@/components/AstraOperationsPanel";

export default function Home() {
  return (
    <AstraRuntimeProvider>
      <main
        id="main"
        style={{ background: "#04080f", color: "#f0ede8", position: "relative", overflow: "hidden" }}
      >
        <ApexOverviewPanel />

        <section style={{ position: "relative", height: "100vh", minHeight: 620 }}>
          <ApexWorld />
        </section>

        <AstraConsole />
        <AstraAutomationPanel />
        <AstraOperationsPanel />
        <AstraHumanoidPortal />
        <UiPerformanceProbe />

        <a
          href="https://github.com/valoranttgm123-svg/ASTRA-AI-Agent"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: "absolute", top: 16, right: "clamp(16px,3vw,40px)", zIndex: 40,
            fontFamily: "var(--font-mono)", fontSize: "0.66rem", letterSpacing: "0.24em",
            textTransform: "uppercase", color: "rgba(240,237,232,0.7)", textDecoration: "none",
            border: "1px solid rgba(240,237,232,0.2)", borderRadius: 20, padding: "7px 15px",
            background: "rgba(4,8,15,0.5)", backdropFilter: "blur(6px)",
          }}
        >
          ASTRA SOURCE ↗
        </a>
      </main>
    </AstraRuntimeProvider>
  );
}
