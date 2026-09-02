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

/*
  AUTOMATIC BREAK SETTINGS

  Every 20 seconds the Sims layer may
  send one eligible idle employee on break.

  Automatic breaks last 15 seconds.

  Maximum two employees may be in Lounge
  at once.
*/

const AUTO_BREAK_CHECK_MS = 20_000;
const AUTO_BREAK_DURATION_MS = 15_000;
const MAX_LOUNGE_OCCUPANTS = 2;

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

  const liveMemoryRef = useRef<LiveAgentMemory[]>([]);

  const [displayLocations, setDisplayLocations] = useState<DisplayLocationMap>(
    {},
  );

  const [travellingAgents, setTravellingAgents] = useState<number[]>([]);

  const [autoBreaksEnabled, setAutoBreaksEnabled] = useState(true);

  const previousLocations = useRef<DisplayLocationMap>({});

  const activeTransitions = useRef<Set<number>>(new Set());

  const transitionTimers = useRef<number[]>([]);

  const breakTimers = useRef<number[]>([]);

  /*
    Keep the state and ref synchronized.

    The ref lets delayed break timers
    inspect the newest memory instead of
    stale React state.
  */

  function applyLiveMemory(memories: LiveAgentMemory[]) {
    liveMemoryRef.current = memories;

    setLiveMemory(memories);
  }

  /*
    WRITE AGENT MEMORY TO SUPABASE
  */

  async function persistAgentMemory(
    memories: LiveAgentMemory[],
  ): Promise<boolean> {
    try {
      const response = await fetch("/api/agent-memory", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(memories),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);

        console.error("Virtual HQ Agent Memory save failed:", data);

        return false;
      }

      applyLiveMemory(memories);

      return true;
    } catch (error) {
      console.error("Virtual HQ Agent Memory save error:", error);

      return false;
    }
  }

  /*
    LIVE SUPABASE POLLING
  */

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

        applyLiveMemory(memories);

        /*
          LOCATION TRANSITIONS

          First load:
          direct placement.

          Later changes:
          room -> hallway -> destination.
        */

        memories.forEach((memory: LiveAgentMemory) => {
          const targetRoom = resolveVirtualLocation(memory);

          const previousRoom = previousLocations.current[memory.id];

          if (!previousRoom) {
            previousLocations.current[memory.id] = targetRoom;

            setDisplayLocations((current) => ({
              ...current,

              [memory.id]: targetRoom,
            }));

            return;
          }

          if (previousRoom === targetRoom) {
            return;
          }

          previousLocations.current[memory.id] = targetRoom;

          if (activeTransitions.current.has(memory.id)) {
            return;
          }

          activeTransitions.current.add(memory.id);

          /*
              ENTER HALLWAY
            */

          setDisplayLocations((current) => ({
            ...current,

            [memory.id]: "Main Hallway",
          }));

          setTravellingAgents((current) =>
            current.includes(memory.id) ? current : [...current, memory.id],
          );

          /*
              ENTER DESTINATION
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

      breakTimers.current.forEach((timer) => {
        window.clearTimeout(timer);
      });

      transitionTimers.current = [];
      breakTimers.current = [];
    };
  }, []);

  /*
    CHECK WHETHER AN AGENT MAY TAKE A BREAK
  */

  function canTakeBreak(memory: LiveAgentMemory) {
    return (
      memory.missionStatus === "Idle" &&
      memory.currentTask === "Waiting for assignment" &&
      resolveVirtualLocation(memory) !== "Lounge" &&
      !activeTransitions.current.has(memory.id)
    );
  }

  /*
    SEND A SPECIFIC IDLE AGENT TO LOUNGE
  */

  async function moveAgentToLoungeById(
    agentId: number,
    scheduleAutomaticReturn = false,
  ) {
    const current = liveMemoryRef.current;

    const agentMemory = current.find((memory) => memory.id === agentId);

    if (!agentMemory || !canTakeBreak(agentMemory)) {
      return false;
    }

    const updated = current.map((memory): LiveAgentMemory => {
      if (memory.id !== agentId) {
        return memory;
      }

      return {
        ...memory,

        location: "Lounge",

        lastAction: "Taking a short break in the Lounge",
      };
    });

    const saved = await persistAgentMemory(updated);

    if (!saved) {
      return false;
    }

    if (scheduleAutomaticReturn) {
      const timer = window.setTimeout(() => {
        void moveAgentHomeById(agentId);
      }, AUTO_BREAK_DURATION_MS);

      breakTimers.current.push(timer);
    }

    return true;
  }

  /*
    RETURN SPECIFIC AGENT HOME

    Important:
    only an idle employee who is STILL
    in Lounge may be returned.

    If Mission Control has assigned work,
    the mission location wins and this
    timer does nothing.
  */

  async function moveAgentHomeById(agentId: number) {
    const current = liveMemoryRef.current;

    const agentMemory = current.find((memory) => memory.id === agentId);

    if (
      !agentMemory ||
      agentMemory.location !== "Lounge" ||
      agentMemory.missionStatus !== "Idle" ||
      agentMemory.currentTask !== "Waiting for assignment"
    ) {
      return false;
    }

    const updated = current.map((memory): LiveAgentMemory => {
      if (memory.id !== agentId) {
        return memory;
      }

      return {
        ...memory,

        location: "Office",

        lastAction: "Returned from Lounge break",
      };
    });

    return persistAgentMemory(updated);
  }

  /*
    MANUAL TEST BUTTON:
    SEND FIRST ELIGIBLE AGENT.
  */

  async function moveAgentToLounge() {
    const idleAgent = liveMemoryRef.current.find(canTakeBreak);

    if (!idleAgent) {
      console.log("No idle agent available for Lounge.");

      return;
    }

    await moveAgentToLoungeById(idleAgent.id, false);
  }

  /*
    MANUAL TEST BUTTON:
    RETURN FIRST LOUNGE AGENT.
  */

  async function moveAgentHome() {
    const loungeAgent = liveMemoryRef.current.find(
      (memory) => memory.location === "Lounge",
    );

    if (!loungeAgent) {
      console.log("No agent currently in Lounge.");

      return;
    }

    await moveAgentHomeById(loungeAgent.id);
  }

  /*
    AUTOMATIC IDLE BREAK LOOP

    Mission state always wins.

    Only Idle + Waiting employees
    may be moved automatically.
  */

  useEffect(() => {
    if (!autoBreaksEnabled) {
      return;
    }

    const interval = window.setInterval(() => {
      const current = liveMemoryRef.current;

      const loungeCount = current.filter(
        (memory) => memory.location === "Lounge",
      ).length;

      if (loungeCount >= MAX_LOUNGE_OCCUPANTS) {
        return;
      }

      const eligibleAgents = current.filter(canTakeBreak);

      if (eligibleAgents.length === 0) {
        return;
      }

      const randomIndex = Math.floor(Math.random() * eligibleAgents.length);

      const selectedAgent = eligibleAgents[randomIndex];

      void moveAgentToLoungeById(selectedAgent.id, true);
    }, AUTO_BREAK_CHECK_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [autoBreaksEnabled]);

  /*
    ROOM HELPERS
  */

  function getAgentsInRoom(room: VirtualRoom) {
    return liveMemory.filter((memory) => displayLocations[memory.id] === room);
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

        {/* SIMULATION CONTROLS */}

        <div
          className="
            mb-6
            p-4
            rounded-2xl
            border
            border-white/10
            bg-white/[0.02]
          "
        >
          <div
            className="
              flex
              items-center
              justify-between
              gap-4
              flex-wrap
            "
          >
            <div>
              <p
                className="
                  text-sm
                  font-semibold
                  text-gray-300
                "
              >
                ☕ Idle Behaviour
              </p>

              <p
                className="
                  text-xs
                  text-gray-600
                  mt-1
                "
              >
                Idle employees may automatically visit the Lounge and return.
              </p>
            </div>

            <div
              className="
                flex
                gap-2
                flex-wrap
              "
            >
              <button
                type="button"
                onClick={() => {
                  setAutoBreaksEnabled((current) => !current);
                }}
                className="
                  px-4
                  py-2
                  rounded-xl
                  border
                  border-white/10
                  bg-white/5
                  text-xs
                  text-gray-300
                  hover:bg-white/10
                  transition
                "
              >
                {autoBreaksEnabled ? "🟢 Auto Breaks ON" : "⚫ Auto Breaks OFF"}
              </button>

              <button
                type="button"
                onClick={() => {
                  void moveAgentToLounge();
                }}
                className="
                  px-4
                  py-2
                  rounded-xl
                  border
                  border-white/10
                  bg-white/5
                  text-xs
                  text-gray-300
                  hover:bg-white/10
                  transition
                "
              >
                ☕ Send Idle Agent
              </button>

              <button
                type="button"
                onClick={() => {
                  void moveAgentHome();
                }}
                className="
                  px-4
                  py-2
                  rounded-xl
                  border
                  border-white/10
                  bg-white/5
                  text-xs
                  text-gray-300
                  hover:bg-white/10
                  transition
                "
              >
                🏢 Return Agent
              </button>
            </div>
          </div>
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

        {/* LIVE STATUS */}

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

          <span>
            ● Auto breaks {autoBreaksEnabled ? "enabled" : "disabled"}
          </span>
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
    memory.missionStatus === "Working" ||
    memory.missionStatus === "Generating" ||
    memory.missionStatus === "Generating AI Result";

  const waiting =
    memory.missionStatus === "Waiting" || memory.missionStatus === "Pending";

  const error = memory.missionStatus === "AI Generation Error";

  return (
    <div
      className="
        w-full
        max-w-[130px]
        text-center
        relative
      "
    >
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
                  : error
                    ? "bg-red-400"
                    : "bg-gray-500"
          }
        `}
      />

      <div
        className={`
          transition-all
          duration-700

          ${compact ? "text-3xl" : "text-5xl"}

          ${travelling ? "hq-walking" : ""}

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
