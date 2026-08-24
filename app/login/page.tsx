"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    setErrorMessage("");
    setIsLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage("Invalid email or password.");
        return;
      }

      router.replace("/hq");
      router.refresh();
    } catch (error) {
      console.error("Login error:", error);

      setErrorMessage("Unable to sign in right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main
      className="
        min-h-screen
        bg-black
        text-white
        flex
        items-center
        justify-center
        p-6
      "
    >
      <div
        className="
          w-full
          max-w-md
          bg-[#080808]
          border
          border-white/10
          rounded-3xl
          p-8
        "
      >
        <div className="text-center">
          <div className="text-6xl">🧠</div>

          <h1
            className="
              text-4xl
              font-bold
              mt-4
            "
          >
            AI STUDIO HQ
          </h1>

          <p
            className="
              text-gray-500
              mt-2
            "
          >
            Owner Access
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="
            mt-8
            space-y-5
          "
        >
          <div>
            <label
              htmlFor="email"
              className="
                block
                text-sm
                text-gray-400
                mb-2
              "
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="
                w-full
                bg-black
                border
                border-white/15
                rounded-xl
                px-4
                py-3
                outline-none
                focus:border-white/40
              "
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="
                block
                text-sm
                text-gray-400
                mb-2
              "
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="
                w-full
                bg-black
                border
                border-white/15
                rounded-xl
                px-4
                py-3
                outline-none
                focus:border-white/40
              "
            />
          </div>

          {errorMessage && (
            <div
              className="
                border
                border-red-500/20
                bg-red-500/10
                text-red-300
                rounded-xl
                px-4
                py-3
                text-sm
              "
            >
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="
              w-full
              bg-white
              text-black
              font-semibold
              rounded-xl
              py-3
              disabled:opacity-50
              disabled:cursor-not-allowed
            "
          >
            {isLoading ? "Signing in..." : "Enter Headquarters"}
          </button>
        </form>
      </div>
    </main>
  );
}
