"use client";

import Link from "next/link";
import { useState } from "react";

import { agents } from "@/data/agents";
import { defaultMissions, type Mission } from "@/data/missions";
import type { MissionTask } from "@/data/tasks";

import MissionCard from "@/app/missions/components/MissionCard";

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

import {
  markAIRequestStarted,
  markAIRequestCompleted,
  markAIRequestRateLimited,
  markQueuedRequestStarted,
  markAIRequestFailed,
} from "@/lib/aiRequestManager";

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

  const [reviewingMissionId, setReviewingMissionId] = useState<number | null>(
    null,
  );

  const [reviewErrors, setReviewErrors] = useState<Record<number, string>>({});

  /*
    SEARCH
  */

  const [searchQuery, setSearchQuery] = useState("");

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

    const MAX_RETRIES = 3;

    function getRetryDelay(errorMessage: string) {
      const retryMatch = errorMessage.match(/retry\s+in\s+([\d.]+)\s*s/i);

      if (!retryMatch) {
        return 10;
      }

      const seconds = Number.parseFloat(retryMatch[1]);

      if (!Number.isFinite(seconds)) {
        return 10;
      }

      return Math.max(2, Math.ceil(seconds) + 2);
    }

    function isQuotaError(errorMessage: string) {
      const normalizedMessage = errorMessage.toLowerCase();

      return (
        normalizedMessage.includes("quota") ||
        normalizedMessage.includes("rate limit") ||
        normalizedMessage.includes("resource_exhausted") ||
        normalizedMessage.includes("429") ||
        normalizedMessage.includes("high demand")
      );
    }

    function wait(milliseconds: number) {
      return new Promise<void>((resolve) => {
        window.setTimeout(resolve, milliseconds);
      });
    }

    let requestManagerStarted = false;
    let queuedForRetry = false;
    let requestManagerFinished = false;

    try {
      let data: OrchestrationResponse | null = null;

      markAIRequestStarted();
      requestManagerStarted = true;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        if (queuedForRetry) {
          markQueuedRequestStarted();
          queuedForRetry = false;
        }

        if (attempt > 0) {
          setPlanningError("");
          setPlanningMessage(
            `🧠 Valid is retrying orchestration... Retry ${attempt}/${MAX_RETRIES}`,
          );
        }

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

        const responseData = (await response.json()) as OrchestrationResponse;

        if (response.ok) {
          data = responseData;

          markAIRequestCompleted();
          requestManagerFinished = true;

          break;
        }

        const errorMessage =
          responseData.error ?? "Valid failed to plan the mission.";

        if (!isQuotaError(errorMessage)) {
          markAIRequestFailed(errorMessage);
          requestManagerFinished = true;

          throw new Error(errorMessage);
        }

        if (attempt === MAX_RETRIES) {
          const finalError =
            "Gemini is still unavailable after 3 automatic retries. Please try the mission again later.";

          markAIRequestFailed(finalError);
          requestManagerFinished = true;

          throw new Error(finalError);
        }

        const retryDelaySeconds = getRetryDelay(errorMessage);

        markAIRequestRateLimited(retryDelaySeconds, errorMessage);

        queuedForRetry = true;

        for (let remaining = retryDelaySeconds; remaining > 0; remaining -= 1) {
          setPlanningMessage(
            `⏳ Gemini is temporarily rate limited. Valid will retry automatically in ${remaining}s — Retry ${
              attempt + 1
            }/${MAX_RETRIES}`,
          );

          await wait(1000);
        }
      }

      if (
        !data ||
        !data.analysis ||
        !Array.isArray(data.tasks) ||
        data.tasks.length === 0
      ) {
        throw new Error("Valid returned an incomplete mission plan.");
      }

      setPlanningMessage("🧠 Valid finished analysing. Creating mission...");

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

      /*
  LOCAL MIGRATION FALLBACK

  Keep localStorage during the
  migration period so the working
  app remains safe.
*/

      saveMissions(updatedMissions);

      /*
  SUPABASE PERSISTENCE

  Save the same mission to our
  secure server-side API.
*/

      try {
        const missionResponse = await fetch("/api/missions", {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(newMission),
        });

        const missionData = await missionResponse.json();

        if (!missionResponse.ok) {
          console.error("Supabase mission save failed:", missionData);
        } else {
          console.log("Mission saved to Supabase:", missionData);
        }
      } catch (error) {
        /*
    Supabase failure must NOT destroy
    the mission because localStorage
    has already saved it.
  */

        console.error("Supabase mission sync error:", error);
      }

      const currentTasks = getTasks();

      const updatedTasks = [...currentTasks, ...newTasks];

      saveTasks(updatedTasks);

      setTasks(updatedTasks);

      /*
  SUPABASE TASK PERSISTENCE

  Keep localStorage as fallback
  while syncing the generated tasks
  to the new database.
*/

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

      setPlanningError("");

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

      if (requestManagerStarted && !requestManagerFinished) {
        markAIRequestFailed(message);
        requestManagerFinished = true;
      }

      setPlanningError(message);

      setPlanningMessage("");
    } finally {
      setIsPlanning(false);
    }
  }

  /*
    ORGANISE MISSION HISTORY
  */

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredMissions = missions.filter((mission) => {
    if (!normalizedSearch) {
      return true;
    }

    return (
      mission.title.toLowerCase().includes(normalizedSearch) ||
      mission.description.toLowerCase().includes(normalizedSearch)
    );
  });

  /*
    Newest first.

    Mission IDs are created using
    Date.now(), so larger IDs are
    newer missions.
  */

  const activeMissions = filteredMissions
    .filter((mission) => calculateMissionProgress(mission.id) < 100)
    .sort((a, b) => b.id - a.id);

  const completedMissions = filteredMissions
    .filter((mission) => calculateMissionProgress(mission.id) === 100)
    .sort((a, b) => b.id - a.id);

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
            onChange={(event) => setTitle(event.target.value)}
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
            onChange={(event) => setDescription(event.target.value)}
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

        {/* MISSION HISTORY */}

        <section className="mt-12">
          <div
            className="
            flex
            items-end
            justify-between
            gap-6
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
                Mission History
              </h2>

              <p
                className="
                text-gray-500
                mt-2
                "
              >
                Track active work and revisit completed AI company missions.
              </p>
            </div>

            {/* SEARCH */}

            <div
              className="
              w-full
              md:w-[360px]
              "
            >
              <label
                className="
                block
                text-xs
                uppercase
                tracking-widest
                text-gray-600
                mb-2
                "
              >
                🔎 Search Missions
              </label>

              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search title or description..."
                className="
                w-full
                bg-[#080808]
                border
                border-white/10
                rounded-xl
                px-4
                py-3
                outline-none
                text-sm
                focus:border-white/30
                "
              />
            </div>
          </div>

          {/* HISTORY STATS */}

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
              bg-[#080808]
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
                Total Missions
              </p>

              <p
                className="
                text-3xl
                font-bold
                mt-2
                "
              >
                {filteredMissions.length}
              </p>
            </div>

            <div
              className="
              bg-[#080808]
              border
              border-blue-500/20
              rounded-2xl
              p-5
              "
            >
              <p
                className="
                text-blue-400
                text-sm
                "
              >
                Active
              </p>

              <p
                className="
                text-3xl
                font-bold
                mt-2
                "
              >
                {activeMissions.length}
              </p>
            </div>

            <div
              className="
              bg-[#080808]
              border
              border-green-500/20
              rounded-2xl
              p-5
              "
            >
              <p
                className="
                text-green-400
                text-sm
                "
              >
                Completed
              </p>

              <p
                className="
                text-3xl
                font-bold
                mt-2
                "
              >
                {completedMissions.length}
              </p>
            </div>
          </div>

          {/* ACTIVE MISSIONS */}

          <div className="mt-12">
            <div
              className="
              flex
              items-center
              justify-between
              gap-4
              "
            >
              <div>
                <h3
                  className="
                  text-2xl
                  font-bold
                  "
                >
                  🔵 Active Missions
                </h3>

                <p
                  className="
                  text-gray-600
                  text-sm
                  mt-1
                  "
                >
                  Missions still being planned or worked on by the AI team.
                </p>
              </div>

              <span
                className="
                bg-blue-500/10
                border
                border-blue-500/20
                text-blue-400
                rounded-full
                px-4
                py-2
                text-sm
                "
              >
                {activeMissions.length}
              </span>
            </div>

            {activeMissions.length === 0 ? (
              <div
                className="
                mt-5
                bg-[#080808]
                border
                border-white/10
                rounded-2xl
                p-8
                text-gray-500
                "
              >
                {normalizedSearch
                  ? "No active missions match your search."
                  : "No active missions right now."}
              </div>
            ) : (
              <div
                className="
                mt-5
                space-y-6
                "
              >
                {activeMissions.map((mission) => {
                  const missionTasks = tasks.filter(
                    (task) => task.missionId === mission.id,
                  );

                  return (
                    <MissionCard
                      key={mission.id}
                      mission={mission}
                      tasks={missionTasks}
                      missionProgress={calculateMissionProgress(mission.id)}
                      missionStatus={calculateMissionStatus(mission.id)}
                      finalDeliverableAvailable={Boolean(
                        mission.finalDeliverable,
                      )}
                      reviewingMissionId={reviewingMissionId}
                      reviewError={reviewErrors[mission.id]}
                      onGenerateFinalReview={handleGenerateFinalReview}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* COMPLETED MISSIONS */}

          <div className="mt-14">
            <div
              className="
              flex
              items-center
              justify-between
              gap-4
              "
            >
              <div>
                <h3
                  className="
                  text-2xl
                  font-bold
                  "
                >
                  🟢 Completed Missions
                </h3>

                <p
                  className="
                  text-gray-600
                  text-sm
                  mt-1
                  "
                >
                  Finished AI company missions and Valid deliverables.
                </p>
              </div>

              <span
                className="
                bg-green-500/10
                border
                border-green-500/20
                text-green-400
                rounded-full
                px-4
                py-2
                text-sm
                "
              >
                {completedMissions.length}
              </span>
            </div>

            {completedMissions.length === 0 ? (
              <div
                className="
                mt-5
                bg-[#080808]
                border
                border-white/10
                rounded-2xl
                p-8
                text-gray-500
                "
              >
                {normalizedSearch
                  ? "No completed missions match your search."
                  : "No completed missions yet."}
              </div>
            ) : (
              <div
                className="
                mt-5
                space-y-6
                "
              >
                {completedMissions.map((mission) => {
                  const missionTasks = tasks.filter(
                    (task) => task.missionId === mission.id,
                  );

                  return (
                    <MissionCard
                      key={mission.id}
                      mission={mission}
                      tasks={missionTasks}
                      missionProgress={calculateMissionProgress(mission.id)}
                      missionStatus={calculateMissionStatus(mission.id)}
                      finalDeliverableAvailable={Boolean(
                        mission.finalDeliverable,
                      )}
                      reviewingMissionId={reviewingMissionId}
                      reviewError={reviewErrors[mission.id]}
                      onGenerateFinalReview={handleGenerateFinalReview}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
