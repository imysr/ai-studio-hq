import type { MissionTask } from "@/data/tasks";

export type DelegatedTask = {
  assignedAgent: number;

  title: string;

  description: string;
};

export function generateMissionTasks(
  missionId: number,
  delegatedTasks: DelegatedTask[],
): MissionTask[] {
  const baseId = Date.now();

  return delegatedTasks.map((task, index) => ({
    id: baseId + index + 1,

    missionId,

    title: task.title,

    description: task.description,

    assignedAgent: task.assignedAgent,

    status: "Pending",

    progress: 0,

    result: "",
  }));
}
