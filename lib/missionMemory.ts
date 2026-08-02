export type MissionMemory = {
  title: string;

  description: string;
};

export function saveMissionMemory(mission: MissionMemory) {
  if (typeof window !== "undefined") {
    localStorage.setItem("currentMission", JSON.stringify(mission));
  }
}

export function getMissionMemory(): MissionMemory | null {
  if (typeof window !== "undefined") {
    const data = localStorage.getItem("currentMission");

    if (data) {
      return JSON.parse(data);
    }
  }

  return null;
}
