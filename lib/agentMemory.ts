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

/*
  SAVE AGENT MEMORY

  During migration:
  1. localStorage remains immediate.
  2. the same memory state syncs to
     Supabase in the background.
*/

export function saveAgentMemory(agentsMemory: AgentMemory[]) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(agentsMemory));

  void syncAgentMemoryToSupabase(agentsMemory);
}

/*
  LOAD AGENT MEMORY FROM SUPABASE

  Supabase is now the preferred
  persistent source of agent state.

  localStorage remains a temporary
  cache so the existing synchronous
  work engine can continue using
  getAgentMemory().
*/

export async function loadAgentMemoryFromSupabase(): Promise<AgentMemory[]> {
  try {
    const response = await fetch("/api/agent-memory", {
      method: "GET",
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);

      console.error("Supabase agent memory load failed:", data);

      return getAgentMemory();
    }

    const data = await response.json();

    if (!Array.isArray(data.agents)) {
      return getAgentMemory();
    }

    const memories = data.agents.map(
      (memory: {
        agent_id: number;
        current_task: string;
        mission_status: string;
        location: string;
        energy: number;
        last_action: string;
      }): AgentMemory => ({
        id: memory.agent_id,

        currentTask: memory.current_task,

        missionStatus: memory.mission_status,

        location: memory.location,

        energy: memory.energy ?? 100,

        lastAction: memory.last_action,
      }),
    );

    /*
      TEMPORARY LOCAL CACHE

      Existing synchronous systems
      continue working while Supabase
      becomes the persistent source.
    */

    localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));

    return memories;
  } catch (error) {
    console.error("Supabase agent memory load error:", error);

    return getAgentMemory();
  }
}

/*
  GET AGENT MEMORY
*/

export function getAgentMemory(): AgentMemory[] {
  if (typeof window === "undefined") {
    return defaultMemory;
  }

  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultMemory));

    return defaultMemory;
  }

  try {
    return JSON.parse(data) as AgentMemory[];
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultMemory));

    return defaultMemory;
  }
}

/*
  SUPABASE AGENT MEMORY SYNC
*/

async function syncAgentMemoryToSupabase(memories: AgentMemory[]) {
  if (memories.length === 0) {
    return;
  }

  try {
    const response = await fetch("/api/agent-memory", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(memories),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);

      console.error("Supabase agent memory synchronization failed:", data);

      return;
    }

    const data = await response.json();

    console.log(
      `Supabase synchronized ${
        data.synced ?? memories.length
      } agent memory record(s).`,
    );
  } catch (error) {
    console.error("Supabase agent memory synchronization error:", error);
  }
}
