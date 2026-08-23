import type { Mission } from "@/data/missions";

const STORAGE_KEY = "ai_missions";

/*
  GET MISSIONS

  localStorage remains the immediate
  client-side source during migration.
*/

export function getMissions(): Mission[] {
  if (typeof window === "undefined") {
    return [];
  }

  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {
    return [];
  }

  try {
    return JSON.parse(data) as Mission[];
  } catch {
    return [];
  }
}

/*
  SAVE MISSIONS

  1. Save immediately to localStorage.
  2. Synchronize the same missions
     to Supabase through our API.

  Supabase failure must NOT break
  the local application while the
  migration is still in progress.
*/

export function saveMissions(missions: Mission[]) {
  if (typeof window === "undefined") {
    return;
  }

  /*
    LOCAL PERSISTENCE
  */

  localStorage.setItem(STORAGE_KEY, JSON.stringify(missions));

  /*
    DATABASE SYNCHRONIZATION

    Keep saveMissions synchronous
    because it is already used
    throughout the application.

    The Supabase request runs in
    the background.
  */

  void syncMissionsToSupabase(missions);
}

/*
  SUPABASE MISSION SYNC
*/

async function syncMissionsToSupabase(missions: Mission[]) {
  if (missions.length === 0) {
    return;
  }

  try {
    const response = await fetch("/api/missions", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(missions),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);

      console.error("Supabase mission synchronization failed:", data);

      return;
    }

    const data = await response.json();

    console.log(
      `Supabase synchronized ${data.synced ?? missions.length} mission(s).`,
    );
  } catch (error) {
    console.error("Supabase mission synchronization error:", error);
  }
}
