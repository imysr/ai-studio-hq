import { Mission } from "@/data/missions";
import { MissionTask } from "@/data/tasks";
import { saveActivity } from "@/lib/activityMemory";

export function analyseMission(mission: Mission) {
  saveActivity({
    id: Date.now(),

    time: new Date().toLocaleTimeString(),

    icon: "🧠",

    message: `Valid analysed mission: ${mission.title}`,
  });

  return {
    agent: "Valid",

    analysis: `Analysing mission: ${mission.title}`,

    decision:
      "Mission requires planning, development, design, and business analysis.",
  };
}

export function createManagerReport(mission: Mission, tasks: MissionTask[]) {
  return {
    title: `Mission Report: ${mission.title}`,

    summary: `Valid analysed ${tasks.length} tasks and prepared AI team workflow.`,

    tasks: tasks.map((task) => ({
      task: task.title,

      assignedAgent: task.assignedAgent,

      status: task.status,
    })),
  };
}
