"use client";

import { useState } from "react";
import HumanoidLabV9 from "./lab/HumanoidLabV9";

export default function AstraHumanoidPortal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open ASTRA humanoid"
        style={{
          position: "absolute",
          top: 16,
          right: "clamp(150px, 13vw, 190px)",
          zIndex: 45,
          border: "1px solid rgba(61,229,246,.35)",
          borderRadius: 20,
          padding: "7px 14px",
          background: "rgba(4,8,15,.6)",
          color: "#7defff",
          backdropFilter: "blur(8px)",
          fontFamily: "var(--font-mono)",
          fontSize: ".64rem",
          letterSpacing: ".2em",
          cursor: "pointer",
        }}
      >
        HUMANOID
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="ASTRA Humanoid"
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#000306" }}
        >
          <HumanoidLabV9 onExit={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
