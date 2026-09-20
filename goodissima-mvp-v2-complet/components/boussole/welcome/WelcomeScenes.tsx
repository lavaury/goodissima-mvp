"use client";

import { useId, useState } from "react";
import type { WelcomeEntry, WelcomeEntryKey } from "@/lib/boussole/welcome-contracts";
import { welcomeEntries, welcomeGeneralContent } from "@/lib/boussole/welcome-content";
import styles from "./welcome-scenes.module.css";

export type WelcomeAnimationState = "playing" | "paused";
type SceneProps = { animationState: WelcomeAnimationState; reducedMotion: boolean; runId: number };
const label = "Illustration pédagogique — aucune donnée enregistrée";

function SceneFrame({ children, targetId, text, shortDescription, animationState, reducedMotion, runId, showDetails = true }: SceneProps & { children: React.ReactNode; targetId?: string; text: string; shortDescription: string; showDetails?: boolean }) {
  const generatedId = useId();
  const shortDescriptionId = `${targetId ?? "welcome-scene"}-${generatedId}-summary`;
  return <figure key={runId} aria-describedby={shortDescriptionId} data-boussole-id={targetId} data-animation-state={animationState} data-reduced-motion={reducedMotion} className={styles.scene}><figcaption className="text-sm font-bold uppercase tracking-wide text-slate-600">{label}</figcaption><div aria-hidden="true" className="mt-5">{children}</div>{showDetails ? <p id={shortDescriptionId} className="mt-5 text-base font-semibold leading-relaxed text-slate-800">{shortDescription}</p> : <><p className="mt-5 text-base font-semibold leading-relaxed text-slate-800">{shortDescription}</p><p id={shortDescriptionId} className="sr-only">{text}</p></>}{showDetails ? <details className="mt-3 border-t border-slate-200 pt-2"><summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-cyan-950 outline-none focus-visible:ring-2 focus-visible:ring-cyan-700">Lire la description de l’illustration</summary><p className="mt-2 text-sm leading-relaxed text-slate-700"><span className="font-bold">Équivalent textuel complet : </span>{text}</p></details> : null}</figure>;
}

type WelcomeFlowIconName = "form" | "link" | "responses" | "human" | "write" | "review" | "publish" | "goal" | "steps" | "people" | "shield" | "activity" | "overview" | "items";

const entryFlowIcons: Record<WelcomeEntryKey, readonly [WelcomeFlowIconName, WelcomeFlowIconName, WelcomeFlowIconName, WelcomeFlowIconName]> = {
  SIMPLE_LINK: ["form", "link", "responses", "human"],
  OPPORTUNITY: ["write", "review", "publish", "responses"],
  GOVERNED_JOURNEY: ["goal", "steps", "people", "shield"],
  EXISTING_ACTIVITY: ["activity", "overview", "items", "human"],
};

function WelcomeFlowIcon({ entryKey, stepIndex }: { entryKey: WelcomeEntryKey; stepIndex: number }) {
  const icon = entryFlowIcons[entryKey][stepIndex];
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {icon === "form" ? <><path d="M6 3.5h12v17H6z" /><path d="M9 8h6M9 12h6M9 16h4" /></> : null}
    {icon === "link" ? <><path d="M9.5 14.5 14.5 9.5" /><path d="M7.5 17.5H6a3.5 3.5 0 0 1 0-7h3M16.5 6.5H18a3.5 3.5 0 0 1 0 7h-3" /></> : null}
    {icon === "responses" ? <><path d="M4 5h11v9H9l-4 3v-3H4z" /><path d="M10 18h6l3 2v-8h-2M7 8h5M7 11h3" /></> : null}
    {icon === "human" ? <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.7-3.1 2.5-4.6 5.5-4.6 1.2 0 2.2.2 3 .7" /><path d="m14 17 2 2 4-5" /></> : null}
    {icon === "write" ? <><path d="M5 4h10v16H5z" /><path d="m10 15 1-3 6.5-6.5 2 2L13 14zM8 8h4" /></> : null}
    {icon === "review" ? <><circle cx="11" cy="11" r="6" /><path d="m15.5 15.5 4 4M8.5 11l1.5 1.5 3-3" /></> : null}
    {icon === "publish" ? <><path d="M12 16V4M8 8l4-4 4 4" /><path d="M5 13v7h14v-7" /></> : null}
    {icon === "goal" ? <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="m12 12 7-7M16 5h3v3" /></> : null}
    {icon === "steps" ? <><path d="M9 6h10M9 12h10M9 18h10" /><circle cx="5" cy="6" r="1" /><circle cx="5" cy="12" r="1" /><circle cx="5" cy="18" r="1" /></> : null}
    {icon === "people" ? <><circle cx="8" cy="9" r="3" /><circle cx="16.5" cy="10" r="2.5" /><path d="M2.5 20c.6-3.5 2.4-5.3 5.5-5.3s4.9 1.8 5.5 5.3M14 15.5c3.7-.8 6 .7 6.8 4.5" /></> : null}
    {icon === "shield" ? <><path d="M12 3 19 6v5c0 4.5-2.4 7.6-7 10-4.6-2.4-7-5.5-7-10V6z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></> : null}
    {icon === "activity" ? <><path d="M4 6h6l2 2h8v11H4z" /><path d="M8 14h2l1.5-3 2 6 1.5-3h2" /></> : null}
    {icon === "overview" ? <><path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" /></> : null}
    {icon === "items" ? <><path d="M9 6h11M9 12h11M9 18h11" /><path d="m4 6 1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></> : null}
  </svg>;
}

export function WelcomeEntryBanner({ entryKey }: { entryKey: WelcomeEntryKey }) {
  return <div className={styles.entryBanner} data-entry-key={entryKey} aria-hidden="true">{entryFlowIcons[entryKey].map((icon, index) => <span key={`${icon}-${index}`}><WelcomeFlowIcon entryKey={entryKey} stepIndex={index} /></span>)}</div>;
}

export function WelcomeEntryFlow({ entry, compact = false }: { entry: (typeof welcomeEntries)[number]; compact?: boolean }) {
  return <ol className={`${styles.visualFlow} ${compact ? styles.visualFlowCompact : ""}`}>{entry.compactFlow.map((step, index) => <li key={step} className={index === 3 ? styles.humanFlowStep : ""}><span className={styles.flowSymbol}><WelcomeFlowIcon entryKey={entry.key} stepIndex={index} /></span><span>{step}</span>{index < 3 ? <span className={styles.flowConnector} aria-hidden="true"><span className="lg:hidden">↓</span><span className="hidden lg:inline">→</span></span> : null}</li>)}</ol>;
}

export function WelcomeSituationScene(props: SceneProps) {
  const categories = ["Échanges", "Informations", "Documents", "Décisions"];
  return <SceneFrame {...props} targetId="welcome-situation-illustration" shortDescription="Tout reste distinct, mais devient plus simple à suivre." text={`${welcomeGeneralContent.situation.join(" ")} Goodissima fournit un cadre commun sans remplacer les décisions humaines.`}><div className={styles.situation}><div className={styles.situationInitial}><p className={styles.sceneStageLabel}>Éléments dispersés</p><div className="grid gap-3 sm:grid-cols-2">{categories.map((item, index) => <div key={item} className={`${styles.card} ${styles.scatteredCard} ${styles.animatedItem}`} style={{ "--scene-delay": `${index * 140}ms` } as React.CSSProperties}>{item}</div>)}</div></div><div aria-hidden="true" className={`${styles.flow} ${styles.animatedItem}`} style={{ "--scene-delay": "500ms" } as React.CSSProperties}><span className="sm:hidden">↓</span><span className="hidden sm:inline">→</span></div><div className={`${styles.goodissimaFrame} ${styles.animatedItem}`} style={{ "--scene-delay": "620ms" } as React.CSSProperties}><p className={styles.sceneStageLabel}>Cadre commun Goodissima</p><div className="grid gap-3 sm:grid-cols-2">{categories.map((item) => <div key={item} className={styles.card}>{item}</div>)}</div></div></div></SceneFrame>;
}

export function WelcomePrincipleScene(props: SceneProps) {
  const [humanDecision, setHumanDecision] = useState(false);
  const chain = ["Une intention", "Des réponses recueillies", "Des rapprochements possibles"];
  return <div><SceneFrame {...props} targetId="welcome-principle-illustration" shortDescription="Goodissima prépare des possibilités ; vous décidez toujours de la suite." text={`${welcomeGeneralContent.principle} Les rapprochements peuvent être suggérés ; la suite reste une décision humaine.`}><div className="grid gap-3 sm:grid-cols-3">{chain.map((item, index) => <div key={item} className={`${styles.card} ${styles.animatedItem}`} style={{ "--scene-delay": `${index * 180}ms` } as React.CSSProperties}>{item}</div>)}</div><div className={`${styles.threshold} ${styles.animatedItem} mt-5 text-center`} style={{ "--scene-delay": "620ms" } as React.CSSProperties}><p className="font-bold text-amber-950">Seuil : décision humaine</p><p className="mt-2 text-sm text-amber-900">Le schéma s’arrête ici jusqu’à votre choix pédagogique.</p></div>{humanDecision ? <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className={styles.card}>Activité organisée</div><div className={styles.card}>Parcours</div><div className={styles.card}>Pilotage partagé</div></div> : null}</SceneFrame><button type="button" aria-pressed={humanDecision} onClick={() => setHumanDecision((value) => !value)} className="mt-4 min-h-11 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-950 focus-visible:ring-2 focus-visible:ring-amber-600">{humanDecision ? "Revenir avant la décision" : "Je décide de poursuivre"}</button><p className="mt-2 text-sm text-slate-600">Interaction illustrative uniquement : aucune donnée, relation ou navigation n’est créée.</p></div>;
}

export function WelcomeEntryScene({ selectedKey, ...props }: SceneProps & { selectedKey: WelcomeEntryKey | null }) {
  return <SceneFrame {...props} showDetails={false} shortDescription="Les quatre portes présentent chacune un chemin en quatre étapes, terminé par une décision humaine." text={welcomeEntries.map((entry) => `${entry.title} : ${entry.compactFlow.join(", ")}.`).join(" ")}><div className={styles.entrySceneGrid}>{welcomeEntries.map((entry, index) => <div key={entry.key} data-entry-key={entry.key} className={`${styles.entryFlowCard} ${styles.animatedItem} ${selectedKey && selectedKey !== entry.key ? styles.secondary : ""} ${selectedKey === entry.key ? styles.selected : ""}`} style={{ "--scene-delay": `${index * 120}ms` } as React.CSSProperties}><WelcomeEntryBanner entryKey={entry.key} /><p className={styles.entryFlowTitle}>{entry.title}</p><WelcomeEntryFlow entry={entry} compact /></div>)}</div></SceneFrame>;
}

export function WelcomeHandoffScene({ entry, ...props }: SceneProps & { entry: WelcomeEntry }) {
  return <SceneFrame {...props} shortDescription="La vraie page ne s’ouvre qu’après votre confirmation." text={`${entry.title} conduit vers une vraie page uniquement après un clic humain. ${welcomeGeneralContent.completion.contextualHandoff}`}><div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]"><div className={`${styles.card} ${styles.animatedItem}`}>{entry.title}</div><div className={`${styles.animatedItem} text-center text-cyan-800`} style={{ "--scene-delay": "220ms" } as React.CSSProperties}>→</div><div className={`${styles.card} ${styles.animatedItem}`} style={{ "--scene-delay": "420ms" } as React.CSSProperties}><span className="block text-sm text-slate-600">Page réelle</span>{entry.description}<span className="mt-2 block text-cyan-800">Boussole disponible</span></div></div><p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{entry.humanControlNotice}</p></SceneFrame>;
}
