"use client";

import { useId, useState } from "react";
import type { WelcomeEntry, WelcomeEntryKey } from "@/lib/boussole/welcome-contracts";
import { welcomeEntries, welcomeGeneralContent } from "@/lib/boussole/welcome-content";
import styles from "./welcome-scenes.module.css";

export type WelcomeAnimationState = "playing" | "paused";
type SceneProps = { animationState: WelcomeAnimationState; reducedMotion: boolean; runId: number };
const label = "Illustration pédagogique — aucune donnée enregistrée";

function SceneFrame({ children, targetId, text, shortDescription, animationState, reducedMotion, runId }: SceneProps & { children: React.ReactNode; targetId?: string; text: string; shortDescription: string }) {
  const generatedId = useId();
  const shortDescriptionId = `${targetId ?? "welcome-scene"}-${generatedId}-summary`;
  return <figure key={runId} aria-describedby={shortDescriptionId} data-boussole-id={targetId} data-animation-state={animationState} data-reduced-motion={reducedMotion} className={styles.scene}><figcaption className="text-sm font-bold uppercase tracking-wide text-slate-600">{label}</figcaption><div aria-hidden="true" className="mt-5">{children}</div><p id={shortDescriptionId} className="mt-5 text-base font-semibold leading-relaxed text-slate-800">{shortDescription}</p><details className="mt-3 border-t border-slate-200 pt-2"><summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-cyan-950 outline-none focus-visible:ring-2 focus-visible:ring-cyan-700">Lire la description de l’illustration</summary><p className="mt-2 text-sm leading-relaxed text-slate-700"><span className="font-bold">Équivalent textuel complet : </span>{text}</p></details></figure>;
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
  return <SceneFrame {...props} shortDescription="Les quatre portes présentent chacune un chemin en quatre étapes, terminé par une décision humaine." text={welcomeEntries.map((entry) => `${entry.title} : ${entry.compactFlow.join(", ")}.`).join(" ")}><div className="grid gap-4 sm:grid-cols-2">{welcomeEntries.map((entry, index) => <div key={entry.key} className={`${styles.entryFlowCard} ${styles.animatedItem} ${selectedKey && selectedKey !== entry.key ? styles.secondary : ""} ${selectedKey === entry.key ? styles.selected : ""}`} style={{ "--scene-delay": `${index * 120}ms` } as React.CSSProperties}><p className={styles.entryFlowTitle}>{entry.title}</p><ol className={styles.compactFlow}>{entry.compactFlow.map((step, stepIndex) => <li key={step}><span aria-hidden="true">{stepIndex + 1}</span>{step}</li>)}</ol></div>)}</div></SceneFrame>;
}

export function WelcomeHandoffScene({ entry, ...props }: SceneProps & { entry: WelcomeEntry }) {
  return <SceneFrame {...props} shortDescription="La vraie page ne s’ouvre qu’après votre confirmation." text={`${entry.title} conduit vers une vraie page uniquement après un clic humain. ${welcomeGeneralContent.completion.contextualHandoff}`}><div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]"><div className={`${styles.card} ${styles.animatedItem}`}>{entry.title}</div><div className={`${styles.animatedItem} text-center text-cyan-800`} style={{ "--scene-delay": "220ms" } as React.CSSProperties}>→</div><div className={`${styles.card} ${styles.animatedItem}`} style={{ "--scene-delay": "420ms" } as React.CSSProperties}><span className="block text-sm text-slate-600">Page réelle</span>{entry.description}<span className="mt-2 block text-cyan-800">Boussole disponible</span></div></div><p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{entry.humanControlNotice}</p></SceneFrame>;
}
