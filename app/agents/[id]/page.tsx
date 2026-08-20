"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { agents } from "@/data/agents";
import type { MissionTask } from "@/data/tasks";

import {
  getAgentMemory,
  saveAgentMemory,
  type AgentMemory,
} from "@/lib/agentMemory";

import { getTasks, saveTasks } from "@/lib/taskStorage";

const rooms = {
  1: {
    title: "CEO OFFICE",
    items: ["🪑 Executive Desk", "💻 Command Terminal", "📋 Mission Board"],
  },

  2: {
    title: "DEVELOPMENT LAB",
    items: ["🖥️ Coding Station", "⚙️ Server Rack", "🔧 System Console"],
  },

  3: {
    title: "DESIGN STUDIO",
    items: ["🎨 Drawing Tablet", "🖼️ Design Wall", "💡 Creative Board"],
  },

  4: {
    title: "LEARNING ACADEMY",
    items: ["📚 Knowledge Library", "📝 Course Builder", "🎓 Training Console"],
  },

  5: {
    title: "STRATEGY ROOM",
    items: [
      "📈 Market Dashboard",
      "📊 Analytics Screen",
      "📚 Research Database",
    ],
  },

  6: {
    title: "GAME STUDIO",
    items: ["🎮 Development Console", "🕹️ Prototype Area", "💡 Idea Board"],
  },
};

export default function AgentRoom() {
  const params = useParams();

  const id = Number(params.id);

  const agent = agents.find((a) => a.id === id);

  const room = rooms[id as keyof typeof rooms];

  const [agentMemory, setAgentMemory] = useState<AgentMemory | null>(null);

  const [assignedTasks, setAssignedTasks] = useState<MissionTask[]>([]);

  const [taskTitle, setTaskTitle] = useState("");

  const [taskDescription, setTaskDescription] = useState("");

  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!id) return;

    const timer = window.setTimeout(() => {
      const memories = getAgentMemory();

      const memory = memories.find((item) => item.id === id);

      setAgentMemory(memory ?? null);

      const tasks = getTasks();

      const agentTasks = tasks.filter((task) => task.assignedAgent === id);

      setAssignedTasks(agentTasks);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [id]);

  function handleAssignTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanTitle = taskTitle.trim();

    const cleanDescription = taskDescription.trim();

    if (!cleanTitle) {
      return;
    }

    /*
      missionId 0 = Direct Assignment

      Direct assignments are created inside an agent room.

      They begin as Pending.

      AI Core will later pick them up and move them through:

      Pending
      ↓
      Working
      ↓
      Completed
    */

    const newTask: MissionTask = {
      id: Date.now(),

      missionId: 0,

      title: cleanTitle,

      description:
        cleanDescription || `Direct assignment for ${agent?.name ?? "agent"}.`,

      assignedAgent: id,

      status: "Pending",

      progress: 0,
    };

    /*
      SAVE TASK
    */

    const currentTasks = getTasks();

    const updatedTasks = [...currentTasks, newTask];

    saveTasks(updatedTasks);

    /*
      UPDATE AGENT MEMORY

      The task is only Pending here.

      The agent does NOT begin working until
      the AI Scheduler starts the task.
    */

    const memories = getAgentMemory();

    const updatedMemory = memories.map((memory) => {
      if (memory.id !== id) {
        return memory;
      }

      return {
        ...memory,

        currentTask: cleanTitle,

        missionStatus: "Pending",

        location: room?.title ?? "Office",

        energy: memory.energy,

        lastAction: `Received assignment: ${cleanTitle}`,
      };
    });

    saveAgentMemory(updatedMemory);

    /*
      REFRESH ROOM UI
    */

    const currentAgentMemory = updatedMemory.find((memory) => memory.id === id);

    setAgentMemory(currentAgentMemory ?? null);

    setAssignedTasks(updatedTasks.filter((task) => task.assignedAgent === id));

    setTaskTitle("");

    setTaskDescription("");

    setSuccessMessage(
      `Task queued for ${agent?.name ?? "agent"} successfully.`,
    );

    window.setTimeout(() => {
      setSuccessMessage("");
    }, 3000);
  }

  function handleCompleteTask(taskId: number) {
    const tasks = getTasks();

    const updatedTasks = tasks.map((task) => {
      if (task.id !== taskId) {
        return task;
      }

      return {
        ...task,

        status: "Completed" as const,

        progress: 100,
      };
    });

    saveTasks(updatedTasks);

    /*
      CHECK FOR ANOTHER ACTIVE TASK
    */

    const remainingTasks = updatedTasks.filter(
      (task) => task.assignedAgent === id && task.status !== "Completed",
    );

    const memories = getAgentMemory();

    const completedTask = updatedTasks.find((task) => task.id === taskId);

    const updatedMemory = memories.map((memory) => {
      if (memory.id !== id) {
        return memory;
      }

      const nextTask = remainingTasks[0];

      return {
        ...memory,

        currentTask: nextTask ? nextTask.title : "Waiting for assignment",

        missionStatus: nextTask ? nextTask.status : "Idle",

        location: nextTask ? (room?.title ?? "Office") : "Office",

        lastAction: completedTask
          ? `Completed task: ${completedTask.title}`
          : "Completed a task",
      };
    });

    saveAgentMemory(updatedMemory);

    const currentAgentMemory = updatedMemory.find((memory) => memory.id === id);

    setAgentMemory(currentAgentMemory ?? null);

    setAssignedTasks(updatedTasks.filter((task) => task.assignedAgent === id));
  }

  if (!agent) {
    return (
      <main className="min-h-screen bg-black text-white p-10">
        <h1 className="text-3xl font-bold">Agent not found</h1>

        <Link
          href="/hq"
          className="inline-block mt-6 text-gray-400 hover:text-white"
        >
          ← Back to HQ
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        {/* BACK BUTTON */}

        <Link href="/hq" className="text-gray-400 hover:text-white transition">
          ← Back to HQ
        </Link>

        {/* AGENT HEADER */}

        <section
          className="
          mt-10
          bg-[#080808]
          border
          border-white/10
          rounded-3xl
          p-10
          text-center
          "
        >
          <div className="text-8xl">{agent.emoji}</div>

          <h1
            className="
            text-4xl
            md:text-5xl
            font-bold
            mt-5
            "
          >
            {`${agent.name}'s Room`}
          </h1>

          <p className="text-blue-400 text-xl mt-3">{agent.role}</p>

          <p className="text-gray-500 mt-2">{agent.department}</p>
        </section>

        {/* ROOM */}

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
          <h2 className="text-3xl font-bold">🏢 {room?.title}</h2>

          <div
            className="
            grid
            md:grid-cols-3
            gap-5
            mt-6
            "
          >
            {room?.items.map((item, index) => (
              <div
                key={index}
                className="
                bg-black
                border
                border-white/10
                rounded-xl
                p-5
                text-center
                "
              >
                <p className="text-4xl">{item.substring(0, 2)}</p>

                <p className="text-gray-400 mt-3">{item.substring(3)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* AGENT STATUS */}

        <section
          className="
          mt-8
          grid
          md:grid-cols-2
          gap-6
          "
        >
          <InfoCard
            title="🟢 Status"
            value={agentMemory?.missionStatus ?? "Idle"}
          />

          <InfoCard
            title="📋 Current Task"
            value={agentMemory?.currentTask ?? "Waiting for assignment"}
          />

          <InfoCard
            title="📍 Location"
            value={agentMemory?.location ?? room?.title ?? "Office"}
          />

          <InfoCard
            title="⚡ Energy"
            value={`${agentMemory?.energy ?? 100}%`}
          />
        </section>

        {/* LAST ACTION */}

        <section
          className="
          mt-8
          bg-[#080808]
          border
          border-white/10
          rounded-2xl
          p-8
          "
        >
          <h2 className="text-2xl font-bold">📝 Last Action</h2>

          <p className="text-gray-400 mt-3">
            {agentMemory?.lastAction ?? "No recent activity"}
          </p>
        </section>

        {/* COMMAND TERMINAL */}

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
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-3xl font-bold">💻 Command Terminal</h2>

              <p className="text-gray-500 mt-2">
                Assign a direct task to {agent.name}.
              </p>
            </div>

            <div
              className="
              px-4
              py-2
              rounded-full
              border
              border-white/10
              text-sm
              text-gray-400
              "
            >
              Agent #{agent.id}
            </div>
          </div>

          <form onSubmit={handleAssignTask} className="mt-8">
            <label className="block text-sm text-gray-400 mb-2">
              Task Title
            </label>

            <input
              type="text"
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              placeholder={`What should ${agent.name} work on?`}
              className="
              w-full
              bg-black
              border
              border-white/10
              rounded-xl
              px-5
              py-4
              text-white
              outline-none
              focus:border-white/40
              transition
              "
            />

            <label className="block text-sm text-gray-400 mt-5 mb-2">
              Instructions
            </label>

            <textarea
              value={taskDescription}
              onChange={(event) => setTaskDescription(event.target.value)}
              placeholder="Describe the assignment..."
              rows={5}
              className="
              w-full
              bg-black
              border
              border-white/10
              rounded-xl
              px-5
              py-4
              text-white
              outline-none
              resize-none
              focus:border-white/40
              transition
              "
            />

            <button
              type="submit"
              className="
              mt-5
              px-6
              py-3
              bg-white
              text-black
              font-bold
              rounded-xl
              hover:bg-gray-200
              transition
              "
            >
              📡 Queue Task
            </button>

            {successMessage && (
              <p className="text-green-400 mt-4">✓ {successMessage}</p>
            )}
          </form>
        </section>

        {/* ASSIGNED TASKS */}

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
          <h2 className="text-3xl font-bold">📋 Assigned Tasks</h2>

          <p className="text-gray-500 mt-2">
            Mission tasks and direct assignments for {agent.name}.
          </p>

          <div className="mt-6 space-y-4">
            {assignedTasks.length === 0 ? (
              <div
                className="
                bg-black
                border
                border-white/10
                rounded-xl
                p-6
                "
              >
                <p className="text-gray-500">No tasks assigned.</p>
              </div>
            ) : (
              assignedTasks.map((task) => (
                <div
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
                    items-start
                    justify-between
                    gap-5
                    flex-wrap
                    "
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xl font-bold">{task.title}</h3>

                        {task.missionId === 0 && (
                          <span
                            className="
                            text-xs
                            border
                            border-blue-500/30
                            text-blue-400
                            rounded-full
                            px-3
                            py-1
                            "
                          >
                            Direct Assignment
                          </span>
                        )}
                      </div>

                      <p className="text-gray-500 mt-3">{task.description}</p>

                      <div className="mt-5">
                        <div
                          className="
                          flex
                          justify-between
                          text-sm
                          text-gray-500
                          mb-2
                          "
                        >
                          <span>{task.status}</span>

                          <span>{task.progress}%</span>
                        </div>

                        <div
                          className="
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
                            transition-all
                            "
                            style={{
                              width: `${task.progress}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {task.status !== "Completed" && (
                      <button
                        type="button"
                        onClick={() => handleCompleteTask(task.id)}
                        className="
                        px-4
                        py-2
                        border
                        border-white/20
                        rounded-xl
                        text-sm
                        hover:bg-white
                        hover:text-black
                        transition
                        "
                      >
                        ✓ Complete
                      </button>
                    )}

                    {task.status === "Completed" && (
                      <span className="text-green-400 text-sm">
                        ✓ Completed
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div
      className="
      bg-[#080808]
      border
      border-white/10
      rounded-2xl
      p-6
      "
    >
      <h3 className="text-gray-500">{title}</h3>

      <p className="text-xl font-bold mt-3">{value}</p>
    </div>
  );
}
