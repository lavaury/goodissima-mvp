import Link from "next/link";
import { FactualAttentionList } from "@/components/FactualAttentionList";
import type { ResolvedFavorite } from "@/lib/personal-favorites-repository";
import type { FactualAttention } from "@/lib/factual-attention";
import type { DashboardActivity } from "@/lib/dashboard-activity-repository";

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-700";
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });

export function DashboardHome({ activity, attention, favorites = [] }: { activity: DashboardActivity[]; attention: FactualAttention; favorites?: ResolvedFavorite[] }) {
  return <main className="mx-auto w-full min-w-0 max-w-3xl px-4 py-8 sm:px-6">
    <h1 className="text-3xl font-bold text-slate-950">Accueil</h1>
    <nav aria-label="Choisir une destination" className="mt-6">
      <h2 className="text-lg font-semibold text-slate-900">Que souhaitez-vous faire ?</h2>
      <ul className="mt-3 divide-y rounded-2xl border bg-white px-4">
        <li><Link data-boussole-id="open-boussole-from-dashboard" href="/boussole/decouverte" className={`block rounded-lg py-4 ${focus}`}>
          <span className="font-semibold text-[#247f88]"><span aria-hidden="true">🧭 </span>Bien démarrer</span>
          <span className="mt-1 block text-sm text-slate-600">Comprendre les possibilités et choisir comment commencer.</span>
        </Link></li>
        <li><Link data-boussole-id="dashboard-open-directory" href="/annuaire" className={`block rounded-lg py-4 ${focus}`}>
          <span className="font-semibold text-[#247f88]"><span aria-hidden="true">🌍 </span>Annuaire</span>
          <span className="mt-1 block text-sm text-slate-600">Trouver des personnes et organisations.</span>
        </Link></li>
        <li><Link data-boussole-id="dashboard-open-spaces" href="/gouvernance" className={`block rounded-lg py-4 ${focus}`}>
          <span className="font-semibold text-[#247f88]"><span aria-hidden="true">📁 </span>Mes espaces</span>
          <span className="mt-1 block text-sm text-slate-600">Ouvrir et organiser vos Portfolios et Workspaces.</span>
        </Link></li>
      </ul>
    </nav>
    <section aria-labelledby="dashboard-attention-title" className="mt-8">
      <h2 id="dashboard-attention-title" className="text-lg font-semibold text-slate-900">À votre attention</h2>
      <FactualAttentionList items={attention.items} />
      {attention.items.length > 0 && <Link href="/alertes" className={`mt-2 inline-flex min-h-11 items-center rounded-lg text-sm underline ${focus}`}>Voir toutes</Link>}
    </section>
    <section aria-labelledby="dashboard-favorites-title" className="mt-8">
      <h2 id="dashboard-favorites-title" className="text-lg font-semibold text-slate-900"><span aria-hidden="true">★ </span>Favoris</h2>
      {favorites.length ? <ul className="mt-3 divide-y rounded-2xl border bg-white px-4">
        {favorites.map(item => <li key={`${item.objectKind}:${item.objectId}`} className="flex min-w-0 items-center justify-between gap-3 py-3">
          <div className="min-w-0"><span className="block text-xs text-slate-600">{item.label}</span>
            <span className="block break-words font-medium [overflow-wrap:anywhere]">{item.title}</span></div>
          <Link href={item.href} prefetch={false} aria-label={`Ouvrir ${item.title}`} className={`inline-flex min-h-11 shrink-0 items-center rounded-lg text-sm underline ${focus}`}>Ouvrir</Link>
        </li>)}
      </ul> : <p className="mt-3 text-sm text-slate-600">Ajoutez un objet aux favoris via son menu ••• pour le retrouver ici.</p>}
      <Link href="/favoris" className={`mt-2 inline-flex min-h-11 items-center rounded-lg text-sm underline ${focus}`}>Voir tous</Link>
    </section>
    {activity.length > 0 ? <section data-boussole-id="dashboard-recent-activity" aria-labelledby="dashboard-activity-title" className="mt-8">
      <h2 id="dashboard-activity-title" className="text-lg font-semibold text-slate-900">Activité récente</h2>
      <p className="mt-1 text-sm text-slate-600">Quelques créations et dépôts récents.</p>
      <ul className="mt-3 divide-y rounded-2xl border bg-white px-4">
        {activity.map(item => <li key={item.id}>
          <Link data-boussole-id={item.id.startsWith("link-") ? "timeline-created-link" : undefined} href={item.href} className={`block min-w-0 rounded-lg py-4 ${focus}`}>
            <span className="block break-words font-medium text-slate-900 [overflow-wrap:anywhere]">{item.label} — {item.context}</span>
            <time dateTime={item.date.toISOString()} className="mt-1 block text-sm text-slate-600">{dateFormat.format(item.date)} (Paris)</time>
          </Link>
        </li>)}
      </ul>
    </section> : null}
  </main>;
}
