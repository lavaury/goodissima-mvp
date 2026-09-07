import Link from "next/link";
import type { DashboardActivity } from "@/lib/dashboard-activity-repository";

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-700";
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });

export function DashboardHome({ activity }: { activity: DashboardActivity[] }) {
  return <main className="mx-auto w-full min-w-0 max-w-3xl px-4 py-8 sm:px-6">
    <h1 className="text-3xl font-bold text-slate-950">Accueil</h1>
    <nav aria-label="Choisir une destination" className="mt-6">
      <h2 className="text-lg font-semibold text-slate-900">Que souhaitez-vous faire ?</h2>
      <ul className="mt-3 divide-y rounded-2xl border bg-white px-4">
        <li><Link data-boussole-id="open-boussole-from-dashboard" href="/boussole/decouverte" className={`block rounded-lg py-4 ${focus}`}>
          <span className="font-semibold text-[#247f88]"><span aria-hidden="true">🧭 </span>Boussole</span>
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
