import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";

type ActivityInput = {
  id: number;

  time: string;

  icon: string;

  message: string;
};

/*
  GET ACTIVITY LOGS
*/

export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from("activity_logs")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("Supabase activity read error:", error);

      return NextResponse.json(
        {
          error: "Failed to load activity logs.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,

      activities: data ?? [],
    });
  } catch (error) {
    console.error("Activity GET API error:", error);

    return NextResponse.json(
      {
        error: "Activity API failed to load data.",
      },
      {
        status: 500,
      },
    );
  }
}

/*
  CREATE / UPSERT ACTIVITY LOGS

  Accepts:
  - one activity
  - an array of activities
*/

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const activities: ActivityInput[] = Array.isArray(body) ? body : [body];

    /*
      VALIDATION
    */

    const validActivities = activities.filter(
      (activity) =>
        Number.isInteger(activity?.id) &&
        activity.id > 0 &&
        typeof activity?.time === "string" &&
        activity.time.length <= 100 &&
        typeof activity?.icon === "string" &&
        activity.icon.length <= 20 &&
        typeof activity?.message === "string" &&
        activity.message.trim().length > 0 &&
        activity.message.trim().length <= 5000,
    );

    if (validActivities.length === 0) {
      return NextResponse.json(
        {
          error: "At least one valid activity is required.",
        },
        {
          status: 400,
        },
      );
    }

    /*
      APPLICATION SHAPE
      →
      DATABASE SHAPE
    */

    const rows = validActivities.map((activity) => ({
      id: activity.id,

      time_text: activity.time ?? "",

      icon: activity.icon ?? "",

      message: activity.message.trim(),
    }));

    /*
      UPSERT

      Existing activity IDs remain
      unchanged while missing rows
      are inserted.
    */

    const { data, error } = await supabaseServer
      .from("activity_logs")
      .upsert(rows, {
        onConflict: "id",
      })
      .select();

    if (error) {
      console.error("Supabase activity write error:", error);

      return NextResponse.json(
        {
          error: "Failed to save activity logs.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,

      activities: data ?? [],

      synced: validActivities.length,
    });
  } catch (error) {
    console.error("Activity POST API error:", error);

    return NextResponse.json(
      {
        error: "Activity API failed to save data.",
      },
      {
        status: 500,
      },
    );
  }
}
