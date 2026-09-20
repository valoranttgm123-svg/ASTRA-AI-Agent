export type AstraProjectStatus = "active" | "paused" | "archived";

export type AstraProjectIntegration = {
  id: string;
  kind: string;
  configured: boolean;
};

export type AstraProjectRecord = {
  id: string;
  name: string;
  aliases: string[];
  workspace?: string;
  repositories: string[];
  docs: string[];
  memoryNamespace: string;
  goals: string[];
  status: AstraProjectStatus;
  currentMilestone?: string;
  lastActivity?: string;
  openTasks: string[];
  importantFiles: string[];
  integrations: AstraProjectIntegration[];
};

export type AstraProjectRegistryContext = {
  enabled: boolean;
  available: boolean;
  source: string;
  projects: AstraProjectRecord[];
  detail: string;
};

export type AstraProjectMatch = {
  project: AstraProjectRecord;
  score: number;
  reason: "id" | "name" | "alias" | "recent";
};
