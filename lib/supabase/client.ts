import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Supabase browser environment variables are not configured.");
}

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    supabaseUrl as string,
    supabasePublishableKey as string,
  );
}
