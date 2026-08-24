import { createSupabaseAuthServerClient } from "@/lib/supabase/authServer";

/*
  CHECK API OWNER SESSION

  API routes should return JSON 401
  rather than redirecting to /login.
*/

export async function isApiOwnerAuthenticated() {
  const supabase = await createSupabaseAuthServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return false;
  }

  return true;
}
