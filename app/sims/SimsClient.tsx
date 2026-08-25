"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { agents } from "@/data/agents";

type LiveAgentMemory = {
  id: number;
  currentTask: string;
  missionStatus: string;
  location: string;
  energy: number;
  lastAction: string;
};

type VirtualRoom =
  | "CEO Office"
  | "AI Core"
  | "Business Room"
  | "Development Lab"
  | "Main Hallway"
  | "Design Studio"
  | "Learning Academy"
  | "Lounge"
  | "Game Studio";

type DisplayLocationMap = Record<number, VirtualRoom>;

const homeRooms: Record<number, VirtualRoom> = {
  1: "CEO Office",
  2: "Development Lab",
  3: "Design Studio",
  4: "Learning Academy",
  5: "Business Room",
  6: "Game Studio",
};

function resolveVirtualLocation(memory: LiveAgentMemory): VirtualRoom {
  const location = memory.location?.trim() || "Office";

  if (location === "Office") {
    return homeRooms[memory.id] ?? "Main Hallway";
  }

  if (location === "AI Core Meeting Room") {
    return "AI Core";
  }

  if (location === "Strategy Room") {
    return "Business Room";
  }

  if (location === "CEO Office") {
    return "CEO Office";
  }

  if (location === "Development Lab") {
    return "Development Lab";
  }

  if (location === "Design Studio") {
    return "Design Studio";
  }

  if (location === "Learning Academy") {
    return "Learning Academy";
  }

  if (location === "Game Studio") {
    return "Game Studio";
  }

  if (location === "Hallway" || location === "Main Hallway") {
    return "Main Hallway";
  }

  if (location === "Lounge") {
    return "Lounge";
  }

  return homeRooms[memory.id] ?? "Main Hallway";
}

export default function SimsClient() {
  const [liveMemory, setLiveMemory] = useState<LiveAgentMemory[]>([]);

  /*
    displayLocations controls where
    characters are visually rendered.

    Supabase remains the real source
    of truth.
  */

  const [displayLocations, setDisplayLocations] = useState<DisplayLocationMap>(
    {},
  );

  /*
    travellingAgents lets the UI know
    which employees are currently
    walking through the hallway.
  */

  const [travellingAgents, setTravellingAgents] = useState<number[]>([]);

  /*
    Keeps track of the latest resolved
    real room for every agent.
  */

  const previousLocations = useRef<DisplayLocationMap>({});

  /*
    Prevent overlapping movement
    animations for the same employee.
  */

  const activeTransitions = useRef<Set<number>>(new Set());

  /*
    Timers are stored so they can be
    cleaned up if the page unmounts.
  */

  const transitionTimers = useRef<number[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadAgentMemory() {
      try {
        const response = await fetch("/api/agent-memory", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          console.error("Sims Agent Memory request failed:", response.status);

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

        /*
          Process each agent's real
          location against the previous
          known location.
        */

        memories.forEach((memory: LiveAgentMemory) => {
          const targetRoom = resolveVirtualLocation(memory);

          const previousRoom = previousLocations.current[memory.id];

          /*
              First load:
              place the employee directly
              into the real room.

              We don't animate initial
              page hydration.
            */

          if (!previousRoom) {
            previousLocations.current[memory.id] = targetRoom;

            setDisplayLocations((current) => ({
              ...current,

              [memory.id]: targetRoom,
            }));

            return;
          }

          /*
              Nothing changed.
            */

          if (previousRoom === targetRoom) {
            return;
          }

          /*
              Remember the newest real
              destination immediately.

              This prevents the same
              change from being detected
              every 3 seconds.
            */

          previousLocations.current[memory.id] = targetRoom;

          /*
              If an animation is already
              running, don't start another
              overlapping transition.
            */

          if (activeTransitions.current.has(memory.id)) {
            return;
          }

          activeTransitions.current.add(memory.id);

          /*
              STEP 1:
              move character into hallway.
            */

          setDisplayLocations((current) => ({
            ...current,

            [memory.id]: "Main Hallway",
          }));

          setTravellingAgents((current) =>
            current.includes(memory.id) ? current : [...current, memory.id],
          );

          /*
              STEP 2:
              after two seconds,
              enter destination room.
            */

          const timer = window.setTimeout(() => {
            setDisplayLocations((current) => ({
              ...current,

              [memory.id]: targetRoom,
            }));

            setTravellingAgents((current) =>
              current.filter((id) => id !== memory.id),
            );

            activeTransitions.current.delete(memory.id);
          }, 3500);

          transitionTimers.current.push(timer);
        });
      } catch (error) {
        console.error("Failed to load Sims agent memory:", error);
      }
    }

    void loadAgentMemory();

    const interval = window.setInterval(loadAgentMemory, 3000);

    return () => {
      cancelled = true;

      window.clearInterval(interval);

      transitionTimers.current.forEach((timer) => {
        window.clearTimeout(timer);
      });

      transitionTimers.current = [];
    };
  }, []);

  function getAgentsInRoom(room: VirtualRoom) {
    return liveMemory.filter((memory) => {
      const displayRoom = displayLocations[memory.id];

      return displayRoom === room;
    });
  }

  function isTravelling(agentId: number) {
    return travellingAgents.includes(agentId);
  }

  return (
    <main
      className="
        min-h-screen
        bg-black
        text-white
        p-6
      "
    >
      <div
        className="
          max-w-7xl
          mx-auto
        "
      >
        {/* HEADER */}

        <div
          className="
            flex
            items-center
            justify-between
            gap-6
            flex-wrap
            mb-8
          "
        >
          <div>
            <p
              className="
                text-xs
                uppercase
                tracking-[0.3em]
                text-gray-600
              "
            >
              AI Studio Simulation
            </p>

            <h1
              className="
                text-5xl
                font-bold
                mt-2
              "
            >
              🏢 Virtual HQ
            </h1>

            <p
              className="
                text-gray-500
                mt-2
              "
            >
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

        {/* FLOOR */}

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
            <Room
              room="CEO Office"
              subtitle="Executive Office"
              occupants={getAgentsInRoom("CEO Office")}
              isTravelling={isTravelling}
              className="
                col-span-4
                row-span-2
              "
            />

            <Room
              room="AI Core"
              subtitle="Central Meeting Room"
              occupants={getAgentsInRoom("AI Core")}
              isTravelling={isTravelling}
              className="
                col-span-4
                row-span-2
              "
            />

            <Room
              room="Business Room"
              subtitle="Strategy Department"
              occupants={getAgentsInRoom("Business Room")}
              isTravelling={isTravelling}
              className="
                col-span-4
                row-span-2
              "
            />

            <Room
              room="Development Lab"
              subtitle="Engineering Department"
              occupants={getAgentsInRoom("Development Lab")}
              isTravelling={isTravelling}
              className="
                col-span-3
                row-span-3
              "
            />

            <Room
              room="Main Hallway"
              subtitle="Agent Movement Zone"
              occupants={getAgentsInRoom("Main Hallway")}
              isTravelling={isTravelling}
              className="
                col-span-6
                row-span-3
                bg-[#090909]
              "
            />

            <Room
              room="Design Studio"
              subtitle="Creative Department"
              occupants={getAgentsInRoom("Design Studio")}
              isTravelling={isTravelling}
              className="
                col-span-3
                row-span-3
              "
            />

            <Room
              room="Learning Academy"
              subtitle="Education Department"
              occupants={getAgentsInRoom("Learning Academy")}
              isTravelling={isTravelling}
              className="
                col-span-4
                row-span-2
              "
            />

            <Room
              room="Lounge"
              subtitle="Idle / Waiting Area"
              occupants={getAgentsInRoom("Lounge")}
              isTravelling={isTravelling}
              className="
                col-span-4
                row-span-2
              "
            />

            <Room
              room="Game Studio"
              subtitle="Game Development"
              occupants={getAgentsInRoom("Game Studio")}
              isTravelling={isTravelling}
              className="
                col-span-4
                row-span-2
              "
            />
          </div>
        </section>

        {/* LIVE LEGEND */}

        <div
          className="
            mt-5
            flex
            gap-4
            flex-wrap
            text-xs
            text-gray-600
          "
        >
          <span>● {liveMemory.length} AI employees online</span>

          <span>● Live update every 3 seconds</span>

          <span>● Position based on Agent Memory</span>

          <span>● {travellingAgents.length} travelling</span>
        </div>
      </div>
    </main>
  );
}

type RoomProps = {
  room: VirtualRoom;

  subtitle: string;

  occupants: LiveAgentMemory[];

  isTravelling: (agentId: number) => boolean;

  className?: string;
};

function Room({
  room,
  subtitle,
  occupants,
  isTravelling,
  className = "",
}: RoomProps) {
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

      <div
        className="
          flex
          items-center
          justify-between
          gap-3
          relative
          z-20
        "
      >
        <h2
          className="
            text-xl
            font-bold
            mt-1
          "
        >
          {room}
        </h2>

        {occupants.length > 0 && (
          <span
            className="
              text-[10px]
              text-gray-500
              border
              border-white/10
              rounded-full
              px-2
              py-1
            "
          >
            {occupants.length} inside
          </span>
        )}
      </div>

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

      {/* EMPTY ROOM */}

      {occupants.length === 0 && (
        <div
          className="
            absolute
            inset-0
            flex
            items-center
            justify-center
            pointer-events-none
          "
        >
          <p
            className="
              text-xs
              text-gray-800
            "
          >
            Empty
          </p>
        </div>
      )}

      {/* AGENTS */}

      {occupants.length > 0 && (
        <div
          className={`
            absolute
            inset-x-4
            top-16
            bottom-4
            z-10
            grid
            items-center
            justify-items-center
            gap-2

            ${
              occupants.length === 1
                ? "grid-cols-1"
                : occupants.length === 2
                  ? "grid-cols-2"
                  : occupants.length <= 4
                    ? "grid-cols-2"
                    : "grid-cols-3"
            }
          `}
        >
          {occupants.map((memory) => {
            const agent = agents.find((item) => item.id === memory.id);

            if (!agent) {
              return null;
            }

            return (
              <AgentSim
                key={memory.id}
                memory={memory}
                name={agent.name}
                emoji={agent.emoji}
                role={agent.role}
                compact={occupants.length > 1}
                travelling={isTravelling(memory.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

type AgentSimProps = {
  memory: LiveAgentMemory;

  name: string;

  emoji: string;

  role: string;

  compact?: boolean;

  travelling?: boolean;
};

function AgentSim({
  memory,
  name,
  emoji,
  role,
  compact = false,
  travelling = false,
}: AgentSimProps) {
  const working =
    memory.missionStatus === "Working" || memory.missionStatus === "Generating";

  const waiting = memory.missionStatus === "Waiting";

  return (
    <div
      className="
        w-full
        max-w-[130px]
        text-center
        relative
      "
    >
      {/* STATUS DOT */}

      <div
        className={`
          absolute
          top-0
          right-4
          w-2.5
          h-2.5
          rounded-full

          ${
            travelling
              ? "bg-blue-400"
              : working
                ? "bg-green-400"
                : waiting
                  ? "bg-yellow-400"
                  : "bg-gray-500"
          }
        `}
      />

      {/* CHARACTER */}

      <div
        className={`
          transition-all
          duration-700

          ${compact ? "text-3xl" : "text-5xl"}

          ${travelling ? "animate-pulse translate-x-2" : ""}

          ${working && !compact && !travelling ? "scale-110" : ""}
        `}
      >
        {emoji}
      </div>

      <p
        className={`
          font-bold
          mt-2

          ${compact ? "text-sm" : "text-base"}
        `}
      >
        {name}
      </p>

      <p
        className="
          text-[9px]
          text-blue-400
          mt-1
        "
      >
        {role}
      </p>

      {/* STATUS */}

      <div
        className="
          inline-flex
          mt-2
          px-2
          py-1
          rounded-full
          border
          border-white/10
          bg-black/80
          text-[8px]
          text-gray-400
        "
      >
        {travelling ? "Walking..." : memory.missionStatus}
      </div>

      {/* TASK */}

      {!compact && !travelling && (
        <p
          className="
            text-[9px]
            text-gray-600
            mt-2
            line-clamp-2
          "
        >
          {memory.currentTask}
        </p>
      )}

      {/* ENERGY */}

      {!travelling && (
        <div className="mt-3">
          <div
            className="
              flex
              justify-between
              text-[8px]
              text-gray-700
              mb-1
            "
          >
            <span>Energy</span>

            <span>{memory.energy}%</span>
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
                width: `${Math.max(0, Math.min(100, memory.energy))}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
