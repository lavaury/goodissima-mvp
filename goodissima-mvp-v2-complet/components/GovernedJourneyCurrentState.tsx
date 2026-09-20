import type { GovernedJourneyCurrentState } from "@/lib/governed-journey-current-state";
import { GovernedJourneyCurrentStateExplanation } from "@/components/GovernedJourneyCurrentStateExplanation";

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function CurrentStateBlock({ title, detail, href, linkLabel }: { title: string; detail: string; href: string; linkLabel: string }) {
  return <article className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-bold text-slate-950">{title}</h3><p className="mt-1 text-sm text-slate-700">{detail}</p><a href={href} className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-cyan-900 underline underline-offset-4">{linkLabel}</a></article>;
}

export function GovernedJourneyCurrentStateView({ state, journeyId }: { state: GovernedJourneyCurrentState; journeyId?: string }) {
  const hasState = Boolean(state.decisions || state.facts || state.sources || state.peopleAndRoles || state.clarifications.length || state.nextMeeting);
  return <section data-boussole-id="governed-journey-summary" className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
    <h2 className="text-xl font-bold text-slate-950">Où en sommes-nous ?</h2>
    {!hasState ? <p className="mt-3 text-sm text-slate-600">Aucun état gouverné significatif n’est encore établi pour ce parcours.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {state.decisions ? <CurrentStateBlock title="Décisions en vigueur" detail={plural(state.decisions.count, "décision confirmée", "décisions confirmées")} href={state.decisions.href} linkLabel="Voir les décisions" /> : null}
      {state.facts ? <CurrentStateBlock title="Faits retenus" detail={`${plural(state.facts.establishedCount, "fait établi", "faits établis")}${state.facts.disputedCount ? ` · ${plural(state.facts.disputedCount, "fait contesté", "faits contestés")}` : ""}`} href={state.facts.href} linkLabel="Voir les faits" /> : null}
      {state.sources ? <CurrentStateBlock title="Sources" detail={plural(state.sources.activeCount, "source active", "sources actives")} href={state.sources.href} linkLabel="Voir les sources" /> : null}
      {state.peopleAndRoles ? <CurrentStateBlock title="Participants et rôles" detail={`${plural(state.peopleAndRoles.participantCount, "participant", "participants")}${state.peopleAndRoles.activeRoleCount ? ` · ${plural(state.peopleAndRoles.activeRoleCount, "rôle occupé", "rôles occupés")}` : ""}${state.peopleAndRoles.vacantRoleCount ? ` · ${plural(state.peopleAndRoles.vacantRoleCount, "rôle à pourvoir", "rôles à pourvoir")}` : ""}`} href={state.peopleAndRoles.href} linkLabel="Voir les personnes" /> : null}
      {state.clarifications.length ? <article className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-bold text-amber-950">À clarifier</h3><ul className="mt-2 space-y-1 text-sm text-amber-950">{state.clarifications.map(item => <li key={item.kind}>{item.label}</li>)}</ul></article> : null}
      {state.nextMeeting ? <article className="rounded-xl border border-cyan-200 bg-cyan-50 p-4"><h3 className="font-bold text-cyan-950">Prochaine étape</h3><p className="mt-1 text-sm text-cyan-950">Réunion « {state.nextMeeting.title} » le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(state.nextMeeting.scheduledAt)}</p><a href={state.nextMeeting.href} className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-cyan-900 underline underline-offset-4">Voir la réunion</a></article> : null}
    </div>}
    {journeyId ? <GovernedJourneyCurrentStateExplanation journeyId={journeyId} /> : null}
  </section>;
}
