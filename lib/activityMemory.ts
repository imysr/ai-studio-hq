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
    Ensure every activity has
    a unique numeric ID.
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

  /*
    LOCAL PERSISTENCE
  */

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  /*
    SUPABASE SYNCHRONIZATION

    Sync the current activity history.

    This also backfills older activities
    that currently exist only locally.
  */

  void syncActivitiesToSupabase(updated);
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
    return JSON.parse(data) as ActivityMemory[];
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

/*
  SUPABASE ACTIVITY SYNC
*/

async function syncActivitiesToSupabase(activities: ActivityMemory[]) {
  if (activities.length === 0) {
    return;
  }

  try {
    const response = await fetch("/api/activity", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(activities),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);

      console.error("Supabase activity synchronization failed:", data);

      return;
    }

    const data = await response.json();

    console.log(
      `Supabase synchronized ${
        data.synced ?? activities.length
      } activity log(s).`,
    );
  } catch (error) {
    console.error("Supabase activity synchronization error:", error);
  }
}

/*
  LOAD ACTIVITIES FROM SUPABASE

  Supabase is now the preferred
  persistent source of activity logs.

  localStorage remains a temporary
  cache during migration.
*/

export async function loadActivitiesFromSupabase(): Promise<ActivityMemory[]> {
  try {
    const response = await fetch("/api/activity", {
      method: "GET",
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);

      console.error("Supabase activity load failed:", data);

      return getActivities();
    }

    const data = await response.json();

    if (!Array.isArray(data.activities)) {
      return getActivities();
    }

    const activities = data.activities.map(
      (activity: {
        id: number;
        time_text: string;
        icon: string;
        message: string;
      }): ActivityMemory => ({
        id: activity.id,

        time: activity.time_text ?? "",

        icon: activity.icon ?? "",

        message: activity.message ?? "",
      }),
    );

    /*
      TEMPORARY LOCAL CACHE
    */

    localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));

    return activities;
  } catch (error) {
    console.error("Supabase activity load error:", error);

    return getActivities();
  }
}
