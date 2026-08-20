import { getTasks } from "@/lib/taskStorage";
import { startAgentTask, completeAgentTask } from "@/lib/workEngine";

export async function runAIScheduler() {
  const tasks = getTasks();

  const pendingTasks = tasks.filter((task) => task.status === "Pending");

  const workingTasks = tasks.filter(
    (task) => task.status === "Working" && task.progress === 50,
  );

  const startedTasks: number[] = [];
  const completedTasks: number[] = [];

  /*
    START PENDING TASKS
  */

  pendingTasks.forEach((task) => {
    startAgentTask(task.id);

    startedTasks.push(task.id);
  });

  /*
    COMPLETE WORKING TASKS

    Forge may need to wait for Gemini,
    so we process these asynchronously.
  */

  for (const task of workingTasks) {
    await completeAgentTask(task.id);

    completedTasks.push(task.id);
  }

  if (startedTasks.length === 0 && completedTasks.length === 0) {
    return {
      message: "No active AI tasks",

      startedTasks: [],

      completedTasks: [],
    };
  }

  return {
    message:
      `Started ${startedTasks.length} task(s), ` +
      `processed ${completedTasks.length} working task(s)`,

    startedTasks,

    completedTasks,
  };
}
