import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { attentionPage, getFactualAttention } from "@/lib/factual-attention";
import { FactualAttentionList } from "@/components/FactualAttentionList";
import { getNotificationViewsForUser } from "@/lib/notification-projection";
import { factualAttention, notificationAttention, relationRequestAttention } from "@/lib/unified-attention";
import { getPendingRelationRequestAttentionForUser } from "@/lib/pending-relation-request-attention";

export const dynamic = "force-dynamic";
export default async function AlertsPage({ searchParams }: { searchParams: { page?: string | string[] } }) {
  noStore();
  const user = await getCurrentPrismaUser();
  const page = attentionPage(searchParams.page);
  const [notifications, attention, relationRequests] = await Promise.all([getNotificationViewsForUser(user.id, { limit: 20, page }), getFactualAttention(user.id, page), getPendingRelationRequestAttentionForUser(user.id)]);
  const represented = new Set(notifications.items.map(item => item.relationCaseId));
  const items = [...(page === 0 ? relationRequests.map(relationRequestAttention) : []), ...notifications.items.map(notificationAttention), ...attention.items.filter(item => !represented.has(item.id)).map(factualAttention)];
  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
    <h1 className="text-2xl font-bold">Alertes Goodissima</h1>
    <p className="mt-2 text-slate-600">Les éléments qui nécessitent actuellement votre attention.</p>
    <p className="mt-2 text-sm text-slate-600">Demandes de relation, notifications récentes, puis dossiers actifs marqués « En attente propriétaire » ou « À vérifier ».</p>
    {page > 0 && !items.length ? <p role="status" className="mt-3 text-sm text-slate-600">Aucun élément sur cette page.</p> : <FactualAttentionList items={items} />}
    <nav aria-label="Pages des alertes" className="mt-5 flex flex-wrap gap-3">
      {page > 0 && <Link href={`/alertes?page=${page - 1}`} className="inline-flex min-h-11 items-center rounded-lg border px-3">Précédent</Link>}
      {(notifications.hasMore || attention.hasMore) && <Link href={`/alertes?page=${page + 1}`} className="inline-flex min-h-11 items-center rounded-lg border px-3">Suivant</Link>}
    </nav>
  </main>;
}
