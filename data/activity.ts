export type Activity = {
  id: number;

  time: string;

  icon: string;

  message: string;
};

export const defaultActivities: Activity[] = [
  {
    id: 1,
    time: "09:00",
    icon: "🧠",
    message: "AI Core activated",
  },

  {
    id: 2,
    time: "09:01",
    icon: "🧑‍💼",
    message: "Valid started coordinating the mission",
  },

  {
    id: 3,
    time: "09:02",
    icon: "💻",
    message: "CodeBot started software development",
  },

  {
    id: 4,
    time: "09:03",
    icon: "🎨",
    message: "Pixel started UI/UX preparation",
  },

  {
    id: 5,
    time: "09:04",
    icon: "📊",
    message: "Atlas started business analysis",
  },
];
