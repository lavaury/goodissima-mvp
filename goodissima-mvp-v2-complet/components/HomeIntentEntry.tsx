"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { isSafeHomeDestination } from "@/lib/home-intent";
import type { HomeIntentChoice } from "@/lib/home-intent";
import { saveHomeIntentPrefill } from "@/lib/home-intent-prefill";

type HomeIntentResponse =
  | { kind: "PROPOSAL"; reformulation: string; action: HomeIntentChoice }
  | { kind: "CHOICES"; reformulation: string; choices: HomeIntentChoice[] }
  | { kind: "UNKNOWN"; message: string };

export function HomeIntentEntry() {
  const router = useRouter();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<HomeIntentResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function understand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (text.trim().length < 3 || busy) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/home/interpret", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.trim() }) });
      const body = await response.json() as HomeIntentResponse & { error?: string };
      if (!response.ok) { setError(body.error || "L'aide à l'orientation n'est pas disponible actuellement. Vous pouvez utiliser les accès ci-dessous."); return; }
      setResult(body);
    } catch { setError("L'aide à l'orientation n'est pas disponible actuellement. Vous pouvez utiliser les accès ci-dessous."); }
    finally { setBusy(false); }
  }

  function continueTo(action: HomeIntentChoice) {
    if (!isSafeHomeDestination(action.href)) { setError("Destination indisponible. Utilisez les accès ci-dessous."); return; }
    if (["CREATE_GOVERNED_JOURNEY", "CREATE_SIMPLE_LINK", "CREATE_OPPORTUNITY", "SEARCH_DIRECTORY"].includes(action.intent)) saveHomeIntentPrefill(action.intent, text);
    router.push(action.href);
  }

  function reformulate() { setResult(null); setError(""); inputRef.current?.focus(); }

  return <section aria-label="Décrire mon intention" className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 sm:p-5">
    <form onSubmit={(event) => void understand(event)}>
      <label htmlFor="home-intent-text" className="block text-sm font-semibold text-cyan-950">Décrivez votre besoin en quelques mots</label>
      <textarea id="home-intent-text" ref={inputRef} value={text} onChange={(event) => { setText(event.target.value); setResult(null); }} maxLength={500} rows={3} placeholder="Décrivez simplement ce que vous souhaitez accomplir…" className="mt-2 w-full resize-y rounded-xl border border-cyan-300 bg-white p-3 text-base text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-800" />
      <button type="submit" disabled={busy || text.trim().length < 3} className="mt-3 min-h-11 rounded-xl bg-cyan-900 px-5 py-2.5 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900 disabled:opacity-50">Comprendre ma demande</button>
      <p className="mt-2 text-xs text-cyan-950">Par exemple : « Reprendre où j’en étais », « Créer un comité de voyage », « Chercher les anciens de ma promo 1957 ».</p>
    </form>
    <p role="status" aria-live="polite" className="mt-2 text-sm text-cyan-950">{busy ? "Je cherche le meilleur point de départ…" : ""}</p>
    {error ? <p role="alert" className="mt-3 rounded-lg bg-white p-3 text-sm text-red-800">{error}</p> : null}
    {result ? <div className="mt-4 rounded-xl border border-cyan-300 bg-white p-4" aria-live="polite">
      {result.kind === "UNKNOWN" ? <p className="text-sm text-slate-800">{result.message}</p> : <><p className="font-semibold text-slate-950">J’ai compris que vous souhaitez…</p><p className="mt-1 text-sm text-slate-800">{result.reformulation}</p></>}
      {result.kind === "PROPOSAL" ? <><p className="mt-3 text-sm text-slate-700">Je vous propose : {result.action.label}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => continueTo(result.action)} className="min-h-11 rounded-lg bg-cyan-900 px-4 py-2 font-semibold text-white">Continuer</button><button type="button" onClick={reformulate} className="min-h-11 rounded-lg border px-4 py-2 font-semibold text-cyan-900">Reformuler</button></div></> : null}
      {result.kind === "CHOICES" ? <><p className="mt-3 font-semibold text-slate-900">Comment souhaitez-vous commencer ?</p><div className="mt-3 flex flex-wrap gap-2">{result.choices.map((choice) => <button key={`${choice.intent}:${choice.href}`} type="button" onClick={() => continueTo(choice)} className="min-h-11 rounded-lg border border-cyan-700 px-4 py-2 text-sm font-semibold text-cyan-900">{choice.label}</button>)}</div><button type="button" onClick={reformulate} className="mt-3 min-h-11 text-sm font-semibold text-cyan-900 underline">Reformuler</button></> : null}
      {result.kind === "UNKNOWN" ? <button type="button" onClick={reformulate} className="mt-3 min-h-11 text-sm font-semibold text-cyan-900 underline">Reformuler</button> : null}
    </div> : null}
  </section>;
}
