import { getTasks } from "@/lib/taskStorage";
import { startAgentTask } from "@/lib/workEngine";

export function runAIScheduler() {
  const tasks = getTasks();

  const pendingTasks = tasks.filter((task) => task.status === "Pending");

  if (pendingTasks.length === 0) {
    return {
      message: "No pending tasks",
    };
  }

  const startedTasks: number[] = [];

  pendingTasks.forEach((task) => {
    startAgentTask(task.id);

    startedTasks.push(task.id);
  });

  return {
    message: `Started ${startedTasks.length} AI tasks`,

    tasks: startedTasks,
  };
}
