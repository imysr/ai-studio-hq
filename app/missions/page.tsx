"use client";

import Link from "next/link";
import { useState } from "react";

import { agents } from "@/data/agents";
import { defaultMissions, Mission } from "@/data/missions";
import { MissionTask } from "@/data/tasks";

import { saveMissions } from "@/lib/missionStorage";
import { saveTasks, getTasks } from "@/lib/taskStorage";

import { startAgentTask, completeAgentTask } from "@/lib/workEngine";

import { calculateMissionProgress } from "@/lib/taskEngine";

import { generateMissionTasks } from "@/lib/taskGenerator";

import { saveMissionMemory } from "@/lib/missionMemory";
import { saveAgentMemory } from "@/lib/agentMemory";
import { analyseMission, createManagerReport } from "@/lib/aiManager";
import { saveManagerMemory } from "@/lib/managerMemory";

type AgentMemory = {
  id: number;

  currentTask: string;

  missionStatus: string;

  location: string;

  energy: number;

  lastAction: string;
};

export default function Missions() {
  const [missions, setMissions] = useState<Mission[]>(defaultMissions);

  const [tasks, setTasks] = useState<MissionTask[]>(getTasks());

  const [title, setTitle] = useState("");

  const [description, setDescription] = useState("");

  const [selectedAgents, setSelectedAgents] = useState<number[]>([]);

  const [, refresh] = useState(0);

  function toggleAgent(id: number) {
    setSelectedAgents((current) => {
      if (current.includes(id)) {
        return current.filter((agentId) => agentId !== id);
      }

      return [...current, id];
    });
  }

  function handleStartTask(taskId: number) {
    startAgentTask(taskId);

    const updatedTasks = getTasks();

    setTasks([...updatedTasks]);

    refresh((value) => value + 1);
  }
  function handleCompleteTask(taskId: number) {
    completeAgentTask(taskId);

    const updatedTasks = getTasks();

    setTasks([...updatedTasks]);

    refresh((value) => value + 1);
  }

  function launchMission() {
    if (title.trim() === "") {
      alert("Enter mission title");

      return;
    }

    const missionId = Date.now();

    const newMission: Mission = {
      id: missionId,

      title: title,

      description: description,

      status: "Active",

      progress: 0,

      assignedAgents: selectedAgents,
    };

    const updatedMissions = [...missions, newMission];

    setMissions(updatedMissions);

    saveMissions(updatedMissions);

    const newTasks = generateMissionTasks(
      missionId,

      selectedAgents,
    );

    const updatedTasks = [...tasks, ...newTasks];

    setTasks(updatedTasks);

    saveTasks(updatedTasks);

    saveMissionMemory({
      title: title,

      description: description,
    });

    const analysis = analyseMission(newMission);

    const report = createManagerReport(newMission, newTasks);

    saveManagerMemory({
      missionTitle: newMission.title,

      analysis: analysis.analysis,

      decision: analysis.decision,

      createdAt: new Date().toISOString(),
    });

    console.log("AI Manager Report:", analysis);

    console.log("Mission Report:", report);
    const memories: AgentMemory[] = agents.map((agent) => {
      if (selectedAgents.includes(agent.id)) {
        return {
          id: agent.id,

          currentTask: `Working on ${title}`,

          missionStatus: "Working",

          location: "AI Core Meeting Room",

          energy: 100,

          lastAction: "Received new mission from CEO",
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

    setTitle("");

    setDescription("");

    setSelectedAgents([]);
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
          <h2
            className="
text-3xl
font-bold
"
          >
            Create Mission
          </h2>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Mission title"
            className="
w-full
mt-6
bg-black
border
border-white/20
rounded-xl
p-4
"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mission description"
            className="
w-full
mt-4
bg-black
border
border-white/20
rounded-xl
p-4
h-32
"
          />

          <h3
            className="
mt-8
text-xl
font-bold
"
          >
            Assign AI Team
          </h3>

          <div
            className="
grid
md:grid-cols-3
gap-5
mt-5
"
          >
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                className={`

p-6

rounded-2xl

border

text-left


${
  selectedAgents.includes(agent.id)
    ? "border-white bg-white/10"
    : "border-white/10 bg-black"
}

`}
              >
                <div
                  className="
text-5xl
"
                >
                  {agent.emoji}
                </div>

                <h4
                  className="
text-xl
font-bold
mt-3
"
                >
                  {agent.name}
                </h4>

                <p
                  className="
text-blue-400
"
                >
                  {agent.role}
                </p>

                {selectedAgents.includes(agent.id) && (
                  <p
                    className="
text-green-400
mt-3
"
                  >
                    ✓ Assigned
                  </p>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={launchMission}
            className="
mt-10
bg-white
text-black
px-10
py-4
rounded-xl
font-bold
"
          >
            🚀 Launch Mission
          </button>
        </section>

        <section
          className="
mt-10
"
        >
          <h2
            className="
text-3xl
font-bold
"
          >
            Active Missions
          </h2>
          {missions.map((mission) => (
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

              <p
                className="
text-green-400
mt-5
"
              >
                Status:
                {mission.status}
              </p>

              <p
                className="
mt-5
"
              >
                Progress
              </p>

              <div
                className="
w-full
h-4
bg-black
border
border-white/10
rounded-full
mt-2
"
              >
                <div
                  className="
h-4
bg-white
rounded-full
"
                  style={{
                    width: `${calculateMissionProgress(mission.id)}%`,
                  }}
                />
              </div>

              <p
                className="
mt-2
"
              >
                {calculateMissionProgress(mission.id)}%
              </p>

              <h4
                className="
text-xl
font-bold
mt-8
"
              >
                Tasks
              </h4>

              <div
                className="
mt-4
space-y-4
"
              >
                {tasks

                  .filter((task) => task.missionId === mission.id)

                  .map((task) => (
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
text-gray-400
mt-2
"
                      >
                        {task.description}
                      </p>

                      <p
                        className="
mt-2
text-sm
"
                      >
                        Status:
                        {task.status}
                      </p>

                      <div
                        className="
flex
gap-3
mt-4
"
                      >
                        <button
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

                        <button
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
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
