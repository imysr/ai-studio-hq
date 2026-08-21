"use client";

import Link from "next/link";
import { useState } from "react";

import { agents } from "@/data/agents";
import type { MissionTask } from "@/data/tasks";

import { getTasks } from "@/lib/taskStorage";

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

export default function HQPage() {
  const [tasks] = useState<MissionTask[]>(getTasks());

  const workingAgents = agents.filter(
    (agent) => getAgentOperationalStatus(agent.id, tasks) === "Working",
  ).length;

  const waitingAgents = agents.filter(
    (agent) => getAgentOperationalStatus(agent.id, tasks) === "Waiting",
  ).length;

  const idleAgents = agents.filter(
    (agent) => getAgentOperationalStatus(agent.id, tasks) === "Idle",
  ).length;

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
                Current operational state based on real mission tasks.
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
              ● System Online
            </div>
          </div>

          <div
            className="
            grid
            md:grid-cols-4
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

        {/* EMPLOYEE ROOMS */}

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

                {/* CURRENT TASK */}

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
