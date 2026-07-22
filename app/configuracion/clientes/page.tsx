import { CustomerConfig } from "@/components/configuration/customer-config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ClientesConfiguracionPage() {
  const initialData = await getInitialData();

  return <CustomerConfig {...initialData} />;
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
      return emptyInitialData("", "");
    }

    const { data: plants, error: plantsError } = await supabase
      .from("plants")
      .select("id, company_id, name, active, created_at, updated_at")
      .eq("company_id", initialSelectedCompanyId)
      .order("name", { ascending: true });

    if (plantsError) {
      throw plantsError;
    }

    const initialPlants = plants ?? [];
    const initialSelectedPlantId = initialPlants[0]?.id ?? "";

    if (!initialSelectedPlantId) {
      return {
        initialCompanies,
        initialPlants,
        initialCustomers: [],
        initialSelectedCompanyId,
        initialSelectedPlantId,
        initialError: "",
      };
    }

    const { data: customers, error: customersError } = await supabase
      .from("customers")
      .select("id, plant_id, name, active, created_at, updated_at")
      .eq("plant_id", initialSelectedPlantId)
      .order("name", { ascending: true });

    if (customersError) {
      throw customersError;
    }

    return {
      initialCompanies,
      initialPlants,
      initialCustomers: customers ?? [],
      initialSelectedCompanyId,
      initialSelectedPlantId,
      initialError: "",
    };
  } catch (error) {
    return {
      ...emptyInitialData("", ""),
      initialError: getErrorMessage(error),
    };
  }
}

function emptyInitialData(initialSelectedCompanyId: string, initialSelectedPlantId: string) {
  return {
    initialCompanies: [],
    initialPlants: [],
    initialCustomers: [],
    initialSelectedCompanyId,
    initialSelectedPlantId,
    initialError: "",
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ocurrio un error inesperado.";
}
