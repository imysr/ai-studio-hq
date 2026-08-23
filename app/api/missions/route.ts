import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";

type MissionInput = {
  id: number;

  title: string;

  description: string;

  status: string;

  progress: number;

  assignedAgents: number[];

  finalDeliverable?: string;

  finalDeliverableCreatedAt?: string;
};

/*
  GET MISSIONS

  Reads missions from Supabase.
*/

export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from("missions")
      .select("*")
      .order("id", {
        ascending: false,
      });

    if (error) {
      console.error("Supabase mission read error:", error);

      return NextResponse.json(
        {
          error: "Failed to load missions from Supabase.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,

      missions: data ?? [],
    });
  } catch (error) {
    console.error("Mission GET API error:", error);

    return NextResponse.json(
      {
        error: "Mission API failed to load data.",
      },
      {
        status: 500,
      },
    );
  }
}

/*
  CREATE / UPSERT MISSIONS

  Accepts either:
  - one mission
  - an array of missions

  This lets saveMissions() synchronize
  the complete current mission state
  in one request.
*/

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const missions: MissionInput[] = Array.isArray(body) ? body : [body];

    /*
      VALIDATION
    */

    const validMissions = missions.filter(
      (mission) =>
        typeof mission?.id === "number" &&
        typeof mission?.title === "string" &&
        mission.title.trim() !== "",
    );

    if (validMissions.length === 0) {
      return NextResponse.json(
        {
          error: "At least one valid mission is required.",
        },
        {
          status: 400,
        },
      );
    }

    /*
      CONVERT APPLICATION SHAPE
      TO DATABASE COLUMN SHAPE
    */

    const missionRows = validMissions.map((mission) => ({
      id: mission.id,

      title: mission.title.trim(),

      description: mission.description ?? "",

      status: mission.status ?? "Active",

      progress: mission.progress ?? 0,

      assigned_agents: mission.assignedAgents ?? [],

      final_deliverable: mission.finalDeliverable ?? "",

      final_deliverable_created_at: mission.finalDeliverableCreatedAt || null,
    }));

    /*
      UPSERT

      Existing mission IDs update.
      New mission IDs insert.
    */

    const { data, error } = await supabaseServer
      .from("missions")
      .upsert(missionRows, {
        onConflict: "id",
      })
      .select();

    if (error) {
      console.error("Supabase mission write error:", error);

      return NextResponse.json(
        {
          error: "Failed to save missions to Supabase.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,

      missions: data ?? [],

      synced: validMissions.length,
    });
  } catch (error) {
    console.error("Mission POST API error:", error);

    return NextResponse.json(
      {
        error: "Mission API failed to save data.",
      },
      {
        status: 500,
      },
    );
  }
}
