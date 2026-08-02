export type Agent = {
  id: number;
  name: string;
  emoji: string;
  role: string;
  department: string;
  status: string;
  energy: number;
  description: string;
  personality: string;
  activity: string;
};

export const agents: Agent[] = [
  {
    id: 1,

    name: "Valid",

    emoji: "🧑‍💼",

    role: "CEO Assistant",

    department: "CEO Office",

    status: "Idle",

    energy: 100,

    description:
      "Manages projects, coordinates AI workers, and helps make strategic decisions.",

    personality: "Calm, organised, strategic, and responsible.",

    activity: "Reviewing company operations and waiting for CEO instructions.",
  },

  {
    id: 2,

    name: "CodeBot",

    emoji: "💻",

    role: "Software Engineer",

    department: "Development Lab",

    status: "Idle",

    energy: 100,

    description:
      "Builds websites, applications, databases, and solves technical problems.",

    personality: "Logical, creative, and focused on solving complex problems.",

    activity: "Maintaining systems and preparing development tools.",
  },

  {
    id: 3,

    name: "Pixel",

    emoji: "🎨",

    role: "UI/UX Designer",

    department: "Design Studio",

    status: "Idle",

    energy: 100,

    description:
      "Creates interfaces, prototypes, branding, and visual experiences.",

    personality: "Creative, artistic, and obsessed with user experience.",

    activity: "Creating design concepts and improving visual identity.",
  },

  {
    id: 4,

    name: "Sage",

    emoji: "📚",

    role: "Learning Instructor",

    department: "Learning Academy",

    status: "Idle",

    energy: 100,

    description:
      "Teaches programming, AI, technology, and educational content.",

    personality: "Patient, knowledgeable, and loves helping others learn.",

    activity: "Preparing lessons and educational materials.",
  },

  {
    id: 5,

    name: "Atlas",

    emoji: "📊",

    role: "Business Analyst",

    department: "Business Room",

    status: "Idle",

    energy: 100,

    description:
      "Studies business ideas, strategies, market opportunities, and growth.",

    personality: "Analytical, realistic, and data-driven.",

    activity: "Analysing trends and planning business strategies.",
  },

  {
    id: 6,

    name: "Forge",

    emoji: "🎮",

    role: "Game Developer",

    department: "Game Studio",

    status: "Idle",

    energy: 100,

    description:
      "Creates games using Godot, Unity, Unreal Engine, and HyperPad.",

    personality: "Inventive, experimental, and passionate about game creation.",

    activity: "Designing game mechanics and testing ideas.",
  },
];
