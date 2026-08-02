import { defaultTasks, MissionTask } from "@/data/tasks";

export function getMissionProgress(missionId: number) {
  const tasks = defaultTasks.filter((task) => task.missionId === missionId);

  if (tasks.length === 0) {
    return 0;
  }

  const total = tasks.reduce(
    (sum, task) => sum + task.progress,

    0,
  );

  return Math.round(total / tasks.length);
}

export function getMissionTasks(missionId: number): MissionTask[] {
  return defaultTasks.filter((task) => task.missionId === missionId);
}
