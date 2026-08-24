"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { agents } from "@/data/agents";
import type { Mission } from "@/data/missions";
import type { MissionTask } from "@/data/tasks";

import { getMissions } from "@/lib/missionStorage";
import { loadTasksFromSupabase } from "@/lib/taskStorage";

import {
  calculateMissionProgress,
  calculateMissionStatus,
} from "@/lib/taskEngine";

export default function MissionDetailClient() {
  const params = useParams();

  const missionId = Number(params.id);

  const [mission] = useState<Mission | null>(() => {
    if (!Number.isFinite(missionId)) {
      return null;
    }

    return getMissions().find((item) => item.id === missionId) ?? null;
  });

  const [tasks, setTasks] = useState<MissionTask[]>([]);

  useEffect(() => {
    if (!Number.isFinite(missionId)) {
      return;
    }

    let cancelled = false;

    async function loadMissionTasks() {
      const loadedTasks = await loadTasksFromSupabase();

      if (cancelled) {
        return;
      }

      setTasks(loadedTasks.filter((task) => task.missionId === missionId));
    }

    void loadMissionTasks();

    return () => {
      cancelled = true;
    };
  }, [missionId]);
  if (!mission) {
    return (
      <main
        className="
        min-h-screen
        bg-black
        text-white
        p-10
        "
      >
        <div
          className="
          max-w-6xl
          mx-auto
          "
        >
          <Link
            href="/missions"
            className="
            text-gray-400
            hover:text-white
            "
          >
            ← Back to Mission Control
          </Link>

          <div
            className="
            mt-10
            border
            border-white/10
            bg-[#080808]
            rounded-3xl
            p-10
            "
          >
            <h1
              className="
              text-3xl
              font-bold
              "
            >
              Mission not found
            </h1>

            <p
              className="
              text-gray-500
              mt-3
              "
            >
              This mission may no longer exist in local storage.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const progress = calculateMissionProgress(mission.id);

  const status = calculateMissionStatus(mission.id);

  const completedTasks = tasks.filter(
    (task) => task.status === "Completed",
  ).length;

  return (
    <main
      className="
      min-h-screen
      bg-black
      text-white
      p-10
      "
    >
      <div
        className="
        max-w-6xl
        mx-auto
        "
      >
        <Link
          href="/missions"
          className="
          text-gray-400
          hover:text-white
          "
        >
          ← Back to Mission Control
        </Link>

        {/* HEADER */}

        <section
          className="
          mt-10
          bg-[#080808]
          border
          border-white/10
          rounded-3xl
          p-10
          "
        >
          <div
            className="
            flex
            items-start
            justify-between
            gap-6
            flex-wrap
            "
          >
            <div
              className="
              max-w-3xl
              "
            >
              <p
                className="
                text-purple-400
                text-sm
                uppercase
                tracking-widest
                "
              >
                Mission Detail
              </p>

              <h1
                className="
                text-5xl
                font-bold
                mt-3
                "
              >
                {mission.title}
              </h1>

              <p
                className="
                text-gray-400
                mt-5
                leading-7
                "
              >
                {mission.description}
              </p>
            </div>

            <span
              className={`
                px-4
                py-2
                rounded-full
                border
                text-sm
                ${
                  status === "Completed"
                    ? "border-green-500/30 bg-green-500/10 text-green-400"
                    : status === "Active"
                      ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                      : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                }
              `}
            >
              {status}
            </span>
          </div>

          {/* PROGRESS */}

          <div
            className="
            mt-8
            "
          >
            <div
              className="
              flex
              justify-between
              text-sm
              "
            >
              <span className="text-gray-400">Mission Progress</span>

              <span>{progress}%</span>
            </div>

            <div
              className="
              mt-3
              h-3
              bg-white/10
              rounded-full
              overflow-hidden
              "
            >
              <div
                className="
                h-full
                bg-white
                rounded-full
                transition-all
                "
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>
          </div>

          {/* STATS */}

          <div
            className="
            grid
            md:grid-cols-3
            gap-4
            mt-8
            "
          >
            <div
              className="
              bg-black
              border
              border-white/10
              rounded-2xl
              p-5
              "
            >
              <p
                className="
                text-gray-500
                text-sm
                "
              >
                Tasks
              </p>

              <p
                className="
                text-2xl
                font-bold
                mt-2
                "
              >
                {tasks.length}
              </p>
            </div>

            <div
              className="
              bg-black
              border
              border-white/10
              rounded-2xl
              p-5
              "
            >
              <p
                className="
                text-gray-500
                text-sm
                "
              >
                Completed Tasks
              </p>

              <p
                className="
                text-2xl
                font-bold
                mt-2
                "
              >
                {completedTasks}
              </p>
            </div>

            <div
              className="
              bg-black
              border
              border-white/10
              rounded-2xl
              p-5
              "
            >
              <p
                className="
                text-gray-500
                text-sm
                "
              >
                Assigned Agents
              </p>

              <p
                className="
                text-2xl
                font-bold
                mt-2
                "
              >
                {mission.assignedAgents.length}
              </p>
            </div>
          </div>
        </section>

        {/* TEAM */}

        <section
          className="
          mt-8
          bg-[#080808]
          border
          border-white/10
          rounded-3xl
          p-8
          "
        >
          <h2
            className="
            text-2xl
            font-bold
            "
          >
            👥 Mission Team
          </h2>

          <div
            className="
            flex
            flex-wrap
            gap-3
            mt-5
            "
          >
            {mission.assignedAgents.map((agentId) => {
              const agent = agents.find((item) => item.id === agentId);

              return (
                <Link
                  key={agentId}
                  href={`/agents/${agentId}`}
                  className="
                    bg-black
                    border
                    border-white/10
                    hover:border-white/30
                    rounded-full
                    px-4
                    py-2
                    transition
                    "
                >
                  {agent?.emoji} {agent?.name ?? `Agent ${agentId}`}
                </Link>
              );
            })}
          </div>
        </section>

        {/* TASK WORKFLOW */}

        <section
          className="
          mt-8
          bg-[#080808]
          border
          border-white/10
          rounded-3xl
          p-8
          "
        >
          <h2
            className="
            text-2xl
            font-bold
            "
          >
            📋 Task Workflow
          </h2>

          <p
            className="
            text-gray-500
            mt-2
            "
          >
            Specialist assignments, dependencies, collaboration context and
            completed work.
          </p>

          <div
            className="
            mt-6
            space-y-6
            "
          >
            {tasks.map((task, index) => {
              const assignedAgent = agents.find(
                (agent) => agent.id === task.assignedAgent,
              );

              const dependencyTasks = (task.dependsOn ?? [])
                .map((taskId) => tasks.find((item) => item.id === taskId))
                .filter(Boolean) as MissionTask[];

              const contextTasks = (task.contextFromTasks ?? [])
                .map((taskId) => tasks.find((item) => item.id === taskId))
                .filter(Boolean) as MissionTask[];

              return (
                <article
                  key={task.id}
                  className="
                    bg-black
                    border
                    border-white/10
                    rounded-2xl
                    p-6
                    "
                >
                  <div
                    className="
                      flex
                      justify-between
                      gap-5
                      flex-wrap
                      "
                  >
                    <div>
                      <p
                        className="
                          text-gray-600
                          text-xs
                          uppercase
                          tracking-widest
                          "
                      >
                        Task {index + 1}
                      </p>

                      <h3
                        className="
                          text-xl
                          font-bold
                          mt-2
                          "
                      >
                        {task.status === "Completed"
                          ? "✅"
                          : task.status === "Working"
                            ? "⚙️"
                            : "⏳"}{" "}
                        {task.title}
                      </h3>

                      <p
                        className="
                          text-blue-400
                          mt-2
                          text-sm
                          "
                      >
                        {assignedAgent?.emoji}{" "}
                        {assignedAgent?.name ?? "Unknown Agent"}
                      </p>
                    </div>

                    <div
                      className="
                        text-right
                        "
                    >
                      <p
                        className="
                          text-sm
                          text-gray-400
                          "
                      >
                        {task.status}
                      </p>

                      <p
                        className="
                          mt-1
                          "
                      >
                        {task.progress}%
                      </p>
                    </div>
                  </div>

                  <p
                    className="
                      text-gray-400
                      leading-7
                      mt-5
                      "
                  >
                    {task.description}
                  </p>

                  {/* DEPENDENCIES */}

                  {dependencyTasks.length > 0 && (
                    <div
                      className="
                        mt-5
                        "
                    >
                      <p
                        className="
                          text-yellow-400
                          text-sm
                          font-semibold
                          "
                      >
                        ⛓ Depends On
                      </p>

                      <div
                        className="
                          flex
                          flex-wrap
                          gap-2
                          mt-2
                          "
                      >
                        {dependencyTasks.map((dependency) => (
                          <span
                            key={dependency.id}
                            className="
                                text-xs
                                border
                                border-yellow-500/20
                                bg-yellow-500/10
                                text-yellow-300
                                rounded-full
                                px-3
                                py-1
                                "
                          >
                            {dependency.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CONTEXT */}

                  {contextTasks.length > 0 && (
                    <div
                      className="
                        mt-5
                        "
                    >
                      <p
                        className="
                          text-blue-400
                          text-sm
                          font-semibold
                          "
                      >
                        🤝 Collaboration Context
                      </p>

                      <div
                        className="
                          flex
                          flex-wrap
                          gap-2
                          mt-2
                          "
                      >
                        {contextTasks.map((contextTask) => {
                          const agent = agents.find(
                            (item) => item.id === contextTask.assignedAgent,
                          );

                          return (
                            <span
                              key={contextTask.id}
                              className="
                                  text-xs
                                  border
                                  border-blue-500/20
                                  bg-blue-500/10
                                  text-blue-300
                                  rounded-full
                                  px-3
                                  py-1
                                  "
                            >
                              {agent?.emoji} {contextTask.title}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* PROGRESS */}

                  <div
                    className="
                      mt-5
                      h-2
                      bg-white/10
                      rounded-full
                      overflow-hidden
                      "
                  >
                    <div
                      className="
                        h-full
                        bg-white
                        rounded-full
                        "
                      style={{
                        width: `${task.progress}%`,
                      }}
                    />
                  </div>

                  {/* RESULT */}

                  {task.status === "Completed" && task.result && (
                    <details
                      className="
                          mt-6
                          bg-[#080808]
                          border
                          border-white/10
                          rounded-xl
                          "
                    >
                      <summary
                        className="
                            cursor-pointer
                            p-5
                            font-semibold
                            hover:bg-white/[0.02]
                            "
                      >
                        📄 View Work Result
                      </summary>

                      <pre
                        className="
                            whitespace-pre-wrap
                            font-sans
                            text-sm
                            text-gray-300
                            leading-7
                            p-5
                            border-t
                            border-white/10
                            "
                      >
                        {task.result}
                      </pre>
                    </details>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* FINAL DELIVERABLE */}

        {mission.finalDeliverable && (
          <section
            className="
            mt-8
            bg-[#080808]
            border
            border-purple-500/30
            rounded-3xl
            p-8
            "
          >
            <div
              className="
              flex
              gap-4
              items-center
              "
            >
              <div
                className="
                text-4xl
                "
              >
                📦
              </div>

              <div>
                <h2
                  className="
                  text-2xl
                  font-bold
                  "
                >
                  Final Mission Deliverable
                </h2>

                <p
                  className="
                  text-gray-500
                  mt-1
                  "
                >
                  Reviewed and prepared by Valid
                </p>
              </div>
            </div>

            {mission.finalDeliverableCreatedAt && (
              <p
                className="
                text-xs
                text-gray-600
                mt-5
                "
              >
                Generated{" "}
                {new Date(mission.finalDeliverableCreatedAt).toLocaleString()}
              </p>
            )}

            <pre
              className="
              whitespace-pre-wrap
              font-sans
              text-sm
              text-gray-300
              leading-7
              mt-6
              "
            >
              {mission.finalDeliverable}
            </pre>
          </section>
        )}
      </div>
    </main>
  );
}
