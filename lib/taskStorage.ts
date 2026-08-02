import { MissionTask, defaultTasks } from "@/data/tasks";

const STORAGE_KEY = "ai_studio_tasks";

export function getTasks(): MissionTask[] {
  if (typeof window === "undefined") {
    return defaultTasks;
  }

  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultTasks));

    return defaultTasks;
  }

  return JSON.parse(saved);
}

export function saveTasks(tasks: MissionTask[]) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}
