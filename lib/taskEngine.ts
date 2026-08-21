import { getTasks } from "@/lib/taskStorage";

export function calculateMissionProgress(missionId: number) {
  const tasks = getTasks();

  const missionTasks = tasks.filter((task) => task.missionId === missionId);

  if (missionTasks.length === 0) {
    return 0;
  }

  const completedTasks = missionTasks.filter(
    (task) => task.status === "Completed",
  ).length;

  const progress = Math.round((completedTasks / missionTasks.length) * 100);

  return progress;
}

export function calculateMissionStatus(
  missionId: number,
): "Planning" | "Active" | "Completed" {
  const progress = calculateMissionProgress(missionId);

  if (progress === 0) {
    return "Planning";
  }

  if (progress === 100) {
    return "Completed";
  }

  return "Active";
}
