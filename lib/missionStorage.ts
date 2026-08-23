import type { Mission } from "@/data/missions";
import type { MissionTask } from "@/data/tasks";

const STORAGE_KEY = "ai_missions";

const TASK_STORAGE_KEY = "ai_studio_tasks";

/*
  GET MISSIONS

  localStorage remains the immediate
  client-side source during migration.
*/

export function getMissions(): Mission[] {
  if (typeof window === "undefined") {
    return [];
  }

  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {
    return [];
  }

  try {
    return JSON.parse(data) as Mission[];
  } catch {
    return [];
  }
}

/*
  READ CURRENT TASKS DIRECTLY

  We intentionally avoid importing
  taskEngine here because taskEngine
  already depends on taskStorage.

  Keeping this calculation local avoids
  unnecessary circular dependencies.
*/

function getStoredTasks(): MissionTask[] {
  if (typeof window === "undefined") {
    return [];
  }

  const saved = localStorage.getItem(TASK_STORAGE_KEY);

  if (!saved) {
    return [];
  }

  try {
    return JSON.parse(saved) as MissionTask[];
  } catch {
    return [];
  }
}

/*
  DERIVE LIVE MISSION STATE

  Completed task count is the source
  of truth, matching taskEngine.ts.
*/

function getMissionState(missionId: number) {
  const tasks = getStoredTasks();

  const missionTasks = tasks.filter((task) => task.missionId === missionId);

  if (missionTasks.length === 0) {
    return {
      progress: 0,

      status: "Planning" as const,
    };
  }

  const completedTasks = missionTasks.filter(
    (task) => task.status === "Completed",
  ).length;

  const progress = Math.round((completedTasks / missionTasks.length) * 100);

  const status =
    progress === 100 ? "Completed" : progress === 0 ? "Planning" : "Active";

  return {
    progress,

    status,
  };
}

/*
  SAVE MISSIONS

  1. Save to localStorage.
  2. Derive latest progress/status.
  3. Synchronize to Supabase.

  Supabase failure must NOT break
  the local app during migration.
*/

export function saveMissions(missions: Mission[]) {
  if (typeof window === "undefined") {
    return;
  }

  /*
    KEEP THE LOCAL MISSION OBJECTS
    UP TO DATE TOO.
  */

  const synchronizedMissions = missions.map((mission) => {
    const state = getMissionState(mission.id);

    return {
      ...mission,

      progress: state.progress,

      status: state.status,
    };
  });

  /*
    LOCAL PERSISTENCE
  */

  localStorage.setItem(STORAGE_KEY, JSON.stringify(synchronizedMissions));

  /*
    DATABASE SYNCHRONIZATION
  */

  void syncMissionsToSupabase(synchronizedMissions);
}

/*
  SUPABASE MISSION SYNC
*/

async function syncMissionsToSupabase(missions: Mission[]) {
  if (missions.length === 0) {
    return;
  }

  try {
    const response = await fetch("/api/missions", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(missions),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);

      console.error("Supabase mission synchronization failed:", data);

      return;
    }

    const data = await response.json();

    console.log(
      `Supabase synchronized ${data.synced ?? missions.length} mission(s).`,
    );
  } catch (error) {
    console.error("Supabase mission synchronization error:", error);
  }
}
