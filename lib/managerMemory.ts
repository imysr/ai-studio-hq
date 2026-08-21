export type ManagerMemory = {
  missionTitle: string;

  analysis: string;

  decision: string;

  createdAt: string;

  /*
    FINAL MISSION DELIVERABLE

    Created by Valid after all mission
    tasks have been completed.

    This combines the work of the
    specialist agents into one final
    CEO-level mission review.
  */

  finalDeliverable?: string;

  finalDeliverableCreatedAt?: string;
};

const STORAGE_KEY = "managerMemory";

export function saveManagerMemory(memory: ManagerMemory) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(
    STORAGE_KEY,

    JSON.stringify(memory),
  );
}

export function getManagerMemory(): ManagerMemory | null {
  if (typeof window === "undefined") {
    return null;
  }

  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {
    return null;
  }

  return JSON.parse(data);
}
