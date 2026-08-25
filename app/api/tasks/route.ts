import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";
import { isApiOwnerAuthenticated } from "@/lib/auth/apiOwner";

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
  contain old tasks whose parent
  missions are not in Supabase.

  Those tasks are skipped safely.
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

    const allowedStatuses = ["Pending", "Working", "Completed"] as const;

    const validTasks = tasks.filter(
      (task) =>
        Number.isInteger(task?.id) &&
        task.id > 0 &&
        Number.isInteger(task?.missionId) &&
        task.missionId > 0 &&
        typeof task?.title === "string" &&
        task.title.trim().length > 0 &&
        task.title.trim().length <= 250 &&
        typeof task?.description === "string" &&
        task.description.length <= 10000 &&
        Number.isInteger(task?.assignedAgent) &&
        task.assignedAgent >= 1 &&
        task.assignedAgent <= 6 &&
        typeof task?.status === "string" &&
        allowedStatuses.includes(
          task.status as (typeof allowedStatuses)[number],
        ) &&
        typeof task?.progress === "number" &&
        Number.isFinite(task.progress) &&
        task.progress >= 0 &&
        task.progress <= 100 &&
        (task.result === undefined ||
          (typeof task.result === "string" && task.result.length <= 50000)) &&
        (task.dependsOn === undefined ||
          (Array.isArray(task.dependsOn) &&
            task.dependsOn.every(
              (dependencyId) =>
                Number.isInteger(dependencyId) && dependencyId > 0,
            ))) &&
        (task.contextFromTasks === undefined ||
          (Array.isArray(task.contextFromTasks) &&
            task.contextFromTasks.every(
              (contextId) => Number.isInteger(contextId) && contextId > 0,
            ))),
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
      FIND WHICH PARENT MISSIONS
      CURRENTLY EXIST IN SUPABASE.
    */

    const missionIds = [...new Set(validTasks.map((task) => task.missionId))];

    const { data: existingMissions, error: missionLookupError } =
      await supabaseServer.from("missions").select("id").in("id", missionIds);

    if (missionLookupError) {
      console.error("Supabase mission lookup error:", missionLookupError);

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

    const syncableTasks = validTasks.filter((task) =>
      existingMissionIds.has(task.missionId),
    );

    const skippedTasks = validTasks.filter(
      (task) => !existingMissionIds.has(task.missionId),
    );

    if (syncableTasks.length === 0) {
      return NextResponse.json({
        success: true,

        tasks: [],

        synced: 0,

        skipped: skippedTasks.length,

        missionsUpdated: 0,
      });
    }

    /*
      CONVERT APPLICATION TASKS
      INTO DATABASE ROWS.
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
      UPSERT TASKS
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

    /*
      UPDATE PARENT MISSION
      PROGRESS + STATUS.

      We calculate from the complete
      task list supplied by the client,
      not only the rows that changed.
    */

    const affectedMissionIds = [
      ...new Set(syncableTasks.map((task) => task.missionId)),
    ];

    let missionsUpdated = 0;

    for (const missionId of affectedMissionIds) {
      const missionTasks = syncableTasks.filter(
        (task) => task.missionId === missionId,
      );

      if (missionTasks.length === 0) {
        continue;
      }

      const completedTasks = missionTasks.filter(
        (task) => task.status === "Completed",
      ).length;

      const progress = Math.round((completedTasks / missionTasks.length) * 100);

      const status =
        progress === 100 ? "Completed" : progress === 0 ? "Planning" : "Active";

      const { error: missionUpdateError } = await supabaseServer
        .from("missions")
        .update({
          progress,

          status,
        })
        .eq("id", missionId);

      if (missionUpdateError) {
        console.error(
          `Failed to update mission ${missionId} progress:`,
          missionUpdateError,
        );

        continue;
      }

      missionsUpdated += 1;
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

      missionsUpdated,
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
