"use client";

import Link from "next/link";
import { useState } from "react";

import { agents } from "@/data/agents";
import { defaultMissions, type Mission } from "@/data/missions";
import type { MissionTask } from "@/data/tasks";

import { getMissions, saveMissions } from "@/lib/missionStorage";

import { saveTasks, getTasks } from "@/lib/taskStorage";

import {
  calculateMissionProgress,
  calculateMissionStatus,
} from "@/lib/taskEngine";

import { generateMissionTasks, type DelegatedTask } from "@/lib/taskGenerator";

import { saveMissionMemory } from "@/lib/missionMemory";
import { saveAgentMemory } from "@/lib/agentMemory";

import { recordMissionAnalysis, createManagerReport } from "@/lib/aiManager";

import { getManagerMemory, saveManagerMemory } from "@/lib/managerMemory";

type AgentMemory = {
  id: number;
  currentTask: string;
  missionStatus: string;
  location: string;
  energy: number;
  lastAction: string;
};

type OrchestrationResponse = {
  success?: boolean;
  analysis?: string;
  tasks?: DelegatedTask[];
  error?: string;
};

type FinalReviewResponse = {
  success?: boolean;
  finalDeliverable?: string;
  error?: string;
};

export default function Missions() {
  const [missions, setMissions] = useState<Mission[]>(() => {
    const savedMissions = getMissions();

    return savedMissions.length > 0 ? savedMissions : defaultMissions;
  });

  const [tasks, setTasks] = useState<MissionTask[]>(getTasks());

  const [title, setTitle] = useState("");

  const [description, setDescription] = useState("");

  const [isPlanning, setIsPlanning] = useState(false);

  const [planningMessage, setPlanningMessage] = useState("");

  const [planningError, setPlanningError] = useState("");

  /*
    FINAL REVIEW STATE
  */

  const [reviewingMissionId, setReviewingMissionId] = useState<number | null>(
    null,
  );

  const [finalDeliverables, setFinalDeliverables] = useState<
    Record<number, string>
  >(() => {
    const savedMissions = getMissions();

    const savedReviews: Record<number, string> = {};

    savedMissions.forEach((mission) => {
      if (mission.finalDeliverable) {
        savedReviews[mission.id] = mission.finalDeliverable;
      }
    });

    return savedReviews;
  });

  const [reviewErrors, setReviewErrors] = useState<Record<number, string>>({});

  /*
    VALID FINAL MISSION REVIEW
  */

  async function handleGenerateFinalReview(mission: Mission) {
    if (reviewingMissionId !== null) {
      return;
    }

    const latestTasks = getTasks();

    const missionTasks = latestTasks.filter(
      (task) => task.missionId === mission.id,
    );

    const completedTasks = missionTasks.filter(
      (task) => task.status === "Completed" && Boolean(task.result?.trim()),
    );

    if (missionTasks.length === 0) {
      setReviewErrors((current) => ({
        ...current,

        [mission.id]: "This mission does not have any tasks.",
      }));

      return;
    }

    if (completedTasks.length !== missionTasks.length) {
      setReviewErrors((current) => ({
        ...current,

        [mission.id]:
          "All mission tasks must be completed before Valid can create the final review.",
      }));

      return;
    }

    setReviewingMissionId(mission.id);

    setReviewErrors((current) => ({
      ...current,
      [mission.id]: "",
    }));

    try {
      const reviewTasks = completedTasks.map((task) => {
        const assignedAgent = agents.find(
          (agent) => agent.id === task.assignedAgent,
        );

        return {
          title: task.title,

          description: task.description,

          assignedAgent: task.assignedAgent,

          agentName: assignedAgent?.name ?? "AI Agent",

          result: task.result ?? "",
        };
      });

      const response = await fetch("/api/final-review", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          missionTitle: mission.title,

          missionDescription: mission.description,

          completedTasks: reviewTasks,
        }),
      });

      const data = (await response.json()) as FinalReviewResponse;

      if (!response.ok) {
        throw new Error(
          data.error ?? "Valid failed to create the final mission review.",
        );
      }

      if (!data.finalDeliverable) {
        throw new Error("Valid returned an empty final mission review.");
      }

      /*
        DISPLAY RESULT
      */

      setFinalDeliverables((current) => ({
        ...current,

        [mission.id]: data.finalDeliverable as string,
      }));

      /*
        PERSIST FINAL DELIVERABLE
      */

      const latestMissions = getMissions();

      const updatedMissions = latestMissions.map((item) => {
        if (item.id !== mission.id) {
          return item;
        }

        return {
          ...item,

          finalDeliverable: data.finalDeliverable,

          finalDeliverableCreatedAt: new Date().toISOString(),
        };
      });

      saveMissions(updatedMissions);

      setMissions(updatedMissions);

      /*
        SAVE INTO VALID MEMORY
      */

      const currentMemory = getManagerMemory();

      saveManagerMemory({
        missionTitle: mission.title,

        analysis:
          currentMemory?.missionTitle === mission.title
            ? currentMemory.analysis
            : "Mission completed and reviewed by Valid.",

        decision:
          currentMemory?.missionTitle === mission.title
            ? currentMemory.decision
            : "Valid completed the final CEO review.",

        createdAt:
          currentMemory?.missionTitle === mission.title
            ? currentMemory.createdAt
            : new Date().toISOString(),

        finalDeliverable: data.finalDeliverable,

        finalDeliverableCreatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Final mission review error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Valid failed to create the final mission review.";

      setReviewErrors((current) => ({
        ...current,

        [mission.id]: message,
      }));
    } finally {
      setReviewingMissionId(null);
    }
  }

  /*
    VALID CEO ORCHESTRATION
  */

  async function launchMission() {
    const cleanTitle = title.trim();

    const cleanDescription = description.trim();

    if (!cleanTitle) {
      alert("Enter mission title");

      return;
    }

    if (isPlanning) {
      return;
    }

    setIsPlanning(true);

    setPlanningError("");

    setPlanningMessage("🧠 Valid is analysing the mission...");

    try {
      const response = await fetch("/api/orchestrate", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          missionTitle: cleanTitle,

          missionDescription: cleanDescription,
        }),
      });

      const data = (await response.json()) as OrchestrationResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Valid failed to plan the mission.");
      }

      if (
        !data.analysis ||
        !Array.isArray(data.tasks) ||
        data.tasks.length === 0
      ) {
        throw new Error("Valid returned an incomplete mission plan.");
      }

      const missionId = Date.now();

      const newTasks = generateMissionTasks(missionId, data.tasks);

      const assignedAgentIds = [
        ...new Set(newTasks.map((task) => task.assignedAgent)),
      ];

      const newMission: Mission = {
        id: missionId,

        title: cleanTitle,

        description: cleanDescription,

        status: "Active",

        progress: 0,

        assignedAgents: assignedAgentIds,

        finalDeliverable: "",

        finalDeliverableCreatedAt: "",
      };

      const updatedMissions = [...missions, newMission];

      setMissions(updatedMissions);

      saveMissions(updatedMissions);

      const currentTasks = getTasks();

      const updatedTasks = [...currentTasks, ...newTasks];

      saveTasks(updatedTasks);

      setTasks(updatedTasks);

      saveMissionMemory({
        title: cleanTitle,

        description: cleanDescription,
      });

      recordMissionAnalysis(newMission);

      const report = createManagerReport(newMission, newTasks);

      saveManagerMemory({
        missionTitle: newMission.title,

        analysis: data.analysis,

        decision: `Valid delegated ${newTasks.length} task(s) to ${
          assignedAgentIds.length
        } AI agent(s): ${report.tasks
          .map((task) => task.assignedAgentName)
          .join(", ")}.`,

        createdAt: new Date().toISOString(),
      });

      console.log("Valid Orchestration:", data);

      console.log("Mission Report:", report);

      const memories: AgentMemory[] = agents.map((agent) => {
        const agentTasks = newTasks.filter(
          (task) => task.assignedAgent === agent.id,
        );

        const firstTask = agentTasks[0];

        if (firstTask) {
          return {
            id: agent.id,

            currentTask: firstTask.title,

            missionStatus: "Pending",

            location: "AI Core Meeting Room",

            energy: 100,

            lastAction: `Received mission assignment from Valid: ${firstTask.title}`,
          };
        }

        return {
          id: agent.id,

          currentTask: "Waiting for assignment",

          missionStatus: "Idle",

          location: "Office",

          energy: 100,

          lastAction: "No active mission",
        };
      });

      saveAgentMemory(memories);

      setPlanningMessage(
        `✅ Valid created ${newTasks.length} task(s) and delegated the mission.`,
      );

      setTitle("");

      setDescription("");

      window.setTimeout(() => {
        setPlanningMessage("");
      }, 5000);
    } catch (error) {
      console.error("Mission orchestration error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Valid failed to orchestrate the mission.";

      setPlanningError(message);

      setPlanningMessage("");
    } finally {
      setIsPlanning(false);
    }
  }

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
          href="/hq"
          className="
          text-gray-400
          hover:text-white
          "
        >
          ← Back to HQ
        </Link>

        <h1
          className="
          text-5xl
          font-bold
          mt-10
          "
        >
          📋 Mission Control
        </h1>

        <p
          className="
          text-gray-500
          mt-3
          text-lg
          "
        >
          Give Valid one mission. Valid will analyse it, choose the right
          departments, and manage the AI team.
        </p>

        {/* CREATE MISSION */}

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
            items-center
            justify-between
            gap-5
            flex-wrap
            "
          >
            <div>
              <h2
                className="
                text-3xl
                font-bold
                "
              >
                🧠 CEO Mission Brief
              </h2>

              <p
                className="
                text-gray-500
                mt-2
                "
              >
                Valid will choose the required departments automatically.
              </p>
            </div>

            <div
              className="
              px-4
              py-2
              border
              border-purple-500/20
              bg-purple-500/10
              text-purple-300
              rounded-full
              text-sm
              "
            >
              Valid Orchestration
            </div>
          </div>

          <label
            className="
            block
            text-sm
            text-gray-400
            mt-8
            mb-2
            "
          >
            Mission Title
          </label>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What should AI Studio HQ accomplish?"
            disabled={isPlanning}
            className="
            w-full
            bg-black
            border
            border-white/20
            rounded-xl
            p-4
            outline-none
            focus:border-white/40
            disabled:opacity-50
            "
          />

          <label
            className="
            block
            text-sm
            text-gray-400
            mt-5
            mb-2
            "
          >
            Mission Description
          </label>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the mission, requirements, goals and constraints..."
            disabled={isPlanning}
            className="
            w-full
            bg-black
            border
            border-white/20
            rounded-xl
            p-4
            h-40
            outline-none
            resize-none
            focus:border-white/40
            disabled:opacity-50
            "
          />

          <div
            className="
            mt-8
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
              gap-4
              items-start
              "
            >
              <div className="text-4xl">🧠</div>

              <div>
                <h3
                  className="
                  font-bold
                  text-lg
                  "
                >
                  Valid controls delegation
                </h3>

                <p
                  className="
                  text-gray-500
                  mt-2
                  leading-6
                  "
                >
                  Valid analyses the mission, chooses the correct specialists,
                  creates task dependencies, and coordinates the AI company.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={launchMission}
            disabled={isPlanning || !title.trim()}
            className="
            mt-8
            bg-white
            text-black
            px-10
            py-4
            rounded-xl
            font-bold
            hover:bg-gray-200
            disabled:opacity-50
            disabled:cursor-not-allowed
            transition
            "
          >
            {isPlanning ? "🧠 Valid is Planning..." : "🚀 Launch Mission"}
          </button>

          {planningMessage && (
            <div
              className="
              mt-6
              bg-blue-500/10
              border
              border-blue-500/20
              text-blue-300
              rounded-xl
              p-5
              "
            >
              {planningMessage}
            </div>
          )}

          {planningError && (
            <div
              className="
              mt-6
              bg-yellow-500/10
              border
              border-yellow-500/20
              text-yellow-300
              rounded-xl
              p-5
              "
            >
              <p className="font-bold">⚠ Valid Orchestration Error</p>

              <p
                className="
                text-gray-400
                mt-2
                "
              >
                {planningError}
              </p>
            </div>
          )}
        </section>

        {/* MISSIONS */}

        <section className="mt-10">
          <h2
            className="
            text-3xl
            font-bold
            "
          >
            Mission History
          </h2>

          <p
            className="
            text-gray-500
            mt-2
            "
          >
            Open a mission to view its complete workflow, agent results and
            final deliverable.
          </p>

          {missions.map((mission) => {
            const missionProgress = calculateMissionProgress(mission.id);

            const missionStatus = calculateMissionStatus(mission.id);

            const missionTasks = tasks.filter(
              (task) => task.missionId === mission.id,
            );

            const completedTaskCount = missionTasks.filter(
              (task) => task.status === "Completed",
            ).length;

            return (
              <div
                key={mission.id}
                className="
                  mt-6
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
                        const agent = agents.find(
                          (item) => item.id === agentId,
                        );

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
                      {missionTasks.length}
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

                        ${
                          mission.finalDeliverable
                            ? "text-green-400"
                            : "text-gray-500"
                        }
                        `}
                    >
                      {mission.finalDeliverable
                        ? "✓ Available"
                        : "Not generated"}
                    </p>
                  </div>
                </div>

                {/* FINAL REVIEW */}

                {missionProgress === 100 && !mission.finalDeliverable && (
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
                      onClick={() => handleGenerateFinalReview(mission)}
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

                    {reviewErrors[mission.id] && (
                      <p
                        className="
                            text-red-400
                            mt-3
                            text-sm
                            "
                      >
                        {reviewErrors[mission.id]}
                      </p>
                    )}
                  </div>
                )}

                {finalDeliverables[mission.id] && (
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
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
