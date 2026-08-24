import { redirect } from "next/navigation";

import { createSupabaseAuthServerClient } from "@/lib/supabase/authServer";

export async function requireOwner() {
  const supabase = await createSupabaseAuthServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return user;
}
