import { createClient } from "@/lib/supabase/server";
import { isUserRole, type UserProfile } from "./types";

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, name, role")
    .eq("id", user.id)
    .single();

  if (error || !profile || !isUserRole(profile.role)) {
    return null;
  }

  return profile;
}
