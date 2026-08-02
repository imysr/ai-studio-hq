export type ManagerMemory = {
  missionTitle: string;

  analysis: string;

  decision: string;

  createdAt: string;
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
