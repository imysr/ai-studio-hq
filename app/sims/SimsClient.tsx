"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { agents } from "@/data/agents";

type LiveAgentMemory = {
  id: number;
  currentTask: string;
  missionStatus: string;
  location: string;
  energy: number;
  lastAction: string;
};

export default function SimsClient() {
  const [liveMemory, setLiveMemory] = useState<LiveAgentMemory[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadAgentMemory() {
      try {
        const response = await fetch("/api/agent-memory", {
          method: "GET",
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (cancelled || !Array.isArray(data.agents)) {
          return;
        }

        const memories = data.agents.map(
          (memory: {
            agent_id: number;
            current_task: string;
            mission_status: string;
            location: string;
            energy: number;
            last_action: string;
          }): LiveAgentMemory => ({
            id: memory.agent_id,

            currentTask: memory.current_task,

            missionStatus: memory.mission_status,

            location: memory.location,

            energy: memory.energy,

            lastAction: memory.last_action,
          }),
        );

        setLiveMemory(memories);
      } catch (error) {
        console.error("Failed to load Sims agent memory:", error);
      }
    }

    void loadAgentMemory();

    const interval = window.setInterval(loadAgentMemory, 3000);

    return () => {
      cancelled = true;

      window.clearInterval(interval);
    };
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-6 flex-wrap mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-600">
              AI Studio Simulation
            </p>

            <h1 className="text-5xl font-bold mt-2">🏢 Virtual HQ</h1>

            <p className="text-gray-500 mt-2">
              Live floor simulation of AI Studio HQ.
            </p>
          </div>

          <Link
            href="/hq"
            className="
              border
              border-white/15
              rounded-xl
              px-5
              py-3
              text-sm
              text-gray-300
              hover:bg-white
              hover:text-black
              transition
            "
          >
            ← Back to HQ
          </Link>
        </div>

        <section
          className="
            bg-[#050505]
            border
            border-white/10
            rounded-3xl
            p-4
          "
        >
          <div
            className="
              grid
              grid-cols-12
              gap-3
              min-h-[780px]
            "
          >
            {/* TOP ROW */}

            <Room
              title="CEO Office"
              subtitle="Valid"
              agentId={1}
              liveMemory={liveMemory}
              className="col-span-4 row-span-2"
            />

            <Room
              title="AI Core"
              subtitle="Central Meeting Room"
              liveMemory={liveMemory}
              className="col-span-4 row-span-2"
            />

            <Room
              title="Business Room"
              subtitle="Atlas"
              agentId={5}
              liveMemory={liveMemory}
              className="col-span-4 row-span-2"
            />

            {/* MIDDLE ROW */}

            <Room
              title="Development Lab"
              subtitle="CodeBot"
              agentId={2}
              liveMemory={liveMemory}
              className="col-span-3 row-span-3"
            />

            <Room
              title="Main Hallway"
              subtitle="Agent Movement Zone"
              liveMemory={liveMemory}
              className="
                col-span-6
                row-span-3
                bg-[#090909]
              "
            />

            <Room
              title="Design Studio"
              subtitle="Pixel"
              agentId={3}
              liveMemory={liveMemory}
              className="col-span-3 row-span-3"
            />

            {/* BOTTOM ROW */}

            <Room
              title="Learning Academy"
              subtitle="Sage"
              agentId={4}
              liveMemory={liveMemory}
              className="col-span-4 row-span-2"
            />

            <Room
              title="Lounge"
              subtitle="Idle / Waiting Area"
              liveMemory={liveMemory}
              className="col-span-4 row-span-2"
            />

            <Room
              title="Game Studio"
              subtitle="Forge"
              agentId={6}
              liveMemory={liveMemory}
              className="col-span-4 row-span-2"
            />
          </div>
        </section>
      </div>
    </main>
  );
}

type RoomProps = {
  title: string;
  subtitle: string;
  agentId?: number;
  liveMemory: LiveAgentMemory[];
  className?: string;
};

function Room({
  title,
  subtitle,
  agentId,
  liveMemory,
  className = "",
}: RoomProps) {
  const agent =
    agentId !== undefined
      ? agents.find((item) => item.id === agentId)
      : undefined;

  const sim =
    agentId !== undefined
      ? liveMemory.find((item) => item.id === agentId)
      : undefined;

  return (
    <div
      className={`
        border
        border-white/10
        rounded-2xl
        bg-[#0b0b0b]
        p-4
        relative
        overflow-hidden
        ${className}
      `}
    >
      <p
        className="
          text-xs
          uppercase
          tracking-[0.2em]
          text-gray-600
        "
      >
        {subtitle}
      </p>

      <h2
        className="
          text-xl
          font-bold
          mt-1
          relative
          z-20
        "
      >
        {title}
      </h2>

      {/* ROOM FLOOR */}

      <div
        className="
          absolute
          inset-4
          top-16
          border
          border-dashed
          border-white/5
          rounded-xl
        "
      />

      {/* AGENT */}

      {agent && sim && (
        <div
          className="
            absolute
            inset-0
            flex
            items-center
            justify-center
            pointer-events-none
            z-10
          "
        >
          <div className="text-center">
            <div className="text-5xl">{agent.emoji}</div>

            <p
              className="
                font-bold
                text-lg
                mt-2
              "
            >
              {agent.name}
            </p>

            <p
              className="
                text-xs
                text-blue-400
                mt-1
              "
            >
              {agent.role}
            </p>

            <div
              className="
                inline-flex
                mt-3
                px-3
                py-1
                rounded-full
                border
                border-white/10
                bg-black/70
                text-[10px]
                text-gray-400
              "
            >
              {sim.missionStatus}
            </div>

            <p
              className="
                text-[10px]
                text-gray-600
                mt-3
                max-w-[180px]
              "
            >
              {sim.currentTask}
            </p>

            <p
              className="
                text-[9px]
                text-gray-700
                mt-2
                max-w-[190px]
              "
            >
              {sim.lastAction}
            </p>
          </div>
        </div>
      )}

      {/* ENERGY */}

      {sim && (
        <div
          className="
            absolute
            left-5
            right-5
            bottom-4
            z-20
          "
        >
          <div
            className="
              flex
              justify-between
              text-[10px]
              text-gray-600
              mb-1
            "
          >
            <span>{sim.location}</span>

            <span>Energy {sim.energy}%</span>
          </div>

          <div
            className="
              h-1
              bg-white/5
              rounded-full
              overflow-hidden
            "
          >
            <div
              className="
                h-full
                bg-white/40
                rounded-full
              "
              style={{
                width: `${Math.max(0, Math.min(100, sim.energy))}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
