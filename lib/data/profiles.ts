import { createClient } from "@/lib/supabase/server";

export async function getCurrentProfile() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, company_id, full_name, role, companies(name)")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(`No se pudo cargar el perfil: ${error.message}`);
  return data;
}
