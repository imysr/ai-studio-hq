import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";

type AgentMemoryInput = {
  id: number;

  currentTask: string;

  missionStatus: string;

  location: string;

  energy: number;

  lastAction: string;
};

/*
  GET AGENT MEMORY
*/

export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from("agent_memory")
      .select("*")
      .order("agent_id", {
        ascending: true,
      });

    if (error) {
      console.error("Supabase agent memory read error:", error);

      return NextResponse.json(
        {
          error: "Failed to load agent memory.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,

      agents: data ?? [],
    });
  } catch (error) {
    console.error("Agent memory GET API error:", error);

    return NextResponse.json(
      {
        error: "Agent memory API failed to load data.",
      },
      {
        status: 500,
      },
    );
  }
}

/*
  CREATE / UPSERT AGENT MEMORY

  All six agent states are normally
  synchronized together.
*/

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const memories: AgentMemoryInput[] = Array.isArray(body) ? body : [];

    if (memories.length === 0) {
      return NextResponse.json(
        {
          error: "At least one agent memory is required.",
        },
        {
          status: 400,
        },
      );
    }

    const validMemories = memories.filter(
      (memory) =>
        typeof memory.id === "number" && memory.id >= 1 && memory.id <= 6,
    );

    if (validMemories.length === 0) {
      return NextResponse.json(
        {
          error: "No valid agent memory was provided.",
        },
        {
          status: 400,
        },
      );
    }

    const rows = validMemories.map((memory) => ({
      agent_id: memory.id,

      current_task: memory.currentTask ?? "Waiting for assignment",

      mission_status: memory.missionStatus ?? "Idle",

      location: memory.location ?? "Office",

      energy: Math.max(0, Math.min(100, memory.energy ?? 100)),

      last_action: memory.lastAction ?? "No active mission",
    }));

    const { data, error } = await supabaseServer
      .from("agent_memory")
      .upsert(rows, {
        onConflict: "agent_id",
      })
      .select();

    if (error) {
      console.error("Supabase agent memory write error:", error);

      return NextResponse.json(
        {
          error: "Failed to save agent memory.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,

      agents: data ?? [],

      synced: validMemories.length,
    });
  } catch (error) {
    console.error("Agent memory POST API error:", error);

    return NextResponse.json(
      {
        error: "Agent memory API failed to save data.",
      },
      {
        status: 500,
      },
    );
  }
}
