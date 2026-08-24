import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Supabase auth environment variables are not configured.");
}

export async function createSupabaseAuthServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl as string,
    supabasePublishableKey as string,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach((cookie) => {
              cookieStore.set(cookie.name, cookie.value, cookie.options);
            });
          } catch {
            // Cookie writes can be unavailable
            // from some Server Component contexts.
          }
        },
      },
    },
  );
}
