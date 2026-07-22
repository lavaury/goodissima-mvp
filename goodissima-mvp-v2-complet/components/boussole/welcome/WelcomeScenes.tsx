"use client";

import { useState } from "react";
import type { WelcomeEntry, WelcomeEntryKey } from "@/lib/boussole/welcome-contracts";
import { welcomeEntries, welcomeGeneralContent } from "@/lib/boussole/welcome-content";
import styles from "./welcome-scenes.module.css";

export type WelcomeAnimationState = "playing" | "paused";
type SceneProps = { animationState: WelcomeAnimationState; reducedMotion: boolean; runId: number };
const label = "Illustration pédagogique — aucune donnée enregistrée";

function SceneFrame({ children, targetId, text, animationState, reducedMotion, runId }: SceneProps & { children: React.ReactNode; targetId?: string; text: string }) {
  return <figure key={runId} data-boussole-id={targetId} data-animation-state={animationState} data-reduced-motion={reducedMotion} className={styles.scene}><figcaption className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</figcaption><div aria-hidden="true" className="mt-4">{children}</div><p className="mt-4 text-sm leading-relaxed text-slate-700"><span className="font-bold">Équivalent textuel : </span>{text}</p></figure>;
}

export function WelcomeSituationScene(props: SceneProps) {
  const categories = ["Échanges", "Informations", "Documents", "Décisions"];
  return <SceneFrame {...props} targetId="welcome-situation-illustration" text={`${welcomeGeneralContent.situation.join(" ")} Goodissima fournit un cadre commun sans remplacer les décisions humaines.`}><div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr]"><div className="grid gap-3">{categories.slice(0, 2).map((item, index) => <div key={item} className={`${styles.card} ${styles.animatedItem}`} style={{ "--scene-delay": `${index * 140}ms` } as React.CSSProperties}>{item}</div>)}</div><div className={`${styles.animatedItem} flex items-center justify-center rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-3 text-center text-sm font-bold text-cyan-950`} style={{ "--scene-delay": "520ms" } as React.CSSProperties}>Cadre Goodissima</div><div className="grid gap-3">{categories.slice(2).map((item, index) => <div key={item} className={`${styles.card} ${styles.animatedItem}`} style={{ "--scene-delay": `${280 + index * 140}ms` } as React.CSSProperties}>{item}</div>)}</div></div><div className={`${styles.line} ${styles.animatedItem} mt-4`} style={{ "--scene-delay": "700ms" } as React.CSSProperties} /></SceneFrame>;
}

export function WelcomePrincipleScene(props: SceneProps) {
  const [humanDecision, setHumanDecision] = useState(false);
  const chain = ["Une intention", "Des réponses recueillies", "Des rapprochements possibles"];
  return <div><SceneFrame {...props} targetId="welcome-principle-illustration" text={`${welcomeGeneralContent.principle} Les rapprochements peuvent être suggérés ; la suite reste une décision humaine.`}><div className="grid gap-3 sm:grid-cols-3">{chain.map((item, index) => <div key={item} className={`${styles.card} ${styles.animatedItem}`} style={{ "--scene-delay": `${index * 180}ms` } as React.CSSProperties}>{item}</div>)}</div><div className={`${styles.threshold} ${styles.animatedItem} mt-4 text-center`} style={{ "--scene-delay": "620ms" } as React.CSSProperties}><p className="font-bold text-amber-950">Seuil : décision humaine</p><p className="mt-1 text-xs text-amber-900">Le schéma s’arrête ici jusqu’à votre choix pédagogique.</p></div>{humanDecision ? <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className={styles.card}>Activité organisée</div><div className={styles.card}>Parcours</div><div className={styles.card}>Pilotage partagé</div></div> : null}</SceneFrame><button type="button" aria-pressed={humanDecision} onClick={() => setHumanDecision((value) => !value)} className="mt-3 min-h-11 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-950 focus-visible:ring-2 focus-visible:ring-amber-600">{humanDecision ? "Revenir avant la décision" : "Je décide de poursuivre"}</button><p className="mt-2 text-xs text-slate-500">Interaction illustrative uniquement : aucune donnée, relation ou navigation n’est créée.</p></div>;
}

export function WelcomeEntryScene({ selectedKey, ...props }: SceneProps & { selectedKey: WelcomeEntryKey | null }) {
  return <SceneFrame {...props} text="Une intention peut conduire vers quatre manières de commencer. La sélection reste humaine et n’ouvre aucune page."><div className={`${styles.animatedItem} mx-auto max-w-sm rounded-full border border-cyan-300 bg-white px-4 py-3 text-center text-sm font-bold text-cyan-950`}>Ce que je souhaite accomplir</div><div className="mt-4 grid gap-3 sm:grid-cols-2">{welcomeEntries.map((entry, index) => <div key={entry.key} className={`${styles.card} ${styles.animatedItem} ${selectedKey && selectedKey !== entry.key ? styles.secondary : ""} ${selectedKey === entry.key ? styles.selected : ""}`} style={{ "--scene-delay": `${180 + index * 120}ms` } as React.CSSProperties}>{entry.title}</div>)}</div></SceneFrame>;
}

export function WelcomeHandoffScene({ entry, ...props }: SceneProps & { entry: WelcomeEntry }) {
  return <SceneFrame {...props} text={`${entry.title} conduit vers une vraie page uniquement après un clic humain. ${welcomeGeneralContent.completion.contextualHandoff}`}><div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]"><div className={`${styles.card} ${styles.animatedItem}`}>{entry.title}</div><div className={`${styles.animatedItem} text-center text-cyan-800`} style={{ "--scene-delay": "220ms" } as React.CSSProperties}>→</div><div className={`${styles.card} ${styles.animatedItem}`} style={{ "--scene-delay": "420ms" } as React.CSSProperties}><span className="block text-xs text-slate-500">Page réelle</span>{entry.description}<span className="mt-2 block text-cyan-800">Boussole disponible</span></div></div><p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{entry.humanControlNotice}</p></SceneFrame>;
}
