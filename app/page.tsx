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
        <h1
          className="
          text-6xl
          font-bold
          tracking-widest
        "
        >
          🖤 AI STUDIO HQ
        </h1>

        <p
          className="
          mt-4
          text-gray-500
        "
        >
          Underground Artificial Intelligence Facility
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
              AI CORE
            </h2>

            <p className="text-gray-500">Central Brain</p>
          </div>
        </div>

        <Link
          href="/hq"
          className="
            inline-block
            mt-16
            bg-white
            text-black
            px-10
            py-4
            rounded-xl
            font-bold
          "
        >
          🚪 Enter Headquarters
        </Link>
      </div>
    </main>
  );
}
