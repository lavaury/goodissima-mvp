import type { GovernedMemoryCockpitView } from "@/lib/governed-journey/cockpit/memory-read-model";
import type { GovernedMemoryCreationCapabilities } from "@/lib/governed-journey/cockpit/memory-creation-capabilities";
import { GovernedMemoryCreationPanel } from "./GovernedMemoryCreationPanel";
import { GovernedMemoryTransitionControls } from "./GovernedMemoryTransitionControls";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date non disponible";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

type TransitionKeys = Record<string, { ESTABLISH_FACT: string; DISPUTE_FACT: string; VALIDATE_DECISION: string }>;
export function GovernedMemoryCockpitSection({ view, creation, formTemplateId, transitionRequestKeys }: { view: GovernedMemoryCockpitView; formTemplateId: string; transitionRequestKeys: TransitionKeys; creation?: { formTemplateId: string; capabilities: GovernedMemoryCreationCapabilities; requestKeys: { fact: string; decision: string; source: string }; today: string } }) {
  return (
    <section className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">Mémoire gouvernée</h2>
      {view.availability === "NO_EXTENSION" ? (
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Ce parcours historique ne possède pas encore d’extension de mémoire gouvernée.
        </p>
      ) : view.availability === "EMPTY" ? (
        <div className="mt-3 text-sm leading-relaxed text-slate-600">
          <p>Aucune mémoire gouvernée n’a encore été enregistrée pour ce parcours.</p>
          <p className="mt-2">
            Les éléments apparaîtront ici uniquement après une action explicite et autorisée. Aucun contenu n’est créé automatiquement.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm font-semibold text-slate-700">
            {view.visibleCount} élément{view.visibleCount > 1 ? "s" : ""} mémorisé{view.visibleCount > 1 ? "s" : ""}
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {view.items.map((item) => (
              <article key={item.publicKey} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.kindLabel}</p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.state.isActive ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"}`}>
                    {item.state.label}
                  </span>
                </div>
                {item.content.title ? <h3 className="mt-3 font-bold text-slate-950">{item.content.title}</h3> : null}
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{item.content.text}</p>
                <dl className="mt-4 grid gap-2 text-xs text-slate-600">
                  <div><dt className="font-semibold text-slate-500">Enregistrée le</dt><dd>{formatDate(item.recordedAt)}</dd></div>
                  {item.provenance ? <div><dt className="font-semibold text-slate-500">Provenance</dt><dd>{item.provenance.label}{item.provenance.recordedAt ? ` · ${formatDate(item.provenance.recordedAt)}` : ""}</dd></div> : null}
                  {item.humanValidation ? <div><dt className="font-semibold text-slate-500">Validation humaine</dt><dd>{item.humanValidation.label} · {formatDate(item.humanValidation.validatedAt)}</dd></div> : null}
                  {item.disputeLabel ? <div><dt className="font-semibold text-slate-500">Contestation</dt><dd>{item.disputeLabel}</dd></div> : null}
                  {item.contextLabel ? <div><dt className="font-semibold text-slate-500">Contexte</dt><dd>{item.contextLabel}</dd></div> : null}
                </dl>
                {item.capabilities ? <GovernedMemoryTransitionControls formTemplateId={formTemplateId} publicMemoryKey={item.publicKey} concurrencyToken={item.concurrencyToken} content={item.content.title ?? item.content.text} capabilities={item.capabilities} requestKeys={transitionRequestKeys[item.publicKey]} /> : null}
              </article>
            ))}
          </div>
        </>
      )}
      {creation ? <GovernedMemoryCreationPanel {...creation} /> : null}
    </section>
  );
}
