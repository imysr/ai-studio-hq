import { defaultTasks, type MissionTask } from "@/data/tasks";
import { waitForMissionSync } from "@/lib/missionStorage";

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

  Save locally immediately, then synchronize
  to Supabase after the newest mission sync
  has finished. This prevents FK races when
  a brand-new mission and its tasks are
  created almost simultaneously.
*/

export function saveTasks(tasks: MissionTask[]) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));

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
    await waitForMissionSync();

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

    const data = await response.json();

    console.log(
      `Supabase synchronized ${data.synced ?? tasks.length} task(s).`,
    );
  } catch (error) {
    console.error("Supabase task synchronization error:", error);
  }
}

/*
  LOAD TASKS FROM SUPABASE
*/

export async function loadTasksFromSupabase(): Promise<MissionTask[]> {
  try {
    const response = await fetch("/api/tasks", {
      method: "GET",
      cache: "no-store",
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

    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));

    return tasks;
  } catch (error) {
    console.error("Supabase task load error:", error);

    return getTasks();
  }
}
