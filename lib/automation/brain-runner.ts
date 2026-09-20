import { astraBrain } from "@/lib/brain/adapter";
import type { AstraAutomationRunner } from "./contracts";

export const automationBrainRunner: AstraAutomationRunner = {
  async chat(prompt, options) {
    return astraBrain.chat(prompt, options);
  },
  async execute(task, options) {
    return astraBrain.execute(task, options);
  },
};
