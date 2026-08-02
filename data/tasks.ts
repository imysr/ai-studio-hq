export type MissionTask = {
  id: number;

  missionId: number;

  title: string;

  description: string;

  assignedAgent: number;

  status: "Pending" | "Working" | "Completed";

  progress: number;
};

export const defaultTasks: MissionTask[] = [
  {
    id: 1,

    missionId: 1,

    title: "Project Planning",

    description: "Valid will analyse the mission and coordinate the AI team.",

    assignedAgent: 1,

    status: "Pending",

    progress: 0,
  },

  {
    id: 2,

    missionId: 1,

    title: "System Development",

    description:
      "CodeBot will develop the application architecture and programming system.",

    assignedAgent: 2,

    status: "Pending",

    progress: 0,
  },

  {
    id: 3,

    missionId: 1,

    title: "UI/UX Design",

    description: "Pixel will design the interface and improve user experience.",

    assignedAgent: 3,

    status: "Pending",

    progress: 0,
  },

  {
    id: 4,

    missionId: 1,

    title: "Business Analysis",

    description: "Atlas will analyse business strategy and opportunities.",

    assignedAgent: 5,

    status: "Pending",

    progress: 0,
  },
];
