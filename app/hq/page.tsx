"use client";

import Link from "next/link";
import { agents } from "@/data/agents";

export default function HQPage() {
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

        <h2
          className="
          text-4xl
          font-bold
          mb-8
          "
        >
          AI Departments
        </h2>

        <div
          className="
          grid
          md:grid-cols-3
          gap-8
          "
        >
          {agents.map((agent) => (
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
                text-7xl
                "
              >
                {agent.emoji}
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
          ))}
        </div>
      </div>
    </main>
  );
}
