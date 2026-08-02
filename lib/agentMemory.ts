import { agents } from "@/data/agents";

export type AgentMemory = {
  id: number;

  currentTask: string;

  missionStatus: string;

  location: string;

  energy: number;

  lastAction: string;
};

const STORAGE_KEY = "agentMemory";

const defaultMemory: AgentMemory[] = agents.map((agent) => ({
  id: agent.id,

  currentTask: "Waiting for assignment",

  missionStatus: "Idle",

  location: "Office",

  energy: 100,

  lastAction: "No active mission",
}));

export function saveAgentMemory(agentsMemory: AgentMemory[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agentsMemory));
  }
}

export function getAgentMemory(): AgentMemory[] {
  if (typeof window === "undefined") {
    return defaultMemory;
  }

  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultMemory));

    return defaultMemory;
  }

  return JSON.parse(data);
}
