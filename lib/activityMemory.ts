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

  /*
    Make sure every activity has a unique ID.

    Several AI agents can perform actions within
    the same millisecond, so Date.now() alone
    can occasionally create duplicate IDs.
  */

  let uniqueId = activity.id;

  while (
    existing.some((existingActivity) => existingActivity.id === uniqueId)
  ) {
    uniqueId += 1;
  }

  const safeActivity: ActivityMemory = {
    ...activity,

    id: uniqueId,
  };

  const updated = [safeActivity, ...existing];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function getActivities(): ActivityMemory[] {
  if (typeof window === "undefined") {
    return [];
  }

  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {
    return [];
  }

  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function clearActivities() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
}
