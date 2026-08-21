"use client";

import Link from "next/link";
import { useState } from "react";

import { agents } from "@/data/agents";
import { defaultMissions, type Mission } from "@/data/missions";
import type { MissionTask } from "@/data/tasks";

import { getMissions, saveMissions } from "@/lib/missionStorage";
import { saveTasks, getTasks } from "@/lib/taskStorage";

import { startAgentTask, completeAgentTask } from "@/lib/workEngine";

import {
  calculateMissionProgress,
  calculateMissionStatus,
} from "@/lib/taskEngine";

import { generateMissionTasks, type DelegatedTask } from "@/lib/taskGenerator";

import { saveMissionMemory } from "@/lib/missionMemory";
import { saveAgentMemory } from "@/lib/agentMemory";

import { recordMissionAnalysis, createManagerReport } from "@/lib/aiManager";

import { saveManagerMemory } from "@/lib/managerMemory";

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

  const [, refresh] = useState(0);

  function handleStartTask(taskId: number) {
    startAgentTask(taskId);

    const updatedTasks = getTasks();

    setTasks([...updatedTasks]);

    refresh((value) => value + 1);
  }

  async function handleCompleteTask(taskId: number) {
    await completeAgentTask(taskId);

    const updatedTasks = getTasks();

    setTasks([...updatedTasks]);

    refresh((value) => value + 1);
  }

  /*
    VALID CEO ORCHESTRATION

    USER
      ↓
    Mission Control
      ↓
    /api/orchestrate
      ↓
    Valid analyses mission
      ↓
    Valid chooses agents
      ↓
    Valid creates tasks
      ↓
    Tasks appear in agent rooms
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
      /*
        ASK VALID TO CREATE
        THE COMPANY PLAN
      */

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

      /*
        CREATE MISSION ID
      */

      const missionId = Date.now();

      /*
        TURN VALID'S PLAN
        INTO REAL MISSION TASKS
      */

      const newTasks = generateMissionTasks(missionId, data.tasks);

      /*
        FIND WHICH AGENTS
        VALID ACTUALLY CHOSE
      */

      const assignedAgentIds = [
        ...new Set(newTasks.map((task) => task.assignedAgent)),
      ];

      /*
        CREATE THE MISSION
      */

      const newMission: Mission = {
        id: missionId,

        title: cleanTitle,

        description: cleanDescription,

        status: "Active",

        progress: 0,

        assignedAgents: assignedAgentIds,
      };

      /*
        SAVE MISSIONS
      */

      const updatedMissions = [...missions, newMission];

      setMissions(updatedMissions);

      saveMissions(updatedMissions);

      /*
        SAVE VALID'S GENERATED TASKS
      */

      const currentTasks = getTasks();

      const updatedTasks = [...currentTasks, ...newTasks];

      saveTasks(updatedTasks);

      setTasks(updatedTasks);

      /*
        SAVE MISSION MEMORY
      */

      saveMissionMemory({
        title: cleanTitle,

        description: cleanDescription,
      });

      /*
        RECORD VALID ACTIVITY
      */

      recordMissionAnalysis(newMission);

      /*
        CREATE MANAGER REPORT
      */

      const report = createManagerReport(newMission, newTasks);

      /*
        SAVE VALID'S REAL
        GEMINI ANALYSIS
      */

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

      /*
        UPDATE AGENT MEMORY

        Agents selected by Valid receive
        their first mission task.

        Everyone else remains idle.
      */

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

      /*
        SUCCESS UI
      */

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
          Give Valid one mission. Valid will analyse it and delegate work to the
          AI team.
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

          {/* VALID INFO */}

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
                  You no longer need to manually choose agents. Valid will
                  analyse the mission and select only the specialists that are
                  actually required.
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

              <p
                className="
                text-gray-500
                text-sm
                mt-3
                "
              >
                Your mission was not created. You can safely try again later.
              </p>
            </div>
          )}
        </section>

        {/* ACTIVE MISSIONS */}

        <section className="mt-10">
          <h2
            className="
            text-3xl
            font-bold
            "
          >
            Active Missions
          </h2>

          {missions.map((mission) => {
            const missionProgress = calculateMissionProgress(mission.id);

            const missionStatus = calculateMissionStatus(mission.id);

            const missionTasks = tasks.filter(
              (task) => task.missionId === mission.id,
            );

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
                    gap-5
                    flex-wrap
                    "
                >
                  <div>
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
                        "
                    >
                      {mission.description}
                    </p>
                  </div>

                  <span
                    className="
                      text-green-400
                      text-sm
                      "
                  >
                    {missionStatus}
                  </span>
                </div>

                {/* DEPARTMENTS */}

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

                <p className="mt-6">Progress</p>

                <div
                  className="
                    w-full
                    h-4
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
                      h-4
                      bg-white
                      rounded-full
                      transition-all
                      "
                    style={{
                      width: `${missionProgress}%`,
                    }}
                  />
                </div>

                <p className="mt-2">{missionProgress}%</p>

                {/* TASKS */}

                <h4
                  className="
                    text-xl
                    font-bold
                    mt-8
                    "
                >
                  Delegated Tasks
                </h4>

                <div
                  className="
                    mt-4
                    space-y-4
                    "
                >
                  {missionTasks.length === 0 ? (
                    <p
                      className="
                        text-gray-500
                        "
                    >
                      No tasks generated.
                    </p>
                  ) : (
                    missionTasks.map((task) => {
                      const assignedAgent = agents.find(
                        (agent) => agent.id === task.assignedAgent,
                      );

                      return (
                        <div
                          key={task.id}
                          className="
                              bg-black
                              border
                              border-white/10
                              rounded-xl
                              p-5
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
                                    font-bold
                                    text-lg
                                    "
                              >
                                {task.status === "Completed"
                                  ? "✅"
                                  : task.status === "Working"
                                    ? "⚙️"
                                    : "⏳"}{" "}
                                {task.title}
                              </p>

                              <p
                                className="
                                    text-blue-400
                                    text-sm
                                    mt-2
                                    "
                              >
                                Assigned by Valid → {assignedAgent?.emoji}{" "}
                                {assignedAgent?.name ?? "Unknown Agent"}
                              </p>
                            </div>

                            <span
                              className="
                                  text-sm
                                  text-gray-400
                                  "
                            >
                              {task.progress}%
                            </span>
                          </div>

                          <p
                            className="
                                text-gray-400
                                mt-4
                                leading-6
                                "
                          >
                            {task.description}
                          </p>

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

                          <p
                            className="
                                mt-3
                                text-sm
                                text-gray-500
                                "
                          >
                            Status: {task.status}
                          </p>

                          <div
                            className="
                                flex
                                gap-3
                                mt-4
                                "
                          >
                            {task.status === "Pending" && (
                              <button
                                type="button"
                                onClick={() => handleStartTask(task.id)}
                                className="
                                    bg-blue-600
                                    px-4
                                    py-2
                                    rounded-lg
                                    "
                              >
                                ▶ Start Task
                              </button>
                            )}

                            {task.status !== "Completed" && (
                              <button
                                type="button"
                                onClick={() => handleCompleteTask(task.id)}
                                className="
                                    bg-green-600
                                    px-4
                                    py-2
                                    rounded-lg
                                    "
                              >
                                ✅ Complete
                              </button>
                            )}
                          </div>

                          {task.status === "Completed" && task.result && (
                            <div
                              className="
                                    mt-6
                                    bg-[#080808]
                                    border
                                    border-white/10
                                    rounded-xl
                                    p-5
                                    "
                            >
                              <p className="font-bold">📄 Work Result</p>

                              <pre
                                className="
                                      whitespace-pre-wrap
                                      font-sans
                                      text-sm
                                      text-gray-300
                                      leading-6
                                      mt-4
                                      "
                              >
                                {task.result}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
