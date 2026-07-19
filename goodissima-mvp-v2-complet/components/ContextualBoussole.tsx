"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getCompassContext } from "@/lib/boussole-context";
import { dashboardSequences } from "@/lib/boussole-dashboard";
import { simpleLinkSequences } from "@/lib/boussole-simple-link";
import { opportunitySequences } from "@/lib/boussole-opportunities";
import { governanceSequences } from "@/lib/boussole-governance";
import { portfolioSequences } from "@/lib/boussole-portfolios";
import { newGovernedJourneySequences } from "@/lib/boussole-new-governed-journey";
import { governedJourneySequences } from "@/lib/boussole-governed-journey";
import { dossierSequences } from "@/lib/boussole-dossiers";
import { boussoleGlossary, getGlossaryTerm, searchGlossary, type GlossaryTerm } from "@/lib/boussole/glossary";
import { resolveNextTargetInSequence } from "@/lib/boussole/target-resolver";

const unavailableMessage = "Cette action n’est pas disponible sur cette page ou dans cet état.";
const positionStorageKey = "goodissima:boussole-position-v1";
const viewportMargin = 8;
const experienceStorageKey = "goodissima:boussole-experience-v1";
const progressStorageKey = "goodissima:boussole-progress-v1";
const governedJourneyVisitedKey = "goodissima:boussole-governed-journey-visited-v1";
type View = "guide" | "glossary" | "experience";
type Experience = { level: "discovery" | "guided" | "autonomous"; speech: "automatic" | "manual"; text: "short" | "detailed"; rate: number; reducedMotion: boolean; resume: boolean; goals: string[] };
const defaultExperience: Experience = { level: "guided", speech: "manual", text: "short", rate: 0.95, reducedMotion: false, resume: true, goals: [] };

type PanelPosition = { x: number; y: number };
type DragState = { pointerId: number; startX: number; startY: number; origin: PanelPosition; rect: DOMRect };

export function ContextualBoussole() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const context = useMemo(() => getCompassContext(pathname, searchParams.toString()), [pathname, searchParams]);
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [compactSide, setCompactSide] = useState<"left" | "right">("left");
  const [stepIndex, setStepIndex] = useState(0);
  const [guidance, setGuidance] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [domRevision, setDomRevision] = useState(0);
  const [view, setView] = useState<View>("guide");
  const [sequenceId, setSequenceId] = useState("repères");
  const [glossaryQuery, setGlossaryQuery] = useState("");
  const [selectedGlossaryTermId, setSelectedGlossaryTermId] = useState<string | null>(null);
  const [experience, setExperience] = useState<Experience>(defaultExperience);
  const [experienceHelpOpen, setExperienceHelpOpen] = useState(false);
  const [resetExperiencePending, setResetExperiencePending] = useState(false);
  const highlighted = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const speechRun = useRef(0);
  const missingTargetWarnings = useRef(new Set<string>());
  const visibleSteps = useMemo(() => {
    if (!context || typeof document === "undefined") return context?.steps ?? [];
    return context.steps.filter((candidate) => {
      if (!candidate.targetId) return true;
      const available = Array.from(document.querySelectorAll(`[data-boussole-id="${candidate.targetId}"]`)).some((element) => {
        if (!(element instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(element);
        const stateMatches = !candidate.targetStates?.length || candidate.targetStates.includes(element.dataset.boussoleState ?? "");
        return stateMatches && element.getClientRects().length > 0 && style.display !== "none" && style.visibility !== "hidden" && element.getAttribute("aria-hidden") !== "true";
      });
      if (!available && candidate.targetId === "simple-link-final-check-section" && process.env.NODE_ENV !== "production" && !missingTargetWarnings.current.has(candidate.targetId)) {
        missingTargetWarnings.current.add(candidate.targetId);
        console.warn(`[Boussole] Cible introuvable : ${candidate.targetId}`);
      }
      return available;
    });
  }, [context, domRevision]);
  const availableSequences = context?.id === "dashboard" ? dashboardSequences : context?.id === "simple-link" ? simpleLinkSequences : context?.id === "opportunities" || context?.id === "archives" ? opportunitySequences : context?.id === "governance" ? governanceSequences : context?.id === "portfolio" ? portfolioSequences : context?.id === "new-governed-journey" ? newGovernedJourneySequences : context?.id === "governed-journey" ? governedJourneySequences : context?.id === "dossiers" ? dossierSequences : [];
  const sequence = sequenceId === "all" ? null : availableSequences.find((item) => item.id === sequenceId);
  const selectedSteps = sequence ? visibleSteps.filter((item) => sequence.steps.some((candidate) => candidate.id === item.id)) : visibleSteps;
  const steps = sequence ? selectedSteps : visibleSteps;
  const step = steps[stepIndex];
  const targetState = useMemo(() => {
    if (!step?.targetId || typeof document === "undefined") return "";
    const target = document.querySelector(`[data-boussole-id="${step.targetId}"]`);
    return target instanceof HTMLElement ? target.dataset.boussoleState ?? "" : "";
  }, [step, domRevision]);
  const configuredBody = experience.text === "detailed" ? step?.detailedBody ?? step?.body : step?.body;
  const stepBody = step?.targetId === "enable-link-matching" && targetState === "enabled"
    ? "Ce lien est candidat au matching. Aucun contact ne sera créé automatiquement."
    : configuredBody ?? "";

  function clearHighlight() {
    highlighted.current?.classList.remove("goodissima-boussole-highlight");
    highlighted.current = null;
  }

  function stopSpeech() {
    speechRun.current += 1;
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }

  useEffect(() => {
    setStepIndex(0);
    setGuidance("");
    setAnswer("");
    setCompact(false);
    clearHighlight();
    stopSpeech();
    setSequenceId(context?.id === "dashboard" ? "repères" : context?.id === "simple-link" ? "start" : context?.id === "opportunities" || context?.id === "archives" ? "discover-opportunities" : context?.id === "governance" ? "understand-governance" : context?.id === "portfolio" ? "portfolio-landmarks" : context?.id === "new-governed-journey" ? "choose-governed-format" : context?.id === "governed-journey" ? "discover-governed-journey" : context?.id === "dossiers" ? "understand-secure-case" : "all");
  }, [context?.id]);

  function openBoussole() {
    if (context?.id === "governed-journey") {
      let alreadyVisited = false;
      try { alreadyVisited = window.localStorage.getItem(governedJourneyVisitedKey) === "yes"; } catch { /* Repère local facultatif. */ }
      const pendingInterventions = document.querySelector('[data-boussole-id="governed-journey-human-interventions"][data-boussole-state="pending"]');
      setSequenceId(alreadyVisited && pendingInterventions ? "human-interventions" : "discover-governed-journey");
      setStepIndex(0);
      try { window.localStorage.setItem(governedJourneyVisitedKey, "yes"); } catch { /* Repère local facultatif. */ }
    }
    setOpen(true);
  }

  useEffect(() => {
    const observer = new MutationObserver(() => setDomRevision((current) => current + 1));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-boussole-id", "data-boussole-state", "disabled", "hidden", "open"] });
    setDomRevision((current) => current + 1);
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    if (stepIndex >= steps.length) setStepIndex(0);
  }, [stepIndex, steps.length]);

  useEffect(() => () => {
    clearHighlight();
    speechRun.current += 1;
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(positionStorageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<PanelPosition>;
      if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) setPanelPosition({ x: parsed.x!, y: parsed.y! });
    } catch {
      // Une position illisible ne doit jamais empêcher l'ouverture de la Boussole.
    }
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(experienceStorageKey);
      if (saved) setExperience({ ...defaultExperience, ...JSON.parse(saved) });
      const progress = JSON.parse(window.localStorage.getItem(`${progressStorageKey}:${context?.id}`) ?? "{}") as { sequenceId?: string; stepIndex?: number };
      if (progress.sequenceId) setSequenceId(progress.sequenceId === "discover-builder" ? "start" : progress.sequenceId);
      if (Number.isInteger(progress.stepIndex)) setStepIndex(progress.stepIndex!);
    } catch { /* Préférences locales facultatives. */ }
  }, [context?.id]);

  useEffect(() => { try { window.localStorage.setItem(experienceStorageKey, JSON.stringify(experience)); } catch { /* Stockage facultatif. */ } }, [experience]);
  useEffect(() => { if (experience.resume && (context?.id === "dashboard" || context?.id === "simple-link")) try { window.localStorage.setItem(`${progressStorageKey}:${context.id}`, JSON.stringify({ sequenceId, stepIndex })); } catch { /* Stockage facultatif. */ } }, [context?.id, experience.resume, sequenceId, stepIndex]);

  useEffect(() => {
    if (!open) return;
    const keepPanelVisible = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      let adjustX = 0;
      let adjustY = 0;
      if (rect.left < viewportMargin) adjustX = viewportMargin - rect.left;
      else if (rect.right > window.innerWidth - viewportMargin) adjustX = window.innerWidth - viewportMargin - rect.right;
      if (rect.top < viewportMargin) adjustY = viewportMargin - rect.top;
      else if (rect.bottom > window.innerHeight - viewportMargin) adjustY = window.innerHeight - viewportMargin - rect.bottom;
      if (adjustX || adjustY) setPanelPosition((current) => ({ x: current.x + adjustX, y: current.y + adjustY }));
    };
    const frame = window.requestAnimationFrame(keepPanelVisible);
    window.addEventListener("resize", keepPanelVisible);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", keepPanelVisible);
    };
  }, [open]);

  useEffect(() => () => {
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    if (open && view === "guide" && experience.speech === "automatic") speak();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex, view, experience.speech]);

  if (!context || !step) return null;

  function showStep() {
    if (!context || !step) return;
    clearHighlight();
    if (!step?.targetId) {
      setGuidance("Cette étape est informative : aucune action n’est déclenchée par la Boussole.");
      return;
    }
    if (step.targetId === "governed-journey-educational-preview") window.dispatchEvent(new Event("goodissima:open-governed-journey-preview"));
    const candidates = Array.from(document.querySelectorAll(`[data-boussole-id="${step.targetId}"]`));
    const target = candidates.find((candidate) => !candidate.closest('[data-boussole-navigation="global"]')) ?? candidates[0];
    if (!(target instanceof HTMLElement)) {
      if (process.env.NODE_ENV !== "production") console.warn(`[Boussole] Cible introuvable : ${step.targetId}`);
      const alternative = resolveNextTargetInSequence(steps, stepIndex, (targetId) => Boolean(document.querySelector(`[data-boussole-id="${targetId}"]`)));
      setGuidance(alternative ? `${unavailableMessage} Étape suivante disponible : ${alternative.title}.` : "Cette zone n’est pas disponible dans l’état actuel.");
      return;
    }
    target.classList.add("goodissima-boussole-highlight");
    highlighted.current = target;
    const targetRect = target.getBoundingClientRect();
    setCompactSide(targetRect.left + targetRect.width / 2 < window.innerWidth / 2 ? "right" : "left");
    target.scrollIntoView({ behavior: experience.reducedMotion ? "auto" : "smooth", block: "center", inline: "nearest" });
    const disabled = ("disabled" in target && Boolean((target as HTMLButtonElement).disabled)) || target.getAttribute("aria-disabled") === "true";
    setGuidance(disabled
      ? "La zone est visible mais indisponible dans cet état. Complétez d’abord les informations ou la confirmation demandée."
      : "La zone est entourée. Cliquez vous-même uniquement si vous souhaitez effectuer cette action.");
    setOpen(false);
    setCompact(true);
  }

  function nextStep() {
    if (!context) return;
    clearHighlight();
    setGuidance("");
    setStepIndex((current) => (current + 1) % steps.length);
  }

  function previousStep() {
    clearHighlight();
    setGuidance("");
    setStepIndex((current) => (current - 1 + steps.length) % steps.length);
  }

  function nextStepFromCompact() {
    nextStep();
    setCompact(false);
    setOpen(true);
  }

  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button, a, input, textarea, select, label")) return;
    const panel = panelRef.current;
    if (!panel) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: panelPosition, rect: panel.getBoundingClientRect() };
    document.body.style.userSelect = "none";
    setDragging(true);
  }

  function moveDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const minDx = viewportMargin - drag.rect.left;
    const maxDx = window.innerWidth - viewportMargin - drag.rect.right;
    const minDy = viewportMargin - drag.rect.top;
    const maxDy = window.innerHeight - viewportMargin - drag.rect.bottom;
    const dx = Math.min(Math.max(event.clientX - drag.startX, minDx), maxDx);
    const dy = Math.min(Math.max(event.clientY - drag.startY, minDy), maxDy);
    setPanelPosition({ x: drag.origin.x + dx, y: drag.origin.y + dy });
  }

  function finishDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    document.body.style.userSelect = "";
    setDragging(false);
    setPanelPosition((current) => {
      try { window.sessionStorage.setItem(positionStorageKey, JSON.stringify(current)); } catch { /* Stockage de session facultatif. */ }
      return current;
    });
  }

  function resetPanelPosition() {
    setPanelPosition({ x: 0, y: 0 });
    try { window.sessionStorage.removeItem(positionStorageKey); } catch { /* Stockage de session facultatif. */ }
  }

  function speak() {
    if (!context || !step) return;
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setGuidance("Lecture vocale non disponible dans ce navigateur.");
      return;
    }
    stopSpeech();
    const run = speechRun.current + 1;
    speechRun.current = run;
    const narration = step.animation?.narration ?? stepBody;
    const utterance = new SpeechSynthesisUtterance(`${context.pageName}. ${context.summary} Étape proposée : ${step.title}. ${narration} ${context.caution}`);
    utterance.lang = "fr-FR";
    utterance.rate = experience.rate;
    utterance.onend = () => { if (speechRun.current === run) setSpeaking(false); };
    utterance.onerror = () => { if (speechRun.current === run) setSpeaking(false); };
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  function chooseSequence(id: string) { clearHighlight(); setSequenceId(id); setStepIndex(0); setGuidance(""); }
  function updateExperience(patch: Partial<Experience>) { setExperience((current) => ({ ...current, ...patch })); }
  function resetExperiencePreferences() {
    setExperience(defaultExperience);
    setResetExperiencePending(false);
    try {
      window.localStorage.removeItem(experienceStorageKey);
      for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
        const key = window.localStorage.key(index);
        if (key?.startsWith(`${progressStorageKey}:`)) window.localStorage.removeItem(key);
      }
    } catch { /* Le stockage local facultatif ne doit pas bloquer la Boussole. */ }
  }
  function setExperienceLevel(level: Experience["level"]) {
    updateExperience(level === "discovery"
      ? { level, text: "detailed", speech: "automatic", rate: 0.9 }
      : level === "guided"
        ? { level, text: "detailed", speech: "manual", rate: 0.95 }
        : { level, text: "short", speech: "manual", rate: 1.05 });
  }

  function visibleGlossaryTarget(term: GlossaryTerm) {
    if (typeof document === "undefined") return null;
    for (const candidate of term.targets) {
      const target = Array.from(document.querySelectorAll(`[data-boussole-id="${candidate.dataBoussoleId}"]`)).find((element) => {
        if (!(element instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(element);
        return element.getClientRects().length > 0 && style.display !== "none" && style.visibility !== "hidden" && element.getAttribute("aria-hidden") !== "true";
      });
      if (target instanceof HTMLElement) return target;
    }
    return null;
  }

  function showGlossaryTarget(term: GlossaryTerm) {
    const target = visibleGlossaryTarget(term);
    if (!target) return;
    clearHighlight();
    target.classList.add("goodissima-boussole-highlight");
    highlighted.current = target;
    const rect = target.getBoundingClientRect();
    setCompactSide(rect.left + rect.width / 2 < window.innerWidth / 2 ? "right" : "left");
    target.scrollIntoView({ behavior: experience.reducedMotion ? "auto" : "smooth", block: "center", inline: "nearest" });
    setGuidance("La zone correspondant à la définition officielle est entourée. Aucune action n’a été déclenchée.");
    setOpen(false);
    setCompact(true);
  }

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context) return;
    const cleaned = question.trim();
    if (!cleaned) return;
    setAsking(true);
    setAnswer("");
    try {
      const response = await fetch("/api/boussole/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: cleaned, pageName: context.pageName }) });
      const body = await response.json().catch(() => ({})) as { answer?: unknown; error?: unknown };
      setAnswer(response.ok && typeof body.answer === "string" ? body.answer : typeof body.error === "string" ? body.error : "Assistance IA indisponible dans cet environnement.");
    } catch {
      setAnswer("Assistance IA indisponible dans cet environnement.");
    } finally {
      setAsking(false);
    }
  }

  return <>
    <style>{`.goodissima-boussole-highlight{outline:4px solid #21a6b3!important;outline-offset:5px!important;box-shadow:0 0 0 10px rgba(33,166,179,.16),0 18px 45px rgba(15,23,42,.18)!important;border-radius:14px!important;position:relative;z-index:39;transition:${experience.reducedMotion ? "none" : "outline-color 180ms ease,box-shadow 180ms ease"}}@media(prefers-reduced-motion:reduce){.goodissima-boussole-highlight{transition:none!important}}`}</style>
    {!compact ? <button type="button" onClick={openBoussole} className="fixed bottom-4 left-4 z-40 rounded-full border border-cyan-200 bg-white px-4 py-3 text-sm font-bold text-[#247f88] shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl sm:bottom-6 sm:left-6" aria-label={`Ouvrir la Boussole pour ${context.pageName}`}>{context.id === "governed-journey" ? "Découvrir ce parcours gouverné" : "Boussole"}</button> : null}
    {compact ? <aside className={`fixed bottom-4 z-40 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-cyan-200 bg-white p-3 shadow-xl sm:bottom-6 ${compactSide === "right" ? "right-4 sm:right-6" : "left-4 sm:left-6"}`} aria-label="Boussole réduite">
      <p className="text-xs font-bold uppercase tracking-wide text-[#247f88]">Boussole · zone visible</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900">{step.title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => { setCompact(false); setOpen(true); }} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Rouvrir la Boussole</button>
        <button type="button" onClick={nextStepFromCompact} className="rounded-lg border px-3 py-2 text-xs font-bold text-slate-700">Étape suivante</button>
      </div>
    </aside> : null}
    {open ? <div className="fixed inset-0 z-50 flex items-end bg-slate-950/30 p-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <section ref={panelRef} style={{ transform: `translate3d(${panelPosition.x}px, ${panelPosition.y}px, 0)` }} className="w-full max-w-xl overflow-hidden rounded-2xl border bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="boussole-title">
        <header onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag} className={`flex touch-none items-start justify-between gap-4 border-b px-5 py-4 ${dragging ? "cursor-grabbing" : "cursor-grab"}`}><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#247f88]">Boussole Goodissima · Déplacer</p><h2 id="boussole-title" className="mt-1 text-xl font-bold">{context.pageName}</h2><p className="mt-1 text-xs font-normal text-slate-500">Vous pouvez déplacer cette Boussole si elle masque une zone.</p></div><div className="flex items-center gap-1"><button type="button" onClick={resetPanelPosition} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100" aria-label="Recentrer le panneau Boussole">Recentrer</button><button type="button" onClick={() => { setOpen(false); setCompact(false); clearHighlight(); stopSpeech(); }} className="rounded-lg px-3 py-1 text-xl text-slate-500 hover:bg-slate-100" aria-label="Fermer la Boussole">×</button></div></header>
        <div className="max-h-[72vh] space-y-4 overflow-y-auto px-5 py-5">
          <nav className="flex rounded-xl bg-slate-100 p-1" aria-label="Vues Boussole">{([['guide','Guide'],['glossary','Glossaire'],['experience','Mon expérience']] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setView(id)} aria-current={view === id ? "page" : undefined} className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold ${view === id ? "bg-white shadow-sm" : "text-slate-600"}`}>{label}</button>)}</nav>
          {view === "guide" ? <>
          <div className="rounded-xl border bg-slate-50 p-4"><h3 className="font-bold">Où suis-je ?</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{context.summary}</p></div>
          {availableSequences.length ? <div className="rounded-xl border p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-bold">Choisir un micro-parcours</h3><button type="button" onClick={() => chooseSequence("all")} className={`rounded-lg border px-3 py-2 text-xs font-bold ${sequenceId === "all" ? "bg-slate-900 text-white" : "bg-white"}`}>Visite complète</button></div><p className="mt-2 text-sm leading-relaxed text-slate-600">Choisissez un micro-parcours, puis utilisez « Étape suivante » pour le découvrir pas à pas. « Montrer la zone » repère l’élément sans déclencher d’action.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{availableSequences.map((item) => { const available = visibleSteps.some((candidate) => item.steps.some((candidateStep) => candidateStep.id === candidate.id)); return <button key={item.id} type="button" disabled={!available} onClick={() => chooseSequence(item.id)} className={`rounded-lg border p-3 text-left text-xs disabled:opacity-40 ${sequenceId === item.id ? "border-cyan-500 bg-cyan-50" : "bg-white"}`}><strong className="block text-sm">{item.title}</strong><span className="mt-1 block text-slate-500">{available ? item.description : "Aucune cible visible dans l’état actuel."}</span></button>; })}</div></div> : null}
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#247f88]">Étape {stepIndex + 1} sur {steps.length}</p><h3 className="mt-1 font-bold">Pourquoi cette étape ?</h3><p className="mt-2 text-sm leading-relaxed text-slate-700"><strong>{step.title}.</strong> {stepBody}</p><p className="mt-3 text-xs font-bold uppercase tracking-wide text-[#247f88]">Que dois-je faire maintenant ?</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={showStep} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Montrer la zone</button><button type="button" onClick={previousStep} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700">Étape précédente</button><button type="button" onClick={nextStep} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700">Étape suivante</button><button type="button" onClick={() => { setOpen(false); setCompact(false); clearHighlight(); stopSpeech(); }} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700">Quitter</button></div>{guidance ? <p className="mt-3 text-sm font-medium text-cyan-950" role="status">{guidance}</p> : null}</div>
          <div className="rounded-xl border p-4"><h3 className="font-bold">Lecture vocale locale</h3><div className="mt-3 flex gap-2"><button type="button" onClick={speak} disabled={speaking} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50">Écouter</button><button type="button" onClick={stopSpeech} disabled={!speaking} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50">Arrêter</button></div></div>
          <form onSubmit={ask} className="rounded-xl border p-4"><label htmlFor="contextual-boussole-question" className="font-bold">Demander à la Boussole</label><p className="mt-1 text-xs text-slate-500">Navigation uniquement. N’indiquez aucune donnée personnelle ou sensible.</p><input id="contextual-boussole-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} placeholder="Où trouver les invitations ?" className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"/><button type="submit" disabled={asking || !question.trim()} className="mt-3 rounded-lg bg-[#247f88] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{asking ? "Question en cours…" : "Demander"}</button>{answer ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed" role="status">{answer}</p> : null}</form>
          <p className="rounded-xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-950"><strong>Prudence :</strong> {context.caution}</p>
          {step.glossaryTermIds?.length ? <div className="flex flex-wrap gap-2">{step.glossaryTermIds.map((termId) => { const term = getGlossaryTerm(termId); return term ? <button key={termId} type="button" onClick={() => { setSelectedGlossaryTermId(termId); setView("glossary"); }} className="rounded-full border border-cyan-300 bg-white px-2.5 py-1 text-xs font-semibold text-cyan-900">Définition : {term.label}</button> : null; })}</div> : null}
          </> : null}
          {view === "glossary" ? <GlossaryView query={glossaryQuery} onQueryChange={setGlossaryQuery} selectedId={selectedGlossaryTermId} onSelect={setSelectedGlossaryTermId} visibleTarget={visibleGlossaryTarget} onShow={showGlossaryTarget} /> : null}
          {view === "experience" ? <section className="space-y-4">
            <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
              <p className="text-sm leading-relaxed text-cyan-950">Ces préférences personnalisent uniquement l’accompagnement de Boussole. Elles ne modifient ni vos droits, ni vos données, ni les actions de Goodissima.</p>
              <button type="button" aria-expanded={experienceHelpOpen} aria-controls="boussole-experience-help" onClick={() => setExperienceHelpOpen((current) => !current)} className="mt-3 rounded-lg border border-cyan-300 bg-white px-3 py-2 text-xs font-bold text-cyan-950">{experienceHelpOpen ? "Fermer l’aide" : "Comprendre ces réglages"}</button>
              {experienceHelpOpen ? <div id="boussole-experience-help" className="mt-3 space-y-2 border-t border-cyan-200 pt-3 text-xs leading-relaxed text-slate-700">
                <p><strong>Découverte :</strong> Explications détaillées et parcours proposés.</p>
                <p><strong>Guidé :</strong> Accompagnement court sur les actions importantes.</p>
                <p><strong>Autonome :</strong> Boussole intervient principalement à votre demande.</p>
                <p><strong>Lecture vocale :</strong> Détermine si les étapes sont lues automatiquement ou manuellement.</p>
                <p><strong>Longueur des explications :</strong> Choisissez une version courte ou détaillée des textes.</p>
                <p><strong>Vitesse de lecture vocale :</strong> Règle la vitesse de la narration.</p>
                <p><strong>Réduire les animations :</strong> Limite les mouvements, zooms et transitions.</p>
                <p><strong>Reprendre ma progression :</strong> Permet de reprendre un parcours interrompu lorsqu’il reste pertinent.</p>
                <p><strong>Objectifs prioritaires :</strong> Ils influencent l’ordre des guides proposés, sans modifier les fonctions, droits ou workflows.</p>
              </div> : null}
            </div>
            <div><h3 className="font-bold">Niveau d’accompagnement <ExperienceInfo text="Choisissez la quantité d’accompagnement proposée par Boussole." /></h3><div className="mt-2 flex flex-wrap gap-2">{([['discovery','Découverte'],['guided','Guidé'],['autonomous','Autonome']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setExperienceLevel(value)} className={`rounded-lg border px-3 py-2 text-xs font-bold ${experience.level === value ? "bg-slate-900 text-white" : "bg-white"}`}>{label}</button>)}</div></div>
            <label className="block text-sm font-semibold">Lecture vocale <ExperienceInfo text="Choisissez une lecture automatique ou déclenchée avec le bouton Écouter." /><select value={experience.speech} onChange={(event) => updateExperience({ speech: event.target.value as Experience['speech'] })} className="mt-1 w-full rounded-lg border p-2 font-normal"><option value="manual">Manuelle</option><option value="automatic">Automatique</option></select></label>
            <label className="block text-sm font-semibold">Longueur des explications <ExperienceInfo text="La version détaillée fournit davantage de contexte pour chaque étape." /><select value={experience.text} onChange={(event) => updateExperience({ text: event.target.value as Experience['text'] })} className="mt-1 w-full rounded-lg border p-2 font-normal"><option value="short">Courte</option><option value="detailed">Détaillée</option></select></label>
            <label className="block text-sm font-semibold">Vitesse de lecture vocale : {experience.rate.toFixed(2)}× <ExperienceInfo text="Ce réglage agit uniquement sur la vitesse de la narration locale." /><input aria-label="Vitesse de lecture vocale" type="range" min="0.7" max="1.3" step="0.05" value={experience.rate} onChange={(event) => updateExperience({ rate: Number(event.target.value) })} className="mt-2 w-full"/></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={experience.reducedMotion} onChange={(event) => updateExperience({ reducedMotion: event.target.checked })}/> Réduire les animations <ExperienceInfo text="Limite les mouvements, zooms et transitions." /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={experience.resume} onChange={(event) => updateExperience({ resume: event.target.checked })}/> Reprendre ma progression <ExperienceInfo text="Mémorise localement l’étape du parcours pour pouvoir la reprendre." /></label>
            <fieldset><legend className="font-bold">Objectifs prioritaires <ExperienceInfo text="Ces objectifs personnalisent l’ordre des guides sans modifier les fonctions ou vos droits." /></legend>{["Créer et partager un lien", "Comprendre le matching", "Gérer les accès"].map((goal) => <label key={goal} className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={experience.goals.includes(goal)} onChange={(event) => updateExperience({ goals: event.target.checked ? [...experience.goals, goal] : experience.goals.filter((item) => item !== goal) })}/>{goal}</label>)}</fieldset>
            <div className="rounded-xl border border-slate-200 p-3">{resetExperiencePending ? <div role="alert"><p className="text-sm font-semibold text-slate-800">Confirmer la réinitialisation des seules préférences Boussole ?</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={resetExperiencePreferences} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white">Confirmer la réinitialisation</button><button type="button" onClick={() => setResetExperiencePending(false)} className="rounded-lg border px-3 py-2 text-xs font-bold">Annuler</button></div></div> : <button type="button" onClick={() => setResetExperiencePending(true)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Réinitialiser mes préférences</button>}</div>
            <p className="rounded-xl bg-cyan-50 p-3 text-xs text-cyan-950">Ces préférences restent dans ce navigateur et ne modifient aucune donnée métier.</p>
          </section> : null}
        </div>
      </section>
    </div> : null}
  </>;
}

function ExperienceInfo({ text }: { text: string }) {
  return <span tabIndex={0} role="img" aria-label={`Information : ${text}`} title={text} className="ml-1 inline-flex cursor-help rounded-full text-cyan-800 outline-none focus:ring-2 focus:ring-cyan-500">ⓘ</span>;
}

function GlossaryView({ query, onQueryChange, selectedId, onSelect, visibleTarget, onShow }: {
  query: string;
  onQueryChange: (value: string) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  visibleTarget: (term: GlossaryTerm) => HTMLElement | null;
  onShow: (term: GlossaryTerm) => void;
}) {
  const results = searchGlossary(query);
  const selected = selectedId ? getGlossaryTerm(selectedId) : null;
  const targetExists = selected ? Boolean(visibleTarget(selected)) : false;
  const related = selected?.relatedTermIds.map(getGlossaryTerm).filter((term): term is GlossaryTerm => Boolean(term)) ?? [];
  const routes = selected ? [...new Set(selected.targets.flatMap((target) => target.routes))] : [];

  return <section>
    <label htmlFor="boussole-glossary-search" className="font-bold">Rechercher dans le glossaire global</label>
    <input id="boussole-glossary-search" type="search" value={query} onChange={(event) => { onQueryChange(event.target.value); onSelect(null); }} placeholder="Matching, qui peut répondre, Workspace…" className="mt-2 w-full rounded-xl border px-3 py-2 text-sm" />
    {selected ? <article className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
      <button type="button" onClick={() => onSelect(null)} className="text-xs font-bold text-cyan-900">← Résultats</button>
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-cyan-800">{selected.category}</p>
      <h3 className="mt-1 text-lg font-bold">{selected.label}</h3>
      <p className="mt-2 text-sm text-slate-700">{selected.definition}</p>
      {selected.example ? <p className="mt-3 text-sm text-slate-600"><strong>Exemple :</strong> {selected.example}</p> : null}
      {related.length ? <div className="mt-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Termes associés</p><div className="mt-2 flex flex-wrap gap-2">{related.map((term) => <button key={term.id} type="button" onClick={() => onSelect(term.id)} className="rounded-full border bg-white px-2.5 py-1 text-xs font-semibold">{term.label}</button>)}</div></div> : null}
      {targetExists ? <button type="button" onClick={() => onShow(selected)} className="mt-4 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Montrer sur cette page</button> : <details className="mt-4 rounded-lg border bg-white p-3"><summary className="cursor-pointer text-xs font-bold">Voir les pages concernées</summary><ul className="mt-2 space-y-1 text-xs text-slate-600">{routes.map((route) => <li key={route}>{route}</li>)}</ul></details>}
    </article> : <div className="mt-4 space-y-2">{results.length ? results.map((term) => <button key={term.id} type="button" onClick={() => onSelect(term.id)} className="block w-full rounded-xl border p-3 text-left hover:border-cyan-300"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">{term.category}</span><strong className="mt-1 block">{term.label}</strong><span className="mt-1 block text-sm text-slate-600">{term.definition}</span></button>) : <p className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-600" role="status">Aucun terme ne correspond à votre recherche.</p>}</div>}
  </section>;
}
