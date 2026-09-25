import Link from "next/link";
import type { FactualAlert } from "@/lib/factual-attention";
import { NotificationLink } from "@/components/NotificationLink";

export type UnifiedAttentionItem = {
  kind: "PERSISTED_NOTIFICATION" | "RELATION_REQUEST_ATTENTION" | "FACTUAL_ATTENTION"; key: string; relationCaseId?: string; requestId?: string; notificationId?: string; title: string;
  contextLabel: string; reason: string; href: string; createdAt?: Date;
};

export function FactualAttentionList({ items }: { items: Array<FactualAlert | UnifiedAttentionItem> }) {
  if (!items.length) return <p className="mt-3 text-sm text-slate-600" role="status">Rien ne nécessite actuellement votre attention.</p>;
  return <ul className="mt-3 divide-y rounded-xl border bg-white px-4">{items.map(item => { const notification = "key" in item; const label = notification ? item.contextLabel : item.label; return <li key={notification ? item.key : item.id} className="flex min-w-0 flex-wrap items-center gap-3 py-3">
    <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
      <p className="font-medium">{notification ? item.title : item.object} — {label}</p>
      <p className="mt-1 text-sm text-slate-600">{item.reason}{notification && item.createdAt ? <> · <time dateTime={item.createdAt.toISOString()}>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(item.createdAt)}</time></> : null}</p>
    </div>
    {notification && item.kind === "PERSISTED_NOTIFICATION" ? <NotificationLink notificationId={item.notificationId!} href={item.href} className="inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700">Ouvrir</NotificationLink> : <Link href={item.href} prefetch={false} aria-label={notification && item.kind === "RELATION_REQUEST_ATTENTION" ? `Examiner la demande : ${label}` : `Ouvrir le dossier : ${label}`} className="inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700">{notification && item.kind === "RELATION_REQUEST_ATTENTION" ? "Examiner" : "Ouvrir"}</Link>}
  </li>; })}</ul>;
}
