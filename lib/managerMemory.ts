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

/*
  SAVE MANAGER MEMORY

  During migration:

  1. Save immediately to localStorage.
  2. Synchronize Valid's memory to
     Supabase in the background.

  Supabase failure must not interrupt
  Valid or the mission engine.
*/

export function saveManagerMemory(memory: ManagerMemory) {
  if (typeof window === "undefined") {
    return;
  }

  /*
    LOCAL PERSISTENCE
  */

  localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));

  /*
    SUPABASE SYNCHRONIZATION
  */

  void syncManagerMemoryToSupabase(memory);
}

/*
  GET MANAGER MEMORY

  localStorage remains the immediate
  source during this migration phase.
*/

export function getManagerMemory(): ManagerMemory | null {
  if (typeof window === "undefined") {
    return null;
  }

  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data) as ManagerMemory;
  } catch {
    return null;
  }
}

/*
  SUPABASE MANAGER MEMORY SYNC
*/

async function syncManagerMemoryToSupabase(memory: ManagerMemory) {
  try {
    const response = await fetch("/api/manager-memory", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(memory),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);

      console.error("Supabase manager memory synchronization failed:", data);

      return;
    }

    const data = await response.json();

    console.log(
      `Manager memory synchronized to Supabase (${data.action ?? "saved"}).`,
    );
  } catch (error) {
    /*
      Database/network problems must
      never stop Valid's workflow.
    */

    console.error("Supabase manager memory synchronization error:", error);
  }
}
