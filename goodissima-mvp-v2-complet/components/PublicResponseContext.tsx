"use client";

type ResponseContextDetail = { label: string; value: string };

export function PublicResponseContext({
  kind,
  title,
  city,
  description,
  welcomeMessage,
  details = [],
}: {
  kind: "SIMPLE_LINK" | "OPPORTUNITY";
  title: string;
  city?: string | null;
  description?: string | null;
  welcomeMessage?: string | null;
  details?: ResponseContextDetail[];
}) {
  const distinctWelcome = welcomeMessage?.trim() && welcomeMessage.trim() !== description?.trim() ? welcomeMessage.trim() : null;
  return <aside className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-5" aria-label="Contexte de votre réponse">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">{kind === "SIMPLE_LINK" ? "Vous répondez à ce lien" : "Vous répondez à cette annonce"}</p>
    <h3 className="mt-2 text-lg font-bold text-slate-950">{title}</h3>
    {city ? <p className="mt-1 text-sm font-medium text-slate-600">{city}</p> : null}
    {description ? <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-slate-700">{description}</p> : null}
    {distinctWelcome ? <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-slate-700">{distinctWelcome}</p> : null}
    {details.length ? <dl className="mt-3 flex flex-wrap gap-2">{details.slice(0, 4).map((detail) => <div key={`${detail.label}-${detail.value}`} className="rounded-lg bg-white px-3 py-2 text-xs"><dt className="text-slate-500">{detail.label}</dt><dd className="mt-0.5 font-semibold text-slate-800">{detail.value}</dd></div>)}</dl> : null}
    <a href="#public-link-context" onClick={(event) => { event.preventDefault(); const target = document.getElementById("public-link-context"); target?.scrollIntoView({ behavior: "smooth", block: "start" }); target?.focus({ preventScroll: true }); }} className="mt-4 inline-block text-sm font-semibold text-cyan-900 underline underline-offset-2">↑ Remonter au contexte complet</a>
  </aside>;
}
