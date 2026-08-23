import { MissionTask, defaultTasks } from "@/data/tasks";

const STORAGE_KEY = "ai_studio_tasks";

/*
  GET TASKS

  localStorage remains the immediate
  client-side source during migration.
*/

export function getTasks(): MissionTask[] {
  if (typeof window === "undefined") {
    return defaultTasks;
  }

  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultTasks));

    return defaultTasks;
  }

  try {
    return JSON.parse(saved) as MissionTask[];
  } catch {
    return defaultTasks;
  }
}

/*
  SAVE TASKS

  1. Save immediately to localStorage.
  2. Synchronize the same tasks to
     Supabase through our secure API.

  Supabase failure does NOT break
  the local application during migration.
*/

export function saveTasks(tasks: MissionTask[]) {
  if (typeof window === "undefined") {
    return;
  }

  /*
    LOCAL PERSISTENCE
  */

  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));

  /*
    DATABASE SYNCHRONIZATION

    Do not await this request.

    saveTasks() is used throughout the
    synchronous task engine, so changing
    it to async would force unnecessary
    changes across the entire application.
  */

  void syncTasksToSupabase(tasks);
}

/*
  SUPABASE TASK SYNC
*/

async function syncTasksToSupabase(tasks: MissionTask[]) {
  if (tasks.length === 0) {
    return;
  }

  try {
    const response = await fetch("/api/tasks", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(tasks),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);

      console.error("Supabase task synchronization failed:", data);

      return;
    }

    console.log(`Supabase synchronized ${tasks.length} task(s).`);
  } catch (error) {
    /*
      Database/network failure must
      never stop the local task engine.
    */

    console.error("Supabase task synchronization error:", error);
  }
}
