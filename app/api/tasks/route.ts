import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";

type MissionTaskInput = {
  id: number;

  missionId: number;

  title: string;

  description: string;

  assignedAgent: number;

  status: "Pending" | "Working" | "Completed";

  progress: number;

  result?: string;

  dependsOn?: number[];

  contextFromTasks?: number[];
};

/*
  GET TASKS

  Reads mission tasks from Supabase.
*/

export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from("mission_tasks")
      .select("*")
      .order("id", {
        ascending: true,
      });

    if (error) {
      console.error("Supabase task read error:", error);

      return NextResponse.json(
        {
          error: "Failed to load tasks from Supabase.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,

      tasks: data ?? [],
    });
  } catch (error) {
    console.error("Task GET API error:", error);

    return NextResponse.json(
      {
        error: "Task API failed to load data.",
      },
      {
        status: 500,
      },
    );
  }
}

/*
  CREATE / UPSERT TASKS

  During migration, localStorage may
  still contain old tasks whose missions
  do not yet exist in Supabase.

  We therefore:
  1. Find which mission IDs exist.
  2. Sync only tasks with valid parents.
  3. Skip old local-only tasks safely.
*/

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const tasks: MissionTaskInput[] = Array.isArray(body) ? body : [];

    if (tasks.length === 0) {
      return NextResponse.json(
        {
          error: "At least one task is required.",
        },
        {
          status: 400,
        },
      );
    }

    /*
      BASIC VALIDATION
    */

    const validTasks = tasks.filter(
      (task) =>
        typeof task.id === "number" &&
        typeof task.missionId === "number" &&
        typeof task.title === "string" &&
        task.title.trim() !== "",
    );

    if (validTasks.length === 0) {
      return NextResponse.json(
        {
          error: "No valid tasks were provided.",
        },
        {
          status: 400,
        },
      );
    }

    /*
      FIND PARENT MISSIONS

      A task cannot be inserted if its
      mission does not exist because
      mission_tasks has a foreign key
      to missions.
    */

    const missionIds = [...new Set(validTasks.map((task) => task.missionId))];

    const { data: existingMissions, error: missionError } = await supabaseServer
      .from("missions")
      .select("id")
      .in("id", missionIds);

    if (missionError) {
      console.error("Supabase mission lookup error:", missionError);

      return NextResponse.json(
        {
          error: "Failed to verify task missions.",
        },
        {
          status: 500,
        },
      );
    }

    const existingMissionIds = new Set(
      (existingMissions ?? []).map((mission) => Number(mission.id)),
    );

    /*
      TEMPORARY MIGRATION FILTER

      Old localStorage tasks are skipped
      until their parent missions are
      migrated to Supabase.
    */

    const syncableTasks = validTasks.filter((task) =>
      existingMissionIds.has(task.missionId),
    );

    const skippedTasks = validTasks.filter(
      (task) => !existingMissionIds.has(task.missionId),
    );

    if (syncableTasks.length === 0) {
      console.warn(
        `Supabase task sync skipped ${skippedTasks.length} task(s) because their parent missions are not in Supabase yet.`,
      );

      return NextResponse.json({
        success: true,

        tasks: [],

        synced: 0,

        skipped: skippedTasks.length,
      });
    }

    /*
      CONVERT CLIENT TASK SHAPE
      TO DATABASE COLUMN SHAPE
    */

    const taskRows = syncableTasks.map((task) => ({
      id: task.id,

      mission_id: task.missionId,

      title: task.title.trim(),

      description: task.description ?? "",

      assigned_agent: task.assignedAgent,

      status: task.status,

      progress: task.progress ?? 0,

      result: task.result ?? "",

      depends_on: task.dependsOn ?? [],

      context_from_tasks: task.contextFromTasks ?? [],
    }));

    /*
      UPSERT

      Existing task IDs are updated.
      New task IDs are inserted.
    */

    const { data, error } = await supabaseServer
      .from("mission_tasks")
      .upsert(taskRows, {
        onConflict: "id",
      })
      .select();

    if (error) {
      console.error("Supabase task write error:", error);

      return NextResponse.json(
        {
          error: "Failed to save tasks to Supabase.",
        },
        {
          status: 500,
        },
      );
    }

    if (skippedTasks.length > 0) {
      console.warn(
        `Supabase synchronized ${syncableTasks.length} task(s) and skipped ${skippedTasks.length} old local task(s).`,
      );
    }

    return NextResponse.json({
      success: true,

      tasks: data ?? [],

      synced: syncableTasks.length,

      skipped: skippedTasks.length,
    });
  } catch (error) {
    console.error("Task POST API error:", error);

    return NextResponse.json(
      {
        error: "Task API failed to save data.",
      },
      {
        status: 500,
      },
    );
  }
}
