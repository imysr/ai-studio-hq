import { getTasks } from "@/lib/taskStorage";
import { startAgentTask, completeAgentTask } from "@/lib/workEngine";

export function runAIScheduler() {
  const tasks = getTasks();

  const pendingTasks = tasks.filter((task) => task.status === "Pending");

  const workingTasks = tasks.filter((task) => task.status === "Working");

  const startedTasks: number[] = [];

  const completedTasks: number[] = [];

  pendingTasks.forEach((task) => {
    startAgentTask(task.id);

    startedTasks.push(task.id);
  });

  workingTasks.forEach((task) => {
    completeAgentTask(task.id);

    completedTasks.push(task.id);
  });

  if (startedTasks.length === 0 && completedTasks.length === 0) {
    return {
      message: "No active AI tasks",
      startedTasks: [],
      completedTasks: [],
    };
  }

  return {
    message: `Started ${startedTasks.length} task(s), completed ${completedTasks.length} task(s)`,

    startedTasks,

    completedTasks,
  };
}
