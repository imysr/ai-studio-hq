"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { agents } from "@/data/agents";

import { getAgentMemory } from "@/lib/agentMemory";
import { runAIScheduler } from "@/lib/aiScheduler";
import { getManagerMemory } from "@/lib/managerMemory";
import { getActivities } from "@/lib/activityMemory";

type AgentMemory = {
  id: number;

  currentTask: string;

  missionStatus: string;

  location: string;

  energy: number;

  lastAction: string;
};

type ManagerMemory = {
  missionTitle: string;

  analysis: string;

  decision: string;

  createdAt: string;
};

type ActivityMemory = {
  id: number;

  time: string;

  icon: string;

  message: string;
};

export default function CorePage() {
  const [memory, setMemory] = useState<AgentMemory[]>([]);

  const [manager, setManager] = useState<ManagerMemory | null>(null);

  const [activities, setActivities] = useState<ActivityMemory[]>([]);

  useEffect(() => {
    async function updateCore() {
      await runAIScheduler();

      const agentData = getAgentMemory();

      setMemory(agentData);

      const managerData = getManagerMemory();

      setManager(managerData);

      const activityData = getActivities();

      setActivities(activityData);
    }

    updateCore();

    const interval = setInterval(() => {
      updateCore();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

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
          <div className="text-7xl">🧠</div>

          <h1
            className="
text-5xl
font-bold
mt-5
"
          >
            AI CORE
          </h1>

          <p
            className="
text-blue-400
text-xl
mt-3
"
          >
            Central Intelligence Meeting Room
          </p>

          <div
            className="
mt-8
bg-green-500/10
border
border-green-500/20
rounded-xl
p-5
"
          >
            <p
              className="
text-green-400
font-bold
"
            >
              🟢 AI Scheduler Active
            </p>
          </div>
        </section>

        {/* VALID STRATEGY ROOM */}

        <section
          className="
mt-10
bg-[#080808]
border
border-white/10
rounded-3xl
p-8
"
        >
          <h2
            className="
text-3xl
font-bold
"
          >
            🧠 Valid Strategy Room
          </h2>

          {manager ? (
            <div
              className="
mt-6
space-y-5
"
            >
              <div>
                <p
                  className="
text-gray-500
"
                >
                  Mission
                </p>

                <p
                  className="
font-bold
text-xl
"
                >
                  {manager.missionTitle}
                </p>
              </div>

              <div>
                <p
                  className="
text-gray-500
"
                >
                  Analysis
                </p>

                <p>{manager.analysis}</p>
              </div>

              <div>
                <p
                  className="
text-gray-500
"
                >
                  Decision
                </p>

                <p>{manager.decision}</p>
              </div>
            </div>
          ) : (
            <p
              className="
text-gray-400
mt-5
"
            >
              No mission analysis yet.
            </p>
          )}
        </section>

        {/* ACTIVITY TIMELINE */}

        <section
          className="
mt-10
bg-[#080808]
border
border-white/10
rounded-3xl
p-8
"
        >
          <h2
            className="
text-3xl
font-bold
"
          >
            📅 AI Company Activity
          </h2>

          <div
            className="
mt-6
space-y-4
"
          >
            {activities.length > 0 ? (
              activities.map((activity) => (
                <div
                  key={activity.id}
                  className="
bg-black
border
border-white/10
rounded-xl
p-5
flex
gap-5
"
                >
                  <div
                    className="
text-3xl
"
                  >
                    {activity.icon}
                  </div>

                  <div>
                    <p
                      className="
text-blue-400
"
                    >
                      {activity.time}
                    </p>

                    <p>{activity.message}</p>
                  </div>
                </div>
              ))
            ) : (
              <p
                className="
text-gray-400
"
              >
                No activity recorded yet.
              </p>
            )}
          </div>
        </section>

        {/* AGENTS */}

        <section
          className="
mt-10
space-y-6
"
        >
          {agents.map((agent) => {
            const agentMemory = memory.find((item) => item.id === agent.id);

            return (
              <div
                key={agent.id}
                className="
bg-[#080808]
border
border-white/10
rounded-2xl
p-8
"
              >
                <div
                  className="
flex
items-center
gap-6
"
                >
                  <div
                    className="
text-6xl
"
                  >
                    {agent.emoji}
                  </div>

                  <div>
                    <h2
                      className="
text-3xl
font-bold
"
                    >
                      {agent.name}
                    </h2>

                    <p
                      className="
text-blue-400
"
                    >
                      {agent.role}
                    </p>
                  </div>
                </div>

                <div
                  className="
grid
md:grid-cols-2
gap-6
mt-8
"
                >
                  <Info
                    title="Status"
                    value={agentMemory?.missionStatus ?? "Idle"}
                  />

                  <Info
                    title="Current Task"
                    value={agentMemory?.currentTask ?? "Waiting for assignment"}
                  />

                  <Info
                    title="Location"
                    value={agentMemory?.location ?? "Office"}
                  />

                  <Info
                    title="Energy"
                    value={`${agentMemory?.energy ?? 100}%`}
                  />
                </div>

                <p
                  className="
text-gray-400
mt-6
"
                >
                  💬
                  {agentMemory?.lastAction ?? agent.description}
                </p>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function Info({
  title,

  value,
}: {
  title: string;

  value: string;
}) {
  return (
    <div>
      <p
        className="
text-gray-500
"
      >
        {title}
      </p>

      <p
        className="
font-bold
text-lg
"
      >
        {value}
      </p>
    </div>
  );
}
