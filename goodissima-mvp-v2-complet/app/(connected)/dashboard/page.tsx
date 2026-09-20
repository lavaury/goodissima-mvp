import { unstable_noStore as noStore } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getDashboardActivity } from "@/lib/dashboard-activity-repository";
import { DashboardHome } from "@/components/DashboardHome";
import { readFavoritePage } from "@/lib/personal-favorites-repository";
import { getFactualAttention } from "@/lib/factual-attention";
import { getNotificationViewsForUser } from "@/lib/notification-projection";
import { mergeAttention } from "@/lib/unified-attention";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function DashboardPage() {
  noStore();
  const owner = await getCurrentPrismaUser();
  const [activity, notifications, factual, favorites] = await Promise.all([getDashboardActivity(owner.id), getNotificationViewsForUser(owner.id, { limit: 3, unreadOnly: true }), getFactualAttention(owner.id, 0, 3), readFavoritePage(owner.id, 0)]);
  return <DashboardHome activity={activity} attention={mergeAttention(notifications.items, factual.items)} favorites={favorites.items.slice(0, 5)} />;
}
