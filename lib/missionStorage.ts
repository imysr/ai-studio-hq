import { Mission } from "@/data/missions";

const STORAGE_KEY = "ai_missions";

export function getMissions(): Mission[] {
  if (typeof window === "undefined") {
    return [];
  }

  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {
    return [];
  }

  return JSON.parse(data);
}

export function saveMissions(missions: Mission[]) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(
    STORAGE_KEY,

    JSON.stringify(missions),
  );
}
