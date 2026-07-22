import type { SupabaseClient } from "@supabase/supabase-js";

export type TenantContext =
  | {
      status: "ready";
      userId: string;
      role: "owner" | "engineer" | "operator";
      company: {
        id: string;
        name: string;
      };
      plant: {
        id: string;
        name: string;
      };
    }
  | {
      status: "unauthenticated" | "unauthorized";
      message: string;
    };

type MembershipRow = {
  company_id: string;
  role: string;
  active: boolean;
};

type CompanyRow = {
  id: string;
  name: string;
  active: boolean;
};

type PlantRow = {
  id: string;
  company_id: string;
  name: string;
  active: boolean;
};

const roles = new Set(["owner", "engineer", "operator"]);

export async function getActiveTenantContext(
  supabase: SupabaseClient,
  options: { accessToken?: string } = {},
): Promise<TenantContext> {
  const {
    data: { user },
    error: userError,
  } = options.accessToken ? await supabase.auth.getUser(options.accessToken) : await supabase.auth.getUser();

  if (userError || !user) {
    return {
      status: "unauthenticated",
      message: "Inicia sesion para acceder a los datos de la empresa.",
    };
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id, role, active")
    .eq("user_id", user.id)
    .eq("active", true);

  if (membershipError) {
    throw new Error(`No se pudo resolver la membresia del usuario: ${membershipError.message}`);
  }

  const activeMemberships = ((memberships ?? []) as MembershipRow[]).filter((membership) =>
    roles.has(membership.role),
  );

  if (activeMemberships.length === 0) {
    return {
      status: "unauthorized",
      message: "El usuario autenticado no tiene una membresia activa en ninguna empresa.",
    };
  }

  const companyIds = activeMemberships.map((membership) => membership.company_id);
  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id, name, active")
    .in("id", companyIds)
    .eq("active", true)
    .order("name", { ascending: true });

  if (companiesError) {
    throw new Error(`No se pudo resolver la empresa activa: ${companiesError.message}`);
  }

  const activeCompanies = (companies ?? []) as CompanyRow[];
  const company = activeCompanies.find((item) => item.name === "ROMET") ?? activeCompanies[0];
  if (!company) {
    return {
      status: "unauthorized",
      message: "La membresia del usuario no corresponde a una empresa activa.",
    };
  }

  const membership = activeMemberships.find((item) => item.company_id === company.id);
  if (!membership || !roles.has(membership.role)) {
    return {
      status: "unauthorized",
      message: "No se encontro un rol valido para la empresa activa.",
    };
  }

  const { data: plants, error: plantsError } = await supabase
    .from("plants")
    .select("id, company_id, name, active")
    .eq("company_id", company.id)
    .eq("active", true)
    .order("name", { ascending: true });

  if (plantsError) {
    throw new Error(`No se pudo resolver la planta activa: ${plantsError.message}`);
  }

  const activePlants = (plants ?? []) as PlantRow[];
  const plant = activePlants.find((item) => item.name === "Planta Principal") ?? activePlants[0];
  if (!plant) {
    return {
      status: "unauthorized",
      message: "La empresa activa no tiene plantas activas disponibles.",
    };
  }

  return {
    status: "ready",
    userId: user.id,
    role: membership.role as "owner" | "engineer" | "operator",
    company: {
      id: company.id,
      name: company.name,
    },
    plant: {
      id: plant.id,
      name: plant.name,
    },
  };
}
