import { FailureModeConfig } from "@/components/configuration/failure-mode-config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ModosFallaConfiguracionPage() {
  const initialData = await getInitialData();

  return <FailureModeConfig {...initialData} />;
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
      return emptyInitialData("");
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
        ...emptyInitialData(initialSelectedCompanyId),
        initialCompanies,
        initialPlants,
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

    const initialCustomers = customers ?? [];
    const initialSelectedCustomerId = initialCustomers[0]?.id ?? "";

    if (!initialSelectedCustomerId) {
      return {
        ...emptyInitialData(initialSelectedCompanyId),
        initialCompanies,
        initialPlants,
        initialCustomers,
        initialSelectedPlantId,
      };
    }

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, customer_id, code, name, active, created_at, updated_at")
      .eq("customer_id", initialSelectedCustomerId)
      .order("code", { ascending: true });

    if (productsError) {
      throw productsError;
    }

    const initialProducts = products ?? [];
    const initialSelectedProductId = initialProducts[0]?.id ?? "";

    if (!initialSelectedProductId) {
      return {
        ...emptyInitialData(initialSelectedCompanyId),
        initialCompanies,
        initialPlants,
        initialCustomers,
        initialProducts,
        initialSelectedPlantId,
        initialSelectedCustomerId,
      };
    }

    const { data: operations, error: operationsError } = await supabase
      .from("operations")
      .select("id, product_id, code, name, created_at, updated_at")
      .eq("product_id", initialSelectedProductId)
      .order("code", { ascending: true });

    if (operationsError) {
      throw operationsError;
    }

    const initialOperations = operations ?? [];
    const initialSelectedOperationId = initialOperations[0]?.id ?? "";

    if (!initialSelectedOperationId) {
      return {
        ...emptyInitialData(initialSelectedCompanyId),
        initialCompanies,
        initialPlants,
        initialCustomers,
        initialProducts,
        initialOperations,
        initialSelectedPlantId,
        initialSelectedCustomerId,
        initialSelectedProductId,
      };
    }

    const { data: failureModes, error: failureModesError } = await supabase
      .from("failure_modes")
      .select("id, operation_id, name, active, created_at, updated_at")
      .eq("operation_id", initialSelectedOperationId)
      .order("name", { ascending: true });

    if (failureModesError) {
      throw failureModesError;
    }

    return {
      initialCompanies,
      initialPlants,
      initialCustomers,
      initialProducts,
      initialOperations,
      initialFailureModes: failureModes ?? [],
      initialSelectedCompanyId,
      initialSelectedPlantId,
      initialSelectedCustomerId,
      initialSelectedProductId,
      initialSelectedOperationId,
      initialError: "",
    };
  } catch (error) {
    return {
      ...emptyInitialData(""),
      initialError: getErrorMessage(error),
    };
  }
}

function emptyInitialData(initialSelectedCompanyId: string) {
  return {
    initialCompanies: [],
    initialPlants: [],
    initialCustomers: [],
    initialProducts: [],
    initialOperations: [],
    initialFailureModes: [],
    initialSelectedCompanyId,
    initialSelectedPlantId: "",
    initialSelectedCustomerId: "",
    initialSelectedProductId: "",
    initialSelectedOperationId: "",
    initialError: "",
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ocurrio un error inesperado.";
}
