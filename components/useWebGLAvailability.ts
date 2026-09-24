"use client";

import { useEffect, useState } from "react";
import { probeWebGL2 } from "@/lib/performance/webgl-availability";

export function useWebGLAvailability() {
  const [state, setState] = useState<"checking" | "available" | "unavailable">("checking");
  useEffect(() => {
    setState(probeWebGL2(() => document.createElement("canvas")) ? "available" : "unavailable");
  }, []);
  // No render-driven retries: text streaming/state changes must not repeatedly
  // recreate a blocked GPU context. A page reload can retry after GPU recovery.
  return state;
}
