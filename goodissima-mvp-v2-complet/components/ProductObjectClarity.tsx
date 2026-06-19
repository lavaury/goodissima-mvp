import { productLifecycle, productObjectDefinitions, productObjectGuidance, type ProductObject } from "@/lib/product-object-clarity";

export function ProductObjectDefinition({ object }: { object: "journey" | "announcement" | "relation" | "workspace" }) {
  return <p className="mt-1 text-sm text-slate-500">{productObjectDefinitions[object]}</p>;
}

export function ProductContextBanner({ object }: { object: "journey" | "announcement" | "relation" }) {
  return <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950"><strong>À retenir :</strong> {productObjectGuidance[object]}</div>;
}

export function ProductLifecycle({ current, compact = false }: { current: ProductObject; compact?: boolean }) {
  return <section className={`rounded-2xl border bg-white ${compact ? "p-3" : "p-5"}`} aria-label="Cycle des objets Goodissima"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#247f88]">Comment les objets se relient</p><div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">{productLifecycle.map((step, index) => <div key={step.id} className="flex shrink-0 items-center gap-2"><span aria-current={step.id === current ? "step" : undefined} className={`rounded-full px-3 py-2 text-xs font-semibold ${step.id === current ? "bg-slate-900 text-white ring-4 ring-cyan-100" : "bg-slate-100 text-slate-600"}`}>{step.label}</span>{index < productLifecycle.length - 1 ? <span className="text-slate-400" aria-hidden="true">↓</span> : null}</div>)}</div></section>;
}
