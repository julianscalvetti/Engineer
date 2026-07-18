import { ControlHistory } from "@/components/controls/control-history";
import {
  defaultControlHistoryFilters,
  getControlHistoryPageData,
} from "@/lib/controls/get-control-records";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ControlesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialData = await getInitialData(params);

  return <ControlHistory {...initialData} />;
}

async function getInitialData(params: Record<string, string | string[] | undefined>) {
  const supabase = await createClient();
  const filters = defaultControlHistoryFilters({
    dateFrom: firstParam(params.dateFrom),
    dateTo: firstParam(params.dateTo),
    customerId: firstParam(params.customerId),
    productId: firstParam(params.productId),
    operationId: firstParam(params.operationId),
    failureModeId: firstParam(params.failureModeId),
    page: firstParam(params.page),
    pageSize: firstParam(params.pageSize),
  });

  return getControlHistoryPageData(supabase, filters);
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
