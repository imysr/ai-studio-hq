export type Mission = {
  id: number;

  title: string;

  description: string;

  status: string;

  progress: number;

  assignedAgents: number[];
};

export const defaultMissions: Mission[] = [
  {
    id: 1,

    title: "Build AI Studio HQ",

    description:
      "Create the first version of the AI company simulation system.",

    status: "Planning",

    progress: 25,

    assignedAgents: [1, 2, 3],
  },
];
