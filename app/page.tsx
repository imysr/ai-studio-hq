import Link from "next/link";

export default function Home() {
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
        text-center
      "
      >
        <p
          className="
          text-sm
          uppercase
          tracking-[0.35em]
          text-blue-400
        "
        >
          Millennial Professional Academy
        </p>

        <h1
          className="
          text-6xl
          font-bold
          tracking-widest
          mt-5
        "
        >
          🤖 MPA AI AGENT
        </h1>

        <p
          className="
          mt-4
          text-gray-500
          text-lg
        "
        >
          AI Operations & Automation for MPA
        </p>

        <div
          className="
          mt-16
          flex
          justify-center
        "
        >
          <div
            className="
            w-72
            h-72
            rounded-full
            bg-[#050505]
            border
            border-white/20
            flex
            flex-col
            items-center
            justify-center
          "
          >
            <div className="text-7xl">🧠</div>

            <h2
              className="
              text-2xl
              font-bold
              mt-5
            "
            >
              MPA AI CORE
            </h2>

            <p className="text-gray-500">Operations Intelligence</p>
          </div>
        </div>

        <p
          className="
          max-w-2xl
          mx-auto
          mt-10
          text-gray-500
          leading-7
        "
        >
          Coordinate MPA marketing, course development, content creation,
          business strategy, technology and daily operations with a specialised
          AI workforce.
        </p>

        <Link
          href="/hq"
          className="
            inline-block
            mt-12
            bg-white
            text-black
            px-10
            py-4
            rounded-xl
            font-bold
          "
        >
          🚪 Enter MPA AI Operations
        </Link>
      </div>
    </main>
  );
}
