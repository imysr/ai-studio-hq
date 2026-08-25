export type SimAgentStatus =
  | "Idle"
  | "Assigned"
  | "Waiting"
  | "Working"
  | "Completed";

export type SimAgentLocation =
  | "CEO Office"
  | "Development Lab"
  | "Design Studio"
  | "Learning Academy"
  | "Business Room"
  | "Game Studio"
  | "AI Core Meeting Room"
  | "Hallway"
  | "Lounge";

export type SimAgentState = {
  id: number;

  status: SimAgentStatus;

  location: SimAgentLocation;

  currentTask: string;

  energy: number;

  lastAction: string;
};

export const defaultSimAgentState: SimAgentState[] = [
  {
    id: 1,
    status: "Idle",
    location: "CEO Office",
    currentTask: "Waiting for assignment",
    energy: 100,
    lastAction: "Reviewing company operations.",
  },

  {
    id: 2,
    status: "Idle",
    location: "Development Lab",
    currentTask: "Waiting for assignment",
    energy: 100,
    lastAction: "Maintaining development systems.",
  },

  {
    id: 3,
    status: "Idle",
    location: "Design Studio",
    currentTask: "Waiting for assignment",
    energy: 100,
    lastAction: "Developing design concepts.",
  },

  {
    id: 4,
    status: "Idle",
    location: "Learning Academy",
    currentTask: "Waiting for assignment",
    energy: 100,
    lastAction: "Preparing educational materials.",
  },

  {
    id: 5,
    status: "Idle",
    location: "Business Room",
    currentTask: "Waiting for assignment",
    energy: 100,
    lastAction: "Reviewing business strategy.",
  },

  {
    id: 6,
    status: "Idle",
    location: "Game Studio",
    currentTask: "Waiting for assignment",
    energy: 100,
    lastAction: "Testing game-development ideas.",
  },
];
