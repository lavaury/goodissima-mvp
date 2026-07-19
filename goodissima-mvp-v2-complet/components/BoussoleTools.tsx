"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { compassSpeechSections } from "@/lib/boussole";

type SpeechState = "idle" | "speaking" | "unavailable";

export function BoussoleTools() {
  const [speechState, setSpeechState] = useState<SpeechState>("idle");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const speechRun = useRef(0);

  useEffect(() => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) setSpeechState("unavailable");
    return () => {
      speechRun.current += 1;
      window.speechSynthesis?.cancel();
    };
  }, []);

  function stopSpeech() {
    speechRun.current += 1;
    window.speechSynthesis?.cancel();
    setSpeechState("idle");
  }

  function startSpeech() {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setSpeechState("unavailable");
      return;
    }

    window.speechSynthesis.cancel();
    const run = speechRun.current + 1;
    speechRun.current = run;
    const sections = compassSpeechSections();
    setSpeechState("speaking");

    const speakSection = (index: number) => {
      if (speechRun.current !== run) return;
      if (index >= sections.length) {
        setSpeechState("idle");
        return;
      }
      const utterance = new SpeechSynthesisUtterance(sections[index]);
      utterance.lang = "fr-FR";
      utterance.rate = 0.95;
      utterance.onend = () => speakSection(index + 1);
      utterance.onerror = () => {
        if (speechRun.current === run) setSpeechState("idle");
      };
      window.speechSynthesis.speak(utterance);
    };

    speakSection(0);
  }

  async function askCompass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = question.trim();
    if (!cleaned) return;
    setAsking(true);
    setAnswer("");
    try {
      const response = await fetch("/api/boussole/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: cleaned }),
      });
      const body = await response.json().catch(() => ({})) as { answer?: unknown; error?: unknown };
      if (!response.ok) {
        setAnswer(typeof body.error === "string" ? body.error : "Assistance IA indisponible dans cet environnement.");
        return;
      }
      setAnswer(typeof body.answer === "string" ? body.answer : "La Boussole ne sait pas répondre à cette question.");
    } catch {
      setAnswer("Assistance IA indisponible dans cet environnement.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <section className="mt-6 grid gap-4 lg:grid-cols-2" aria-label="Outils de la Boussole">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">Lecture vocale</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">La lecture utilise uniquement la voix de votre navigateur. Aucun micro, enregistrement ou service audio externe n’est utilisé.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={startSpeech} disabled={speechState === "speaking" || speechState === "unavailable"} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Écouter</button>
          <button type="button" onClick={stopSpeech} disabled={speechState !== "speaking"} className="rounded-lg border px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">Arrêter</button>
        </div>
        <p className="mt-3 text-sm text-slate-600" role="status">{speechState === "unavailable" ? "Lecture vocale non disponible dans ce navigateur." : speechState === "speaking" ? "Lecture en cours." : "Lecture arrêtée."}</p>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">Demander à la Boussole</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">Posez uniquement une question sur les menus et la navigation. N’indiquez aucune donnée personnelle ou sensible.</p>
        <form onSubmit={askCompass} className="mt-4">
          <label className="text-sm font-bold text-slate-900" htmlFor="boussole-question">Votre question</label>
          <textarea id="boussole-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} rows={3} placeholder="Quelle différence entre Workspace et Portfolio ?" className="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-cyan-600" />
          <button type="submit" disabled={asking || !question.trim()} className="mt-3 rounded-lg bg-[#247f88] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{asking ? "Question en cours…" : "Demander"}</button>
        </form>
        {answer ? <div className="mt-4 rounded-xl bg-cyan-50 p-4 text-sm leading-relaxed text-cyan-950" role="status"><p className="font-bold">Réponse</p><p className="mt-1">{answer}</p></div> : null}
        <p className="mt-3 text-xs text-slate-500">Aucune question ne déclenche d’action. La réponse est une aide pédagogique à valider humainement.</p>
      </div>
    </section>
  );
}
