"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { agents } from "@/data/agents";
import { getAgentMemory } from "@/lib/agentMemory";

type AgentMemory = {
  id: number;

  currentTask: string;

  missionStatus: string;

  location: string;

  energy: number;

  lastAction: string;
};

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

  const [agentMemory, setAgentMemory] = useState<AgentMemory | null>(null);

  useEffect(() => {
    if (!id) return;

    const loadMemory = () => {
      const memories = getAgentMemory();

      const memory = memories.find((a) => a.id === id);

      setAgentMemory(memory ?? null);
    };

    loadMemory();
  }, [id]);

  const room = rooms[id as keyof typeof rooms];

  if (!agent) {
    return (
      <main
        className="
min-h-screen
bg-black
text-white
p-10
"
      >
        <h1>Agent not found</h1>
      </main>
    );
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
max-w-5xl
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
          <div
            className="
text-8xl
"
          >
            {agent.emoji}
          </div>

          <h1
            className="
text-5xl
font-bold
mt-5
"
          >
            {`${agent.name}'s Room`}
          </h1>

          <p
            className="
text-blue-400
text-xl
mt-3
"
          >
            {agent.role}
          </p>

          <p
            className="
text-gray-500
mt-2
"
          >
            {agent.department}
          </p>
        </section>

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
text-3xl
font-bold
"
          >
            🏢 {room?.title}
          </h2>

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
                <p
                  className="
text-4xl
"
                >
                  {item.substring(0, 2)}
                </p>

                <p
                  className="
text-gray-400
mt-3
"
                >
                  {item.substring(3)}
                </p>
              </div>
            ))}
          </div>
        </section>

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
          <h2
            className="
text-2xl
font-bold
"
          >
            📝 Last Action
          </h2>

          <p
            className="
text-gray-400
mt-3
"
          >
            {agentMemory?.lastAction ?? "No recent activity"}
          </p>
        </section>
      </div>
    </main>
  );
}

function InfoCard({
  title,

  value,
}: {
  title: string;

  value: string;
}) {
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
      <h3
        className="
text-gray-500
"
      >
        {title}
      </h3>

      <p
        className="
text-xl
font-bold
mt-3
"
      >
        {value}
      </p>
    </div>
  );
}
