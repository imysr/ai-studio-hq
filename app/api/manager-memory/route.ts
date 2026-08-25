import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";
import { isApiOwnerAuthenticated } from "@/lib/auth/apiOwner";

type ManagerMemoryInput = {
  missionTitle: string;

  analysis: string;

  decision: string;

  createdAt: string;

  finalDeliverable?: string;

  finalDeliverableCreatedAt?: string;
};

/*
  GET MANAGER MEMORY

  Returns Valid's most recently
  saved manager memory.
*/

export async function GET() {
  try {
    const authenticated = await isApiOwnerAuthenticated();

    if (!authenticated) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        },
      );
    }
    const { data, error } = await supabaseServer
      .from("manager_memory")
      .select("*")
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Supabase manager memory read error:", error);

      return NextResponse.json(
        {
          error: "Failed to load manager memory.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,

      memory: data ?? null,
    });
  } catch (error) {
    console.error("Manager memory GET API error:", error);

    return NextResponse.json(
      {
        error: "Manager memory API failed to load data.",
      },
      {
        status: 500,
      },
    );
  }
}

/*
  SAVE MANAGER MEMORY

  Manager memory represents Valid's
  current mission-level analysis,
  decision and final deliverable.

  Existing memory for the same mission
  is replaced so repeated saves do not
  create unnecessary duplicate rows.
*/

export async function POST(request: Request) {
  try {
    const authenticated = await isApiOwnerAuthenticated();

    if (!authenticated) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        },
      );
    }
    const body = (await request.json()) as ManagerMemoryInput;

    if (
      !body ||
      typeof body.missionTitle !== "string" ||
      body.missionTitle.trim().length === 0 ||
      body.missionTitle.trim().length > 200 ||
      typeof body.analysis !== "string" ||
      body.analysis.length > 10000 ||
      typeof body.decision !== "string" ||
      body.decision.length > 5000 ||
      typeof body.createdAt !== "string" ||
      Number.isNaN(new Date(body.createdAt).getTime()) ||
      (body.finalDeliverable !== undefined &&
        (typeof body.finalDeliverable !== "string" ||
          body.finalDeliverable.length > 50000)) ||
      (body.finalDeliverableCreatedAt !== undefined &&
        (typeof body.finalDeliverableCreatedAt !== "string" ||
          Number.isNaN(new Date(body.finalDeliverableCreatedAt).getTime())))
    ) {
      return NextResponse.json(
        {
          error: "Mission title is required.",
        },
        {
          status: 400,
        },
      );
    }

    /*
      Find the newest existing memory
      for this mission.
    */

    const { data: existing, error: lookupError } = await supabaseServer
      .from("manager_memory")
      .select("id")
      .eq("mission_title", body.missionTitle)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error("Supabase manager memory lookup error:", lookupError);

      return NextResponse.json(
        {
          error: "Failed to inspect manager memory.",
        },
        {
          status: 500,
        },
      );
    }

    const row = {
      mission_title: body.missionTitle,

      analysis: body.analysis ?? "",

      decision: body.decision ?? "",

      created_at: body.createdAt || new Date().toISOString(),

      final_deliverable: body.finalDeliverable ?? null,

      final_deliverable_created_at: body.finalDeliverableCreatedAt ?? null,
    };

    /*
      UPDATE EXISTING MISSION MEMORY
    */

    if (existing) {
      const { data, error } = await supabaseServer
        .from("manager_memory")
        .update(row)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("Supabase manager memory update error:", error);

        return NextResponse.json(
          {
            error: "Failed to update manager memory.",
          },
          {
            status: 500,
          },
        );
      }

      return NextResponse.json({
        success: true,

        memory: data,

        action: "updated",
      });
    }

    /*
      CREATE NEW MISSION MEMORY
    */

    const { data, error } = await supabaseServer
      .from("manager_memory")
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error("Supabase manager memory insert error:", error);

      return NextResponse.json(
        {
          error: "Failed to save manager memory.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,

      memory: data,

      action: "created",
    });
  } catch (error) {
    console.error("Manager memory POST API error:", error);

    return NextResponse.json(
      {
        error: "Manager memory API failed to save data.",
      },
      {
        status: 500,
      },
    );
  }
}
