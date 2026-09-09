import { unstable_noStore as noStore } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getDashboardActivity } from "@/lib/dashboard-activity-repository";
import { DashboardHome } from "@/components/DashboardHome";
import { getFactualAttention } from "@/lib/factual-attention";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function DashboardPage() {
  noStore();
  const owner = await getCurrentPrismaUser();
  const [activity, attention] = await Promise.all([getDashboardActivity(owner.id), getFactualAttention(owner.id, 0, 3)]);
  return <DashboardHome activity={activity} attention={attention} />;
}
