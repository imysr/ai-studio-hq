import { getTasks } from "@/lib/taskStorage";
import { startAgentTask, completeAgentTask } from "@/lib/workEngine";

export async function runAIScheduler() {
  const startedTasks: number[] = [];

  const completedTasks: number[] = [];

  const blockedTasks: number[] = [];

  /*
    STEP 1
    Start every Pending task whose
    dependencies are already complete.
  */

  const initialTasks = getTasks();

  const pendingTasks = initialTasks.filter((task) => task.status === "Pending");

  for (const task of pendingTasks) {
    /*
      Refresh task state before checking
      this task so we do not rely on an
      old scheduler snapshot.
    */

    const latestTasks = getTasks();

    const latestTask = latestTasks.find((item) => item.id === task.id);

    if (!latestTask || latestTask.status !== "Pending") {
      continue;
    }

    const dependencies = latestTask.dependsOn ?? [];

    /*
      No dependencies means the task
      is immediately ready.
    */

    if (dependencies.length === 0) {
      startAgentTask(latestTask.id);

      startedTasks.push(latestTask.id);

      continue;
    }

    /*
      Every dependency must exist and
      already be Completed.
    */

    const dependenciesCompleted = dependencies.every((dependencyId) => {
      const dependencyTask = latestTasks.find(
        (item) => item.id === dependencyId,
      );

      return dependencyTask?.status === "Completed";
    });

    if (!dependenciesCompleted) {
      blockedTasks.push(latestTask.id);

      continue;
    }

    /*
      Dependency chain is satisfied.
    */

    startAgentTask(latestTask.id);

    startedTasks.push(latestTask.id);
  }

  /*
    STEP 2
    Process tasks that are Working at 50%.

    We refresh after every AI completion
    because finishing one task may unlock
    another task in the same mission.
  */

  let keepProcessing = true;

  while (keepProcessing) {
    keepProcessing = false;

    const currentTasks = getTasks();

    const workingTask = currentTasks.find(
      (task) => task.status === "Working" && task.progress === 50,
    );

    if (!workingTask) {
      break;
    }

    await completeAgentTask(workingTask.id);

    completedTasks.push(workingTask.id);

    /*
      After an AI task finishes, check
      whether any Pending task has now
      become ready because its dependencies
      were satisfied.
    */

    const refreshedTasks = getTasks();

    const pendingAfterCompletion = refreshedTasks.filter(
      (task) => task.status === "Pending",
    );

    for (const task of pendingAfterCompletion) {
      const dependencies = task.dependsOn ?? [];

      const dependenciesCompleted = dependencies.every((dependencyId) => {
        const dependencyTask = refreshedTasks.find(
          (item) => item.id === dependencyId,
        );

        return dependencyTask?.status === "Completed";
      });

      if (dependencies.length === 0 || dependenciesCompleted) {
        startAgentTask(task.id);

        if (!startedTasks.includes(task.id)) {
          startedTasks.push(task.id);
        }

        keepProcessing = true;
      }
    }

    /*
      There may also still be another
      Working 50% task already waiting
      to be processed.
    */

    const nextTasks = getTasks();

    if (
      nextTasks.some(
        (task) => task.status === "Working" && task.progress === 50,
      )
    ) {
      keepProcessing = true;
    }
  }

  /*
    STEP 3
    Final blocked-task check for reporting.
  */

  const finalTasks = getTasks();

  const stillBlocked = finalTasks.filter((task) => {
    if (task.status !== "Pending") {
      return false;
    }

    const dependencies = task.dependsOn ?? [];

    if (dependencies.length === 0) {
      return false;
    }

    return !dependencies.every((dependencyId) => {
      const dependencyTask = finalTasks.find(
        (item) => item.id === dependencyId,
      );

      return dependencyTask?.status === "Completed";
    });
  });

  blockedTasks.splice(
    0,
    blockedTasks.length,
    ...stillBlocked.map((task) => task.id),
  );

  /*
    NOTHING CHANGED
  */

  if (startedTasks.length === 0 && completedTasks.length === 0) {
    return {
      message:
        blockedTasks.length > 0
          ? `${blockedTasks.length} task(s) waiting for dependencies`
          : "No active AI tasks",

      startedTasks: [],

      completedTasks: [],

      blockedTasks,
    };
  }

  return {
    message:
      `Started ${startedTasks.length} task(s), ` +
      `processed ${completedTasks.length} working task(s), ` +
      `${blockedTasks.length} task(s) waiting`,

    startedTasks,

    completedTasks,

    blockedTasks,
  };
}
