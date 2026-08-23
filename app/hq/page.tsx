"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { agents } from "@/data/agents";
import type { MissionTask } from "@/data/tasks";

import { getTasks } from "@/lib/taskStorage";

import { getAIRequestState, type AIRequestState } from "@/lib/aiRequestManager";

type AgentOperationalStatus = "Working" | "Waiting" | "Assigned" | "Idle";

function getAgentOperationalStatus(
  agentId: number,
  tasks: MissionTask[],
): AgentOperationalStatus {
  const agentTasks = tasks.filter(
    (task) => task.assignedAgent === agentId && task.status !== "Completed",
  );

  const workingTask = agentTasks.find((task) => task.status === "Working");

  if (workingTask) {
    return "Working";
  }

  const pendingTasks = agentTasks.filter((task) => task.status === "Pending");

  if (pendingTasks.length === 0) {
    return "Idle";
  }

  const waitingTask = pendingTasks.find((task) => {
    const dependencies = task.dependsOn ?? [];

    if (dependencies.length === 0) {
      return false;
    }

    return !dependencies.every((dependencyId) => {
      const dependencyTask = tasks.find((item) => item.id === dependencyId);

      return dependencyTask?.status === "Completed";
    });
  });

  if (waitingTask) {
    return "Waiting";
  }

  return "Assigned";
}

function getCurrentAgentTask(agentId: number, tasks: MissionTask[]) {
  const workingTask = tasks.find(
    (task) => task.assignedAgent === agentId && task.status === "Working",
  );

  if (workingTask) {
    return workingTask;
  }

  return tasks.find(
    (task) => task.assignedAgent === agentId && task.status === "Pending",
  );
}

function getStatusClasses(status: AgentOperationalStatus) {
  switch (status) {
    case "Working":
      return {
        badge: "border-green-500/30 bg-green-500/10 text-green-400",

        dot: "bg-green-400",
      };

    case "Waiting":
      return {
        badge: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",

        dot: "bg-yellow-400",
      };

    case "Assigned":
      return {
        badge: "border-blue-500/30 bg-blue-500/10 text-blue-400",

        dot: "bg-blue-400",
      };

    default:
      return {
        badge: "border-white/10 bg-white/[0.03] text-gray-500",

        dot: "bg-gray-600",
      };
  }
}

function getAIStatusClasses(status: AIRequestState["status"]) {
  switch (status) {
    case "Processing":
      return {
        text: "text-green-400",

        border: "border-green-500/20",

        background: "bg-green-500/10",

        dot: "bg-green-400",
      };

    case "Rate Limited":
      return {
        text: "text-yellow-400",

        border: "border-yellow-500/20",

        background: "bg-yellow-500/10",

        dot: "bg-yellow-400",
      };

    case "Waiting":
      return {
        text: "text-blue-400",

        border: "border-blue-500/20",

        background: "bg-blue-500/10",

        dot: "bg-blue-400",
      };

    case "Error":
      return {
        text: "text-red-400",

        border: "border-red-500/20",

        background: "bg-red-500/10",

        dot: "bg-red-400",
      };

    default:
      return {
        text: "text-gray-400",

        border: "border-white/10",

        background: "bg-white/[0.03]",

        dot: "bg-gray-500",
      };
  }
}

function getRetryText(retryAt: string) {
  if (!retryAt) {
    return "—";
  }

  const retryTime = new Date(retryAt).getTime();

  const remaining = retryTime - Date.now();

  if (remaining <= 0) {
    return "Ready";
  }

  const seconds = Math.ceil(remaining / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);

  const leftoverSeconds = seconds % 60;

  return `${minutes}m ${leftoverSeconds}s`;
}

export default function HQPage() {
  /*
    HYDRATION-SAFE INITIAL STATE

    The server and first browser render
    must use the same values.

    Real localStorage values are loaded
    only after the component mounts.
  */

  const [tasks, setTasks] = useState<MissionTask[]>([]);

  const [aiRequestState, setAIRequestState] = useState<AIRequestState>({
    status: "Idle",

    activeRequests: 0,

    queuedRequests: 0,

    failedRequests: 0,

    lastError: "",

    retryAt: "",
  });

  /*
    LIVE HQ SYNCHRONIZATION

    Once mounted in the browser,
    read task + AI request state
    from localStorage every second.
  */

  useEffect(() => {
    const syncHQ = () => {
      setTasks(getTasks());

      setAIRequestState(getAIRequestState());
    };

    syncHQ();

    const interval = window.setInterval(syncHQ, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const workingAgents = agents.filter(
    (agent) => getAgentOperationalStatus(agent.id, tasks) === "Working",
  ).length;

  const waitingAgents = agents.filter(
    (agent) => getAgentOperationalStatus(agent.id, tasks) === "Waiting",
  ).length;

  const assignedAgents = agents.filter(
    (agent) => getAgentOperationalStatus(agent.id, tasks) === "Assigned",
  ).length;

  const idleAgents = agents.filter(
    (agent) => getAgentOperationalStatus(agent.id, tasks) === "Idle",
  ).length;

  const aiStatusClasses = getAIStatusClasses(aiRequestState.status);

  return (
    <main
      className="
      min-h-screen
      bg-black
      text-white
      p-8
      "
    >
      <div
        className="
        max-w-7xl
        mx-auto
        "
      >
        {/* HEADER */}

        <header
          className="
          text-center
          mb-14
          "
        >
          <div
            className="
            text-7xl
            "
          >
            🏢
          </div>

          <h1
            className="
            text-6xl
            font-bold
            mt-5
            "
          >
            AI STUDIO HQ
          </h1>

          <p
            className="
            text-gray-500
            mt-3
            text-lg
            "
          >
            Underground Artificial Intelligence Facility
          </p>
        </header>

        {/* AI REQUEST MANAGER */}

        <section
          className="
          mb-8
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
            <div>
              <p
                className="
                text-xs
                uppercase
                tracking-widest
                text-gray-600
                "
              >
                AI Infrastructure
              </p>

              <h2
                className="
                text-3xl
                font-bold
                mt-2
                "
              >
                🧠 AI Request Manager
              </h2>

              <p
                className="
                text-gray-500
                mt-2
                "
              >
                Shared Gemini request, queue and retry status across Valid and
                all specialist agents.
              </p>
            </div>

            <div
              className={`
              inline-flex
              items-center
              gap-2
              px-4
              py-2
              rounded-full
              border
              text-sm
              ${aiStatusClasses.border}
              ${aiStatusClasses.background}
              ${aiStatusClasses.text}
              `}
            >
              <span
                className={`
                w-2
                h-2
                rounded-full
                ${aiStatusClasses.dot}
                `}
              />

              {aiRequestState.status}
            </div>
          </div>

          <div
            className="
            grid
            sm:grid-cols-2
            lg:grid-cols-5
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
                Provider
              </p>

              <p
                className="
                text-xl
                font-bold
                mt-2
                "
              >
                Gemini
              </p>
            </div>

            <div
              className="
              bg-black
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
                Active Requests
              </p>

              <p
                className="
                text-3xl
                font-bold
                mt-2
                "
              >
                {aiRequestState.activeRequests}
              </p>
            </div>

            <div
              className="
              bg-black
              border
              border-yellow-500/20
              rounded-2xl
              p-5
              "
            >
              <p
                className="
                text-yellow-400
                text-sm
                "
              >
                Queued
              </p>

              <p
                className="
                text-3xl
                font-bold
                mt-2
                "
              >
                {aiRequestState.queuedRequests}
              </p>
            </div>

            <div
              className="
              bg-black
              border
              border-red-500/20
              rounded-2xl
              p-5
              "
            >
              <p
                className="
                text-red-400
                text-sm
                "
              >
                Failed
              </p>

              <p
                className="
                text-3xl
                font-bold
                mt-2
                "
              >
                {aiRequestState.failedRequests}
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
                Next Retry
              </p>

              <p
                className="
                text-xl
                font-bold
                mt-2
                "
              >
                {getRetryText(aiRequestState.retryAt)}
              </p>
            </div>
          </div>

          {aiRequestState.lastError && (
            <div
              className="
              mt-5
              bg-black
              border
              border-white/10
              rounded-2xl
              p-5
              "
            >
              <p
                className="
                text-xs
                uppercase
                tracking-widest
                text-gray-600
                "
              >
                Last AI Event
              </p>

              <p
                className="
                text-gray-400
                text-sm
                leading-6
                mt-2
                break-words
                "
              >
                {aiRequestState.lastError}
              </p>
            </div>
          )}
        </section>

        {/* LIVE OPERATIONS */}

        <section
          className="
          mb-8
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
              <p
                className="
                text-xs
                uppercase
                tracking-widest
                text-gray-600
                "
              >
                Live Operations
              </p>

              <h2
                className="
                text-3xl
                font-bold
                mt-2
                "
              >
                🛰️ AI Company Status
              </h2>

              <p
                className="
                text-gray-500
                mt-2
                "
              >
                Current employee state based on real mission tasks.
              </p>
            </div>

            <div
              className="
              px-4
              py-2
              rounded-full
              border
              border-green-500/20
              bg-green-500/10
              text-green-400
              text-sm
              "
            >
              ● HQ Online
            </div>
          </div>

          <div
            className="
            grid
            sm:grid-cols-2
            lg:grid-cols-5
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
                AI Employees
              </p>

              <p
                className="
                text-3xl
                font-bold
                mt-2
                "
              >
                {agents.length}
              </p>
            </div>

            <div
              className="
              bg-black
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
                Working
              </p>

              <p
                className="
                text-3xl
                font-bold
                mt-2
                "
              >
                {workingAgents}
              </p>
            </div>

            <div
              className="
              bg-black
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
                Assigned
              </p>

              <p
                className="
                text-3xl
                font-bold
                mt-2
                "
              >
                {assignedAgents}
              </p>
            </div>

            <div
              className="
              bg-black
              border
              border-yellow-500/20
              rounded-2xl
              p-5
              "
            >
              <p
                className="
                text-yellow-400
                text-sm
                "
              >
                Waiting
              </p>

              <p
                className="
                text-3xl
                font-bold
                mt-2
                "
              >
                {waitingAgents}
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
                Idle
              </p>

              <p
                className="
                text-3xl
                font-bold
                mt-2
                "
              >
                {idleAgents}
              </p>
            </div>
          </div>
        </section>

        {/* AI CORE */}

        <Link
          href="/core"
          className="
          block
          mb-8
          "
        >
          <div
            className="
            bg-[#080808]
            border
            border-white/10
            rounded-3xl
            p-10
            text-center
            hover:border-white/40
            transition
            "
          >
            <div
              className="
              text-7xl
              "
            >
              🧠
            </div>

            <h2
              className="
              text-4xl
              font-bold
              mt-5
              "
            >
              AI CORE
            </h2>

            <p
              className="
              text-gray-500
              mt-3
              "
            >
              Central Brain Meeting Room
            </p>
          </div>
        </Link>

        {/* MISSION CONTROL */}

        <Link
          href="/missions"
          className="
          block
          mb-14
          "
        >
          <div
            className="
            bg-[#080808]
            border
            border-white/10
            rounded-3xl
            p-8
            hover:border-white/40
            transition
            "
          >
            <h2
              className="
              text-3xl
              font-bold
              "
            >
              📋 Mission Control
            </h2>

            <p
              className="
              text-gray-500
              mt-2
              "
            >
              Assign missions and manage AI employees
            </p>
          </div>
        </Link>

        {/* DEPARTMENTS */}

        <div
          className="
          flex
          items-end
          justify-between
          gap-5
          flex-wrap
          mb-8
          "
        >
          <div>
            <h2
              className="
              text-4xl
              font-bold
              "
            >
              AI Departments
            </h2>

            <p
              className="
              text-gray-500
              mt-2
              "
            >
              Live status of every AI specialist.
            </p>
          </div>
        </div>

        <div
          className="
          grid
          md:grid-cols-3
          gap-8
          "
        >
          {agents.map((agent) => {
            const status = getAgentOperationalStatus(agent.id, tasks);

            const currentTask = getCurrentAgentTask(agent.id, tasks);

            const statusClasses = getStatusClasses(status);

            return (
              <div
                key={agent.id}
                className="
                  bg-[#080808]
                  border
                  border-white/10
                  rounded-3xl
                  p-8
                  hover:border-white/30
                  transition
                  "
              >
                <div
                  className="
                    flex
                    items-start
                    justify-between
                    gap-4
                    "
                >
                  <div
                    className="
                      text-7xl
                      "
                  >
                    {agent.emoji}
                  </div>

                  <div
                    className={`
                      inline-flex
                      items-center
                      gap-2
                      px-3
                      py-2
                      rounded-full
                      border
                      text-xs
                      ${statusClasses.badge}
                      `}
                  >
                    <span
                      className={`
                        w-2
                        h-2
                        rounded-full
                        ${statusClasses.dot}
                        `}
                    />

                    {status}
                  </div>
                </div>

                <h3
                  className="
                    text-3xl
                    font-bold
                    mt-5
                    "
                >
                  {agent.name}
                </h3>

                <p
                  className="
                    text-blue-400
                    mt-2
                    "
                >
                  {agent.department}
                </p>

                <p
                  className="
                    text-gray-500
                    mt-2
                    "
                >
                  {agent.role}
                </p>

                <div
                  className="
                    mt-6
                    bg-black
                    border
                    border-white/10
                    rounded-2xl
                    p-4
                    "
                >
                  <p
                    className="
                      text-xs
                      uppercase
                      tracking-widest
                      text-gray-600
                      "
                  >
                    Current Assignment
                  </p>

                  <p
                    className="
                      mt-2
                      text-sm
                      leading-6
                      "
                  >
                    {currentTask ? currentTask.title : "No active assignment"}
                  </p>

                  {currentTask && (
                    <p
                      className="
                        text-gray-600
                        text-xs
                        mt-2
                        "
                    >
                      {currentTask.progress}% complete
                    </p>
                  )}
                </div>

                <Link
                  href={`/agents/${agent.id}`}
                  className="
                    inline-block
                    mt-6
                    px-5
                    py-3
                    bg-black
                    border
                    border-white/20
                    rounded-xl
                    text-sm
                    hover:bg-white
                    hover:text-black
                    transition
                    "
                >
                  🚪 Enter Room
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
