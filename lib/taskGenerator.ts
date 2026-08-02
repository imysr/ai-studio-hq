import { MissionTask } from "@/data/tasks";

export function generateMissionTasks(
  missionId: number,
  assignedAgents: number[],
): MissionTask[] {
  return [
    {
      id: Date.now() + 1,

      missionId: missionId,

      title: "Project Planning",

      description: "Valid will analyse the mission and coordinate the AI team.",

      status: "Pending",

      progress: 0,

      assignedAgent: assignedAgents[0] ?? 1,
    },

    {
      id: Date.now() + 2,

      missionId: missionId,

      title: "System Development",

      description:
        "CodeBot will develop the application architecture and programming system.",

      status: "Pending",

      progress: 0,

      assignedAgent: assignedAgents[1] ?? 2,
    },

    {
      id: Date.now() + 3,

      missionId: missionId,

      title: "UI/UX Design",

      description:
        "Pixel will design the interface and improve user experience.",

      status: "Pending",

      progress: 0,

      assignedAgent: assignedAgents[2] ?? 3,
    },

    {
      id: Date.now() + 4,

      missionId: missionId,

      title: "Business Analysis",

      description: "Atlas will analyse business strategy and opportunities.",

      status: "Pending",

      progress: 0,

      assignedAgent: assignedAgents[3] ?? 4,
    },
  ];
}
