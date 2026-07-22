import { CompanyPlantConfig } from "@/components/configuration/company-plant-config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const initialData = await getInitialData();

  return <CompanyPlantConfig {...initialData} />;
}

async function getInitialData() {
  try {
    const supabase = await createClient();
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id, name, active, created_at, updated_at")
      .order("name", { ascending: true });

    if (companiesError) {
      throw companiesError;
    }

    const initialCompanies = companies ?? [];
    const initialSelectedCompanyId = initialCompanies[0]?.id ?? "";

    if (!initialSelectedCompanyId) {
      return {
        initialCompanies,
        initialPlants: [],
        initialSelectedCompanyId,
        initialError: "",
      };
    }

    const { data: plants, error: plantsError } = await supabase
      .from("plants")
      .select("id, company_id, name, active, created_at, updated_at")
      .eq("company_id", initialSelectedCompanyId)
      .order("name", { ascending: true });

    if (plantsError) {
      throw plantsError;
    }

    return {
      initialCompanies,
      initialPlants: plants ?? [],
      initialSelectedCompanyId,
      initialError: "",
    };
  } catch (error) {
    return {
      initialCompanies: [],
      initialPlants: [],
      initialSelectedCompanyId: "",
      initialError: getErrorMessage(error),
    };
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ocurrio un error inesperado.";
}
