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

/*
  LOAD TASKS FROM SUPABASE

  Supabase is now the preferred
  persistent source of mission tasks.

  localStorage remains available as
  a temporary cache and fallback
  while the migration is completed.
*/

export async function loadTasksFromSupabase(): Promise<MissionTask[]> {
  try {
    const response = await fetch("/api/tasks", {
      method: "GET",
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);

      console.error("Supabase task load failed:", data);

      return getTasks();
    }

    const data = await response.json();

    if (!Array.isArray(data.tasks)) {
      return getTasks();
    }

    const tasks = data.tasks.map(
      (task: {
        id: number;
        mission_id: number;
        title: string;
        description: string;
        assigned_agent: number;
        status: MissionTask["status"];
        progress: number;
        result?: string | null;
        depends_on?: number[];
        context_from_tasks?: number[];
      }): MissionTask => ({
        id: task.id,

        missionId: task.mission_id,

        title: task.title,

        description: task.description,

        assignedAgent: task.assigned_agent,

        status: task.status,

        progress: task.progress ?? 0,

        result: task.result ?? "",

        dependsOn: task.depends_on ?? [],

        contextFromTasks: task.context_from_tasks ?? [],
      }),
    );

    /*
      TEMPORARY LOCAL CACHE

      Existing synchronous systems such
      as taskEngine and workEngine can
      continue calling getTasks().
    */

    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));

    return tasks;
  } catch (error) {
    console.error("Supabase task load error:", error);

    return getTasks();
  }
}
