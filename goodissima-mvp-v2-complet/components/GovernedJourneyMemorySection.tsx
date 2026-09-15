import type { JourneyMemoryProjection } from "@/lib/governed-memory/contracts";
import { disputeJourneyFactAction, establishJourneyFactAction, proposeJourneyFactAction, recordJourneyDecisionAction, registerJourneySourceAction, validateJourneyDecisionAction } from "@/lib/governed-memory/journey-actions";
import { factStateLabel, projectJourneyMemoryView } from "@/lib/governed-memory/journey-view";

type Props = {
  memory: JourneyMemoryProjection;
  context: { journeyId: string; relationCaseId: string | null; formTemplateId: string };
};

const fieldClass = "mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-800";
const buttonClass = "min-h-11 rounded-lg bg-cyan-800 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-800";
const secondaryButtonClass = "min-h-11 rounded-lg border border-cyan-800 bg-white px-4 py-2 text-sm font-bold text-cyan-900 hover:bg-cyan-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-800";

function HumanSourceType({ type }: { type: string }) {
  const label = type === "Déclaration humaine" ? "Déclaration" : type === "Événement système" ? "Événement" : type === "Import externe" ? "Source externe" : type;
  return <span>{label}</span>;
}

export function GovernedJourneyMemorySection({ memory, context }: Props) {
  const view = projectJourneyMemoryView(memory);
  const completelyEmpty = view.facts.length === 0 && view.decisions.length === 0 && view.sources.length === 0 && view.pending.length === 0;

  return (
    <section id="journey-memory" aria-labelledby="journey-memory-title" className="mt-6 overflow-hidden rounded-lg border bg-white p-4 shadow-sm sm:p-6">
      <h2 id="journey-memory-title" className="text-2xl font-bold text-slate-950">Ce que nous retenons</h2>
      <p className="mt-2 text-sm text-slate-600">Les éléments confirmés ou encore à vérifier dans ce parcours.</p>

      {completelyEmpty ? <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">Aucun élément retenu pour le moment.</p> : (
        <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
          {view.facts.length > 0 ? <div className="min-w-0 rounded-xl border border-slate-200 p-4">
            <h3 className="font-bold text-slate-950">Faits</h3>
            <ul className="mt-3 space-y-3">{view.facts.map((fact) => <li key={fact.handle} className="min-w-0 rounded-lg bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Fait</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${fact.state === "contested" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{factStateLabel(fact.state)}</span></div>
              <p className="mt-2 break-words text-sm text-slate-900">{fact.statement}</p>
              {fact.state === "contested" ? <p className="mt-2 text-sm font-semibold text-amber-900">Cet élément fait actuellement l’objet d’une contestation.</p> : null}
              {fact.state === "established" && memory.capabilities.canDispute ? <details className="mt-3">
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-cyan-900">Contester</summary>
                <form action={disputeJourneyFactAction.bind(null, context, fact.handle)} className="mt-2 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <label className="block text-sm font-semibold text-slate-800">Pourquoi contestez-vous cet élément ?<textarea required maxLength={4000} name="reason" rows={3} className={fieldClass} /></label>
                  <button className={buttonClass} type="submit">Contester</button>
                </form>
              </details> : null}
            </li>)}</ul>
          </div> : null}

          {view.decisions.length > 0 ? <div className="min-w-0 rounded-xl border border-slate-200 p-4">
            <h3 className="font-bold text-slate-950">Décisions</h3>
            <ul className="mt-3 space-y-3">{view.decisions.map((decision) => <li key={decision.handle} className="min-w-0 rounded-lg bg-slate-50 p-3"><p className="break-words text-sm font-semibold text-slate-950">{decision.title}</p>{decision.rationale ? <p className="mt-1 break-words text-sm text-slate-600">{decision.rationale}</p> : null}<span className="mt-2 inline-block rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900">Confirmée</span></li>)}</ul>
          </div> : null}

          {view.sources.length > 0 ? <div className="min-w-0 rounded-xl border border-slate-200 p-4">
            <h3 className="font-bold text-slate-950">Sources</h3>
            <p className="mt-1 text-xs text-slate-500">Ces sources éclairent le parcours sans constituer, à elles seules, des faits confirmés.</p>
            <ul className="mt-3 space-y-3">{view.sources.map((source) => <li key={source.handle} className="min-w-0 rounded-lg bg-slate-50 p-3"><p className="break-words text-sm font-semibold text-slate-950">{source.title}</p><p className="mt-1 text-xs text-slate-600"><HumanSourceType type={source.type} /> · {source.available ? "Disponible" : "Indisponible"}</p></li>)}</ul>
          </div> : null}

          {view.pending.length > 0 ? <div className="min-w-0 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="font-bold text-amber-950">À confirmer</h3>
            <p className="mt-1 text-xs text-amber-900">Ces éléments ont été proposés mais ne sont pas encore confirmés.</p>
            <ul className="mt-3 space-y-3">{view.pending.map((item) => <li key={`${item.kind}-${item.handle}`} className="min-w-0 rounded-lg bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">{item.kind === "fact" ? "Proposition de fait" : "Décision à confirmer"}</p>
              <p className="mt-1 break-words text-sm text-slate-900">{item.label}</p>
              {item.kind === "fact" && memory.capabilities.canEstablishFact ? <form action={establishJourneyFactAction.bind(null, context, item.handle)} className="mt-3"><p className="mb-2 text-xs text-slate-600">Cet élément sera conservé comme fait confirmé dans la mémoire du parcours.</p><button className={buttonClass} type="submit">Confirmer comme fait</button></form> : null}
              {item.kind === "decision" && memory.capabilities.canValidateDecision ? <form action={validateJourneyDecisionAction.bind(null, context, item.handle)} className="mt-3"><button className={buttonClass} type="submit">Confirmer la décision</button></form> : null}
            </li>)}</ul>
          </div> : null}
        </div>
      )}

      <div className="mt-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
        {memory.capabilities.canPropose ? <details className="min-w-0 sm:w-80"><summary className={secondaryButtonClass + " cursor-pointer list-none text-center"}>Proposer un fait</summary><form action={proposeJourneyFactAction.bind(null, context)} className="mt-2 space-y-3 rounded-lg border bg-slate-50 p-3"><label className="block text-sm font-semibold text-slate-800">Quel élément souhaitez-vous retenir ?<textarea required maxLength={4000} name="statement" rows={3} className={fieldClass} /></label><button className={buttonClass} type="submit">Proposer le fait</button></form></details> : null}
        {memory.capabilities.canRecordDecision ? <details className="min-w-0 sm:w-80"><summary className={secondaryButtonClass + " cursor-pointer list-none text-center"}>Préparer une décision</summary><form action={recordJourneyDecisionAction.bind(null, context)} className="mt-2 space-y-3 rounded-lg border bg-slate-50 p-3"><label className="block text-sm font-semibold text-slate-800">Quelle décision souhaitez-vous retenir ?<input required maxLength={300} name="title" className={fieldClass} /></label><label className="block text-sm font-semibold text-slate-800">Pourquoi ?<textarea required maxLength={4000} name="rationale" rows={3} className={fieldClass} /></label><button className={buttonClass} type="submit">Préparer la décision</button></form></details> : null}
        {memory.capabilities.canRegisterSource ? <details className="min-w-0 sm:w-80"><summary className={secondaryButtonClass + " cursor-pointer list-none text-center"}>Ajouter une source</summary><form action={registerJourneySourceAction.bind(null, context)} className="mt-2 space-y-3 rounded-lg border bg-slate-50 p-3"><label className="block text-sm font-semibold text-slate-800">Comment nommer cette source ?<input required maxLength={300} name="title" className={fieldClass} /></label><label className="block text-sm font-semibold text-slate-800">Quelle référence permet de la retrouver ?<input required maxLength={500} name="reference" className={fieldClass} /></label><button className={buttonClass} type="submit">Ajouter la source</button></form></details> : null}
      </div>
    </section>
  );
}
