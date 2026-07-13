import { createClient } from "@/lib/supabase/server";

export async function listProducts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, company_id, code, name, description, active, created_at, updated_at")
    .order("code");

  if (error) throw new Error(`No se pudieron cargar los productos: ${error.message}`);
  return data;
}
