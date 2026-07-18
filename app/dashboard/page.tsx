import { QualityDashboard } from "@/components/dashboard/quality-dashboard";
import { getDashboardData } from "@/lib/dashboard/get-dashboard-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const initialData = await getDashboardData();

  return <QualityDashboard {...initialData} />;
}
