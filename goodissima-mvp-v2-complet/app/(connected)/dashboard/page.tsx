import { unstable_noStore as noStore } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getDashboardActivity } from "@/lib/dashboard-activity-repository";
import { DashboardHome } from "@/components/DashboardHome";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function DashboardPage() {
  noStore();
  const owner = await getCurrentPrismaUser();
  const activity = await getDashboardActivity(owner.id);
  return <DashboardHome activity={activity} />;
}
