"use client";

import Link from "next/link";

import { agents } from "@/data/agents";
import type { Mission } from "@/data/missions";
import type { MissionTask } from "@/data/tasks";

type MissionCardProps = {
  mission: Mission;

  tasks: MissionTask[];

  missionProgress: number;

  missionStatus: string;

  finalDeliverableAvailable: boolean;

  reviewingMissionId: number | null;

  reviewError?: string;

  onGenerateFinalReview: (mission: Mission) => void;
};

export default function MissionCard({
  mission,
  tasks,
  missionProgress,
  missionStatus,
  finalDeliverableAvailable,
  reviewingMissionId,
  reviewError,
  onGenerateFinalReview,
}: MissionCardProps) {
  const completedTaskCount = tasks.filter(
    (task) => task.status === "Completed",
  ).length;

  return (
    <article
      className="
      bg-[#080808]
      border
      border-white/10
      rounded-3xl
      p-8
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
          <h3
            className="
            text-3xl
            font-bold
            "
          >
            {mission.title}
          </h3>

          <p
            className="
            text-gray-400
            mt-2
            leading-6
            "
          >
            {mission.description}
          </p>

          <Link
            href={`/missions/${mission.id}`}
            className="
            inline-flex
            items-center
            gap-2
            mt-5
            text-sm
            border
            border-white/10
            bg-black
            hover:border-white/30
            rounded-xl
            px-4
            py-2
            transition
            "
          >
            Open Mission →
          </Link>
        </div>

        <span
          className={`
          px-4
          py-2
          rounded-full
          border
          text-sm

          ${
            missionStatus === "Completed"
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : missionStatus === "Active"
                ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
          }
          `}
        >
          {missionStatus}
        </span>
      </div>

      {/* AGENTS */}

      {mission.assignedAgents.length > 0 && (
        <div className="mt-6">
          <p
            className="
            text-gray-500
            text-sm
            "
          >
            Valid assigned:
          </p>

          <div
            className="
            flex
            flex-wrap
            gap-3
            mt-3
            "
          >
            {mission.assignedAgents.map((agentId) => {
              const agent = agents.find((item) => item.id === agentId);

              return (
                <span
                  key={agentId}
                  className="
                    bg-black
                    border
                    border-white/10
                    rounded-full
                    px-4
                    py-2
                    text-sm
                    "
                >
                  {agent?.emoji} {agent?.name ?? `Agent ${agentId}`}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* PROGRESS */}

      <div className="mt-6">
        <div
          className="
          flex
          justify-between
          text-sm
          "
        >
          <span className="text-gray-500">Progress</span>

          <span>{missionProgress}%</span>
        </div>

        <div
          className="
          w-full
          h-3
          bg-black
          border
          border-white/10
          rounded-full
          mt-2
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
              width: `${missionProgress}%`,
            }}
          />
        </div>
      </div>

      {/* SUMMARY */}

      <div
        className="
        grid
        md:grid-cols-3
        gap-4
        mt-6
        "
      >
        <div
          className="
          bg-black
          border
          border-white/10
          rounded-xl
          p-4
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
            text-xl
            font-bold
            mt-1
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
          rounded-xl
          p-4
          "
        >
          <p
            className="
            text-gray-500
            text-sm
            "
          >
            Completed
          </p>

          <p
            className="
            text-xl
            font-bold
            mt-1
            "
          >
            {completedTaskCount}
          </p>
        </div>

        <div
          className="
          bg-black
          border
          border-white/10
          rounded-xl
          p-4
          "
        >
          <p
            className="
            text-gray-500
            text-sm
            "
          >
            Final Review
          </p>

          <p
            className={`
            text-sm
            font-semibold
            mt-2

            ${finalDeliverableAvailable ? "text-green-400" : "text-gray-500"}
            `}
          >
            {finalDeliverableAvailable ? "✓ Available" : "Not generated"}
          </p>
        </div>
      </div>

      {/* FINAL REVIEW */}

      {missionProgress === 100 && !finalDeliverableAvailable && (
        <div
          className="
            mt-6
            border-t
            border-white/10
            pt-6
            "
        >
          <button
            type="button"
            disabled={reviewingMissionId !== null}
            onClick={() => onGenerateFinalReview(mission)}
            className="
              bg-purple-600
              hover:bg-purple-500
              disabled:bg-purple-950
              disabled:text-gray-500
              disabled:cursor-not-allowed
              px-5
              py-3
              rounded-xl
              font-semibold
              transition
              "
          >
            {reviewingMissionId === mission.id
              ? "🧠 Valid is reviewing team work..."
              : "🧠 Generate Final Review"}
          </button>

          {reviewError && (
            <p
              className="
                text-red-400
                mt-3
                text-sm
                "
            >
              {reviewError}
            </p>
          )}
        </div>
      )}

      {finalDeliverableAvailable && (
        <div
          className="
          mt-6
          border-t
          border-white/10
          pt-5
          "
        >
          <p
            className="
            text-purple-300
            text-sm
            "
          >
            📦 Valid has prepared the final mission deliverable.
          </p>

          <Link
            href={`/missions/${mission.id}`}
            className="
            inline-block
            mt-3
            text-sm
            text-white
            hover:text-purple-300
            "
          >
            View Final Deliverable →
          </Link>
        </div>
      )}
    </article>
  );
}
