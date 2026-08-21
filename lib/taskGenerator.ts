import type { MissionTask } from "@/data/tasks";

export type DelegatedTask = {
  assignedAgent: number;

  title: string;

  description: string;

  /*
    Optional dependency indexes.

    These refer to OTHER delegated tasks
    inside Valid's generated task array.

    Example:
    dependsOnTaskIndexes: [0, 1]

    means:
    this task waits for delegated tasks
    #0 and #1 to complete.
  */

  dependsOnTaskIndexes?: number[];

  /*
    Optional context indexes.

    Results from these delegated tasks
    will later be passed into this agent
    as collaboration context.
  */

  contextFromTaskIndexes?: number[];
};

export function generateMissionTasks(
  missionId: number,
  delegatedTasks: DelegatedTask[],
): MissionTask[] {
  const baseId = Date.now();

  /*
    First create stable real task IDs.

    We need these IDs before converting
    Valid's dependency indexes into
    actual MissionTask IDs.
  */

  const generatedIds = delegatedTasks.map((_, index) => baseId + index + 1);

  return delegatedTasks.map((task, index) => {
    const dependsOn =
      task.dependsOnTaskIndexes
        ?.map((dependencyIndex) => generatedIds[dependencyIndex])
        .filter((taskId): taskId is number => typeof taskId === "number") ?? [];

    const contextFromTasks =
      task.contextFromTaskIndexes
        ?.map((contextIndex) => generatedIds[contextIndex])
        .filter((taskId): taskId is number => typeof taskId === "number") ?? [];

    return {
      id: generatedIds[index],

      missionId,

      title: task.title,

      description: task.description,

      assignedAgent: task.assignedAgent,

      status: "Pending",

      progress: 0,

      result: "",

      dependsOn,

      contextFromTasks,
    };
  });
}
