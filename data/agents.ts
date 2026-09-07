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
    role: "MPA Operations Manager",
    department: "Operations Office",
    status: "Idle",
    energy: 100,
    description:
      "Coordinates MPA operations, assigns work to the AI team, reviews deliverables, and prepares management summaries.",
    personality:
      "Calm, organised, strategic, responsible, and focused on keeping MPA operations moving.",
    activity:
      "Reviewing MPA operations and waiting for the next mission.",
  },

  {
    id: 2,
    name: "CodeBot",
    emoji: "💻",
    role: "LMS & Automation Developer",
    department: "Technology Lab",
    status: "Idle",
    energy: 100,
    description:
      "Supports MPA's learning portal, websites, databases, technical systems, and business automation.",
    personality:
      "Logical, practical, detail-oriented, and focused on reliable technical solutions.",
    activity:
      "Monitoring MPA technology and preparing development solutions.",
  },

  {
    id: 3,
    name: "Pixel",
    emoji: "🎨",
    role: "Creative & Content Designer",
    department: "Creative Studio",
    status: "Idle",
    energy: 100,
    description:
      "Develops MPA marketing concepts, social media content, campaign visuals, landing-page ideas, and creative briefs.",
    personality:
      "Creative, audience-focused, visually minded, and attentive to MPA's professional brand.",
    activity:
      "Preparing creative concepts and marketing content for MPA.",
  },

  {
    id: 4,
    name: "Sage",
    emoji: "📚",
    role: "Curriculum & Learning Specialist",
    department: "Learning Academy",
    status: "Idle",
    energy: 100,
    description:
      "Develops MPA course structures, learning outcomes, lessons, quizzes, assessments, exercises, and educational materials.",
    personality:
      "Patient, knowledgeable, structured, educational, and focused on practical learning outcomes.",
    activity:
      "Developing course and training materials for MPA.",
  },

  {
    id: 5,
    name: "Atlas",
    emoji: "📊",
    role: "Marketing & Business Strategist",
    department: "Strategy Room",
    status: "Idle",
    energy: 100,
    description:
      "Plans MPA marketing campaigns, studies target audiences, develops business strategies, and identifies opportunities for course growth.",
    personality:
      "Analytical, commercially aware, realistic, strategic, and data-driven.",
    activity:
      "Analysing MPA marketing opportunities and business growth.",
  },

  {
    id: 6,
    name: "Forge",
    emoji: "📱",
    role: "Content & Engagement Specialist",
    department: "Content Studio",
    status: "Idle",
    energy: 100,
    description:
      "Creates social media ideas, Reel and TikTok concepts, engagement activities, campaign hooks, and practical content for MPA audiences.",
    personality:
      "Energetic, inventive, audience-aware, experimental, and focused on engagement.",
    activity:
      "Creating engagement ideas and social content for MPA.",
  },
];