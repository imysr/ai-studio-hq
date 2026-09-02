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
    const latestTasks = getTasks();

    const latestTask = latestTasks.find((item) => item.id === task.id);

    if (!latestTask || latestTask.status !== "Pending") {
      continue;
    }

    const dependencies: number[] = latestTask.dependsOn ?? [];

    if (dependencies.length === 0) {
      startAgentTask(latestTask.id);
      startedTasks.push(latestTask.id);
      continue;
    }

    const dependenciesCompleted = dependencies.every((dependencyId: number) => {
      const dependencyTask = latestTasks.find(
        (item) => item.id === dependencyId,
      );

      return dependencyTask?.status === "Completed";
    });

    if (!dependenciesCompleted) {
      blockedTasks.push(latestTask.id);
      continue;
    }

    startAgentTask(latestTask.id);
    startedTasks.push(latestTask.id);
  }

  /*
    STEP 2
    Process Working tasks at 50%.

    After each completion, dependencies
    are checked again so the workflow can
    continue without /core being open.
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

    const refreshedTasks = getTasks();

    const pendingAfterCompletion = refreshedTasks.filter(
      (task) => task.status === "Pending",
    );

    for (const task of pendingAfterCompletion) {
      const dependencies: number[] = task.dependsOn ?? [];

      const dependenciesCompleted = dependencies.every(
        (dependencyId: number) => {
          const dependencyTask = refreshedTasks.find(
            (item) => item.id === dependencyId,
          );

          return dependencyTask?.status === "Completed";
        },
      );

      if (dependencies.length === 0 || dependenciesCompleted) {
        startAgentTask(task.id);

        if (!startedTasks.includes(task.id)) {
          startedTasks.push(task.id);
        }

        keepProcessing = true;
      }
    }

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
    Final blocked-task check.
  */

  const finalTasks = getTasks();

  const stillBlocked = finalTasks.filter((task) => {
    if (task.status !== "Pending") {
      return false;
    }

    const dependencies: number[] = task.dependsOn ?? [];

    if (dependencies.length === 0) {
      return false;
    }

    return !dependencies.every((dependencyId: number) => {
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
