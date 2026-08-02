import { getTasks, saveTasks } from "@/lib/taskStorage";
import { saveActivity } from "@/lib/activityMemory";
import { getAgentMemory, saveAgentMemory } from "@/lib/agentMemory";
import { agents } from "@/data/agents";
import { MissionTask } from "@/data/tasks";

export function startAgentTask(taskId: number) {
  const tasks = getTasks();

  const updatedTasks: MissionTask[] = tasks.map((task): MissionTask => {
    if (task.id === taskId) {
      const agent = agents.find((a) => a.id === task.assignedAgent);

      saveActivity({
        id: Date.now(),

        time: new Date().toLocaleTimeString(),

        icon: agent?.emoji ?? "⚙️",

        message: `${agent?.name ?? "AI Agent"} started ${task.title}`,
      });

      updateAgentMemory(task, "Working");

      return {
        ...task,

        status: "Working" as const,

        progress: 50,
      };
    }

    return task;
  });

  saveTasks(updatedTasks);
}

export function completeAgentTask(taskId: number) {
  const tasks = getTasks();

  const updatedTasks: MissionTask[] = tasks.map((task): MissionTask => {
    if (task.id === taskId) {
      const agent = agents.find((a) => a.id === task.assignedAgent);

      saveActivity({
        id: Date.now(),

        time: new Date().toLocaleTimeString(),

        icon: "✅",

        message: `${agent?.name ?? "AI Agent"} completed ${task.title}`,
      });

      updateAgentMemory(task, "Completed");

      return {
        ...task,

        status: "Completed" as const,

        progress: 100,
      };
    }

    return task;
  });

  saveTasks(updatedTasks);
}

function updateAgentMemory(task: MissionTask, status: string) {
  const memory = getAgentMemory();

  const updated = memory.map((agent) => {
    if (agent.id === task.assignedAgent) {
      return {
        ...agent,

        currentTask:
          status === "Completed" ? "Waiting for assignment" : task.title,

        missionStatus: status === "Completed" ? "Idle" : "Working",

        location: status === "Completed" ? "Office" : "AI Core Meeting Room",

        energy: status === "Completed" ? 100 : 90,

        lastAction:
          status === "Completed"
            ? `Completed ${task.title}`
            : `Started ${task.title}`,
      };
    }

    return agent;
  });

  saveAgentMemory(updated);
}
