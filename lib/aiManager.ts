import type { Mission } from "@/data/missions";
import type { MissionTask } from "@/data/tasks";
import { saveActivity } from "@/lib/activityMemory";
import { agents } from "@/data/agents";

export function recordMissionAnalysis(mission: Mission) {
  saveActivity({
    id: Date.now(),

    time: new Date().toLocaleTimeString(),

    icon: "🧠",

    message: `Valid analysed mission: ${mission.title}`,
  });
}

export function createManagerReport(mission: Mission, tasks: MissionTask[]) {
  return {
    title: `Mission Report: ${mission.title}`,

    summary: `Valid prepared ${tasks.length} delegated task(s) for the AI team.`,

    tasks: tasks.map((task) => {
      const agent = agents.find((item) => item.id === task.assignedAgent);

      return {
        task: task.title,

        assignedAgent: task.assignedAgent,

        assignedAgentName: agent?.name ?? "Unknown Agent",

        status: task.status,
      };
    }),
  };
}
