export type ActivityMemory = {
  id: number;

  time: string;

  icon: string;

  message: string;
};

const STORAGE_KEY = "companyActivity";

export function saveActivity(activity: ActivityMemory) {
  if (typeof window === "undefined") {
    return;
  }

  const existing = getActivities();

  const updated = [activity, ...existing];

  localStorage.setItem(
    STORAGE_KEY,

    JSON.stringify(updated),
  );
}

export function getActivities(): ActivityMemory[] {
  if (typeof window === "undefined") {
    return [];
  }

  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {
    return [];
  }

  return JSON.parse(data);
}

export function clearActivities() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
}
