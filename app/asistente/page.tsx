import { QualityAssistant } from "@/components/assistant/quality-assistant";
import { getAssistantInitialData } from "@/lib/assistant/quality-assistant";
import type { AssistantFilterOptions } from "@/lib/assistant/types";

export const dynamic = "force-dynamic";

export default async function AsistentePage() {
  const initialData = await getInitialData();

  return <QualityAssistant {...initialData} />;
}

async function getInitialData(): Promise<{
  filterOptions: AssistantFilterOptions;
  initialError: string;
}> {
  try {
    const { filterOptions } = await getAssistantInitialData();

    return {
      filterOptions,
      initialError: "",
    };
  } catch (error) {
    return {
      filterOptions: {
        plants: [],
        customers: [],
        products: [],
        operations: [],
        shifts: [],
      },
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
