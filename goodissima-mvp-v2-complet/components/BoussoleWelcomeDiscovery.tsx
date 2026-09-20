"use client";

import Link from "next/link";
import { useState } from "react";
import { WelcomeMediaControls } from "@/components/boussole/welcome/WelcomeMediaControls";
import { WelcomeEntryBanner, WelcomeEntryFlow, WelcomeEntryScene, WelcomeHandoffScene, WelcomePrincipleScene, WelcomeSituationScene, type WelcomeAnimationState } from "@/components/boussole/welcome/WelcomeScenes";
import welcomeStyles from "@/components/boussole/welcome/welcome-scenes.module.css";
import { useWelcomeAudioGuide } from "@/components/boussole/welcome/useWelcomeAudioGuide";
import {
  WELCOME_INTENTS,
  WELCOME_MODES,
  WELCOME_STEP_IDS,
  type WelcomeEntry,
  type WelcomeEntryKey,
  type WelcomeIntent,
  type WelcomeMode,
  type WelcomeOrientationResult,
} from "@/lib/boussole/welcome-contracts";
import { getWelcomeEntry, welcomeEntries, welcomeGeneralContent, type WelcomeEntryContent } from "@/lib/boussole/welcome-content";
import { orientWelcomeIntent } from "@/lib/boussole/welcome-orientation";

const discoverStepIds = WELCOME_STEP_IDS["welcome-discover"];

const intentLabels: Record<WelcomeIntent, string> = {
  RECEIVE_RESPONSES: "Recevoir des réponses",
  PUBLISH_NEED_OR_PROPOSAL: "Publier un besoin ou une proposition",
  COORDINATE_PEOPLE_AND_DECISIONS: "Coordonner plusieurs personnes, étapes ou décisions",
  REVIEW_EXISTING_ACTIVITY: "Retrouver et piloter une activité existante",
  UNSURE: "Je ne sais pas encore",
};

export function BoussoleWelcomeDiscovery() {
  const [mode, setMode] = useState<WelcomeMode>("DISCOVER");
  const [discoverStepIndex, setDiscoverStepIndex] = useState(0);
  const [selectedEntryKey, setSelectedEntryKey] = useState<WelcomeEntryKey | null>(null);
  const [confirmationEntryKey, setConfirmationEntryKey] = useState<WelcomeEntryKey | null>(null);
  const [orientation, setOrientation] = useState<WelcomeOrientationResult | null>(null);
  const [animationState, setAnimationState] = useState<WelcomeAnimationState>("playing");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [sceneRunId, setSceneRunId] = useState(0);
  const audio = useWelcomeAudioGuide();
  const selectedEntry = selectedEntryKey ? getWelcomeEntry(selectedEntryKey) : null;
  const confirmationEntry = confirmationEntryKey ? getWelcomeEntry(confirmationEntryKey) : null;

  function changeMode(nextMode: WelcomeMode) {
    audio.reset();
    setMode(nextMode);
    setConfirmationEntryKey(null);
    setOrientation(null);
  }

  function changeDiscoverStep(index: number) {
    audio.reset();
    setSceneRunId((current) => current + 1);
    setDiscoverStepIndex(index);
  }

  function changeReducedMotion(value: boolean) {
    setReducedMotion(value);
    setAnimationState("paused");
  }

  const sceneProps = { animationState, reducedMotion, runId: sceneRunId };
  const narrationText = confirmationEntry
    ? `${confirmationEntry.title}. ${confirmationEntry.description} ${welcomeGeneralContent.completion.contextualHandoff}`
    : mode === "DIRECT" || mode === "HELP" || discoverStepIndex >= 3
      ? welcomeEntries.map((entry) => entry.title).join(". ")
      : discoverStepIndex === 0
        ? `${welcomeGeneralContent.situation.join(" ")} Goodissima aide à organiser ces éléments dans un cadre commun.`
        : `${welcomeGeneralContent.principle} ${welcomeGeneralContent.humanControl.join(" ")}`;

  function chooseEntry(entry: WelcomeEntry) {
    setSelectedEntryKey(entry.key);
    setConfirmationEntryKey(null);
  }

  function chooseIntent(intent: WelcomeIntent) {
    setConfirmationEntryKey(null);
    setOrientation(orientWelcomeIntent(intent));
  }

  return (
    <div className="mt-6 space-y-6">
      <section data-boussole-id="welcome-mode-selector" className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6" aria-labelledby="welcome-mode-title">
        <h2 id="welcome-mode-title" className="text-xl font-bold text-slate-950">Comment souhaitez-vous commencer ?</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3" role="group" aria-label="Mode de découverte">
          {WELCOME_MODES.map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-pressed={mode === candidate}
              onClick={() => changeMode(candidate)}
              className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 ${mode === candidate ? "border-cyan-700 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-700" : "border-slate-200 bg-white text-slate-700 hover:border-cyan-300"}`}
            >
              <span className="block">{welcomeGeneralContent.modes[candidate]}</span>
              <span className="mt-1 block text-sm font-medium text-slate-600">{mode === candidate ? "Mode sélectionné" : "Choisir ce mode"}</span>
            </button>
          ))}
        </div>
      </section>

      {mode === "DISCOVER" ? (
        <DiscoverMode
          stepIndex={discoverStepIndex}
          selectedEntry={selectedEntry}
          confirmationEntry={confirmationEntry}
          onStepChange={changeDiscoverStep}
          sceneProps={sceneProps}
          onNavigate={audio.reset}
          onEntrySelect={chooseEntry}
          onConfirm={(entry) => setConfirmationEntryKey(entry.key)}
          onCancelConfirmation={() => setConfirmationEntryKey(null)}
        />
      ) : null}

      {mode === "DIRECT" ? (
        <section aria-labelledby="welcome-direct-title" className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
          <h2 id="welcome-direct-title" className="text-2xl font-bold text-slate-950">Choisissez ce que vous voulez faire</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">Sélectionnez une possibilité pour la vérifier avant d’ouvrir la page correspondante.</p>
          <EntryChoices headingLevel={3} selectedKey={selectedEntryKey} onSelect={chooseEntry} sceneProps={sceneProps} />
          {selectedEntry ? <button type="button" onClick={() => setConfirmationEntryKey(selectedEntry.key)} className="mt-5 min-h-11 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2">Confirmer ce choix</button> : null}
          {confirmationEntry ? <EntryConfirmation headingLevel={3} entry={confirmationEntry} onCancel={() => setConfirmationEntryKey(null)} sceneProps={sceneProps} onNavigate={audio.reset} /> : null}
        </section>
      ) : null}

      {mode === "HELP" ? (
        <HelpMode
          orientation={orientation}
          onIntentSelect={chooseIntent}
          onReset={() => { setOrientation(null); setConfirmationEntryKey(null); }}
          onConfirm={(entry) => setConfirmationEntryKey(entry.key)}
          onShowDiscover={() => changeMode("DISCOVER")}
          onShowDirect={() => changeMode("DIRECT")}
        />
      ) : null}
      {mode === "HELP" && confirmationEntry ? <EntryConfirmation headingLevel={2} entry={confirmationEntry} onCancel={() => setConfirmationEntryKey(null)} sceneProps={sceneProps} onNavigate={audio.reset} /> : null}

      {mode !== "DISCOVER" || discoverStepIds[discoverStepIndex] !== "welcome-human-control" ? <HumanControlNotice headingLevel={2} /> : null}

      <WelcomeMediaControls
        animationState={animationState}
        reducedMotion={reducedMotion}
        audioState={audio.state}
        transcript={audio.transcript}
        chimeEnabled={audio.chimeEnabled}
        isIntroducing={audio.isIntroducing}
        onPlayAnimation={() => setAnimationState("playing")}
        onPauseAnimation={() => setAnimationState("paused")}
        onRestartAnimation={() => { setSceneRunId((current) => current + 1); setAnimationState("playing"); }}
        onReducedMotionChange={changeReducedMotion}
        onChimeEnabledChange={audio.setChimeEnabled}
        onPlayAudio={() => audio.play(narrationText)}
        onPauseAudio={audio.pause}
        onResumeAudio={audio.resume}
        onStopAudio={audio.stop}
      />
    </div>
  );
}

function DiscoverMode({ stepIndex, selectedEntry, confirmationEntry, onStepChange, onEntrySelect, onConfirm, onCancelConfirmation, sceneProps, onNavigate }: {
  stepIndex: number;
  selectedEntry: WelcomeEntryContent | null;
  confirmationEntry: WelcomeEntry | null;
  onStepChange: (index: number) => void;
  onEntrySelect: (entry: WelcomeEntry) => void;
  onConfirm: (entry: WelcomeEntry) => void;
  onCancelConfirmation: () => void;
  sceneProps: { animationState: WelcomeAnimationState; reducedMotion: boolean; runId: number };
  onNavigate: () => void;
}) {
  const stepId = discoverStepIds[stepIndex];
  const canContinue = stepId !== "welcome-first-action" || Boolean(selectedEntry);
  const nextLabel = stepId === "welcome-entry-points"
    ? "Continuer pour choisir"
    : stepId === "welcome-first-action" && selectedEntry
      ? "Suivant : vérifier ce choix"
      : "Suivant";

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7" aria-labelledby="welcome-discover-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#247f88]" aria-live="polite">Étape {stepIndex + 1} sur {discoverStepIds.length}</p>
          <h2 id="welcome-discover-title" className="mt-1 text-2xl font-bold text-slate-950">Je découvre Goodissima</h2>
        </div>
        <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Parcours manuel</p>
      </div>

      <div className="mt-6 min-h-64" data-welcome-step-id={stepId}>
        {stepId === "welcome-situation" ? <div><h3 className="text-xl font-bold">Des informations difficiles à suivre</h3><div className="mt-4"><WelcomeSituationScene {...sceneProps} /></div></div> : null}
        {stepId === "welcome-principle" ? <div><h3 className="text-xl font-bold">Le principe Goodissima</h3><p className="mt-3 text-sm leading-relaxed text-slate-700">{welcomeGeneralContent.principle}</p><div className="mt-4"><WelcomePrincipleScene key={sceneProps.runId} {...sceneProps} /></div></div> : null}
        {stepId === "welcome-human-control" ? <HumanControlNotice headingLevel={3} heading="Ce qui reste toujours sous votre contrôle" /> : null}
        {stepId === "welcome-entry-points" ? <EntryOverview sceneProps={sceneProps} /> : null}
        {stepId === "welcome-first-action" ? <div><h3 className="text-xl font-bold">Choisissez une première action</h3><p className="mt-2 text-sm text-slate-700">Sélectionnez une possibilité pour continuer vers la vérification.</p><EntryChoices headingLevel={4} selectedKey={selectedEntry?.key ?? null} onSelect={onEntrySelect} sceneProps={sceneProps} showScene={false} /><p role="status" aria-live="polite" aria-atomic="true" className={`mt-4 min-h-6 text-sm font-semibold ${selectedEntry ? "rounded-lg bg-cyan-50 p-3 text-cyan-950" : "text-slate-700"}`}>{selectedEntry ? `Vous avez choisi : ${selectedEntry.title}. Vous pouvez maintenant vérifier ce choix.` : ""}</p></div> : null}
        {stepId === "welcome-handoff" ? selectedEntry ? <div><h3 className="text-xl font-bold">Vérifiez avant d’ouvrir la vraie page</h3>{confirmationEntry ? <EntryConfirmation headingLevel={4} entry={confirmationEntry} onCancel={onCancelConfirmation} sceneProps={sceneProps} onNavigate={onNavigate} /> : <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4"><WelcomeHandoffScene entry={selectedEntry} {...sceneProps} /><section className="mt-4 rounded-lg bg-white p-4" aria-labelledby="welcome-next-page-capabilities"><h4 id="welcome-next-page-capabilities" className="font-bold text-slate-950">Sur la page suivante, vous pourrez</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{selectedEntry.nextPageCapabilities.map((capability) => <li key={capability}>{capability}</li>)}</ul><p className="mt-3 text-sm font-semibold text-amber-950">Rien ne sera créé, publié, envoyé ou décidé avant votre action explicite.</p></section><button type="button" onClick={() => onConfirm(selectedEntry)} className="mt-4 min-h-11 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2">Continuer vers la confirmation</button></div>}</div> : <p role="status">Revenez à l’étape précédente pour choisir une première action.</p> : null}
      </div>

      <div data-boussole-id="welcome-resume-controls" className="mt-8 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:flex-wrap">
        <button type="button" disabled={stepIndex === 0} onClick={() => onStepChange(Math.max(0, stepIndex - 1))} className="min-h-11 rounded-lg border px-4 py-2 text-sm font-bold text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 disabled:cursor-not-allowed disabled:opacity-40">Précédent</button>
        {stepId === "welcome-first-action" && !selectedEntry ? <p className="text-sm font-semibold text-amber-900 sm:basis-full">Choisissez une possibilité pour accéder à l’étape 6.</p> : null}
        {stepIndex < discoverStepIds.length - 1 ? <button type="button" disabled={!canContinue} onClick={() => onStepChange(Math.min(discoverStepIds.length - 1, stepIndex + 1))} className="min-h-11 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">{nextLabel}</button> : null}
      </div>
    </section>
  );
}

function EntryOverview({ sceneProps }: { sceneProps: { animationState: WelcomeAnimationState; reducedMotion: boolean; runId: number } }) {
  return <div><h3 className="text-xl font-bold">Quatre manières principales de commencer</h3><p className="mt-2 text-sm text-slate-700">Découvrez les quatre portes sans rien sélectionner ni ouvrir.</p><div className="mt-4"><WelcomeEntryScene selectedKey={null} {...sceneProps} /></div><p className="mt-4 text-sm font-semibold text-slate-800">À l’étape suivante, vous choisirez la possibilité qui vous correspond.</p></div>;
}

function EntryChoices({ headingLevel, selectedKey, onSelect, sceneProps, showScene = true }: { headingLevel: 3 | 4; selectedKey: WelcomeEntryKey | null; onSelect: (entry: WelcomeEntry) => void; sceneProps: { animationState: WelcomeAnimationState; reducedMotion: boolean; runId: number }; showScene?: boolean }) {
  return <fieldset className="mt-5"><legend className="text-sm font-bold text-slate-900">Sélectionner une possibilité</legend>{showScene ? <WelcomeEntryScene selectedKey={selectedKey} {...sceneProps} /> : null}<EntryCards headingLevel={headingLevel} selectable selectedKey={selectedKey} onSelect={onSelect} /></fieldset>;
}

function EntryCards({ headingLevel, selectable, selectedKey, onSelect }: { headingLevel: 3 | 4; selectable: boolean; selectedKey: WelcomeEntryKey | null; onSelect: (entry: WelcomeEntry) => void }) {
  const Heading = headingLevel === 3 ? "h3" : "h4";
  const [detailKey, setDetailKey] = useState<WelcomeEntryKey | null>(null);
  const detailEntry = detailKey ? getWelcomeEntry(detailKey) : null;
  return <div className={`${welcomeStyles.entryChoices} ${detailEntry ? welcomeStyles.entryChoicesWithDetail : ""}`}><div className={welcomeStyles.entryCardsGrid}>{welcomeEntries.map((entry) => <article key={entry.key} data-boussole-id={entry.stableId} data-entry-key={entry.key} className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ${selectedKey === entry.key ? "border-cyan-700 bg-cyan-50 ring-2 ring-cyan-700" : "border-slate-200"}`}><WelcomeEntryBanner entryKey={entry.key} /><div className="flex flex-1 flex-col p-5"><div className="flex items-start justify-between gap-3"><Heading className="text-lg font-extrabold text-slate-950">{entry.title}</Heading>{selectedKey === entry.key ? <span className="rounded-full bg-cyan-900 px-2.5 py-1 text-xs font-bold text-white">✓ Sélectionnée</span> : null}</div><p className="mt-2 text-sm leading-relaxed text-slate-600">{entry.description}</p>{entry.explanationOfGoodissimaTerm ? <p className="mt-2 text-sm font-semibold text-cyan-900">{entry.explanationOfGoodissimaTerm}</p> : null}<div className="mt-4 rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Situation type</p><p className="mt-1 text-sm leading-relaxed text-slate-800">{entry.situationType}</p></div><WelcomeEntryFlow entry={entry} /><p className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-950"><span aria-hidden="true">✓</span><span>{entry.humanControlNotice}</span></p><div className="mt-auto pt-3"><button type="button" aria-expanded={detailKey === entry.key} aria-controls="welcome-entry-detail-panel" onClick={() => setDetailKey(detailKey === entry.key ? null : entry.key)} className="min-h-11 w-full rounded-lg px-3 py-2 text-sm font-bold text-cyan-950 underline decoration-cyan-500 underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2">{detailKey === entry.key ? "Masquer l’exemple détaillé" : "Voir un exemple détaillé"}</button>{selectable ? <button type="button" aria-pressed={selectedKey === entry.key} onClick={() => onSelect(entry)} className="mt-3 min-h-12 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-sm outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2">{selectedKey === entry.key ? `Possibilité sélectionnée : ${entry.title}` : `Choisir : ${entry.title}`}</button> : null}</div></div></article>)}</div>{detailEntry ? <section id="welcome-entry-detail-panel" className={`${welcomeStyles.entryDetailPanel} rounded-2xl border border-slate-300 bg-slate-50 p-5 shadow-sm sm:p-6`} aria-labelledby="welcome-entry-detail-title"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-cyan-800">Exemple détaillé</p><h3 id="welcome-entry-detail-title" className="mt-1 text-xl font-extrabold text-slate-950">{detailEntry.title}</h3></div><button type="button" onClick={() => setDetailKey(null)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-cyan-700">Fermer l’exemple détaillé</button></div><p className="mt-4 rounded-xl bg-white p-4 text-sm leading-relaxed text-slate-800"><strong>Situation :</strong> {detailEntry.situationType}</p><div className="mt-5"><WelcomeEntryFlow entry={detailEntry} /></div><p className="mt-5 text-base leading-relaxed text-slate-700">{detailEntry.detailedExample}</p><p className="mt-5 flex gap-2 border-t border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950"><span aria-hidden="true">✓</span><span>{detailEntry.humanControlNotice}</span></p></section> : null}</div>;
}

function HelpMode({ orientation, onIntentSelect, onReset, onConfirm, onShowDiscover, onShowDirect }: {
  orientation: WelcomeOrientationResult | null;
  onIntentSelect: (intent: WelcomeIntent) => void;
  onReset: () => void;
  onConfirm: (entry: WelcomeEntry) => void;
  onShowDiscover: () => void;
  onShowDirect: () => void;
}) {
  return <section data-boussole-id="welcome-entry-help" className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6" aria-labelledby="welcome-help-title"><h2 id="welcome-help-title" className="text-2xl font-bold">Qu’aimeriez-vous accomplir aujourd’hui ?</h2><fieldset className="mt-5"><legend className="text-sm font-bold text-slate-900">Choisir l’objectif qui se rapproche le plus de votre situation</legend><div className="mt-3 grid gap-3">{WELCOME_INTENTS.map((intent) => <button key={intent} type="button" onClick={() => onIntentSelect(intent)} className="min-h-11 rounded-xl border bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 outline-none hover:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2">{intentLabels[intent]}</button>)}</div></fieldset>{orientation ? <div data-boussole-id="welcome-recommendation" className="mt-6 rounded-xl border border-cyan-200 bg-cyan-50 p-5"><div role="status" aria-live="polite"><h3 className="font-bold text-cyan-950">Orientation proposée</h3><p className="mt-2 text-sm text-cyan-950">{orientation.understoodGoal}</p><p className="mt-2 text-sm text-cyan-900">{orientation.rationale}</p><p className="mt-3 text-xs font-semibold text-amber-900">{orientation.humanControlNotice}</p></div>{orientation.recommendedEntry ? <div className="mt-4"><p className="font-bold text-slate-950">{orientation.recommendedEntry.title}</p><button type="button" onClick={() => onConfirm(orientation.recommendedEntry!)} className="mt-3 min-h-11 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2">Examiner cette porte</button></div> : <div className="mt-4"><p className="text-sm text-slate-700">{orientation.nextStep}</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={onShowDiscover} className="min-h-11 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Découvrir Goodissima</button><button type="button" onClick={onShowDirect} className="min-h-11 rounded-lg border bg-white px-4 py-2 text-sm font-bold text-slate-700">Voir les quatre possibilités</button></div></div>}<button type="button" onClick={onReset} className="mt-4 text-sm font-bold text-cyan-950 underline underline-offset-4">Revenir aux autres choix</button></div> : null}</section>;
}

function EntryConfirmation({ headingLevel, entry, onCancel, sceneProps, onNavigate }: { headingLevel: 2 | 3 | 4; entry: WelcomeEntry; onCancel: () => void; sceneProps: { animationState: WelcomeAnimationState; reducedMotion: boolean; runId: number }; onNavigate: () => void }) {
  const Heading = headingLevel === 2 ? "h2" : headingLevel === 3 ? "h3" : "h4";
  const headingId = `welcome-confirmation-title-${headingLevel}`;
  return <section data-boussole-id="welcome-primary-navigation" className="mt-5 rounded-xl border border-cyan-300 bg-white p-5" aria-labelledby={headingId}><p className="text-xs font-bold uppercase tracking-wide text-[#247f88]">Confirmation humaine</p><Heading id={headingId} className="mt-1 text-xl font-bold text-slate-950">{entry.title}</Heading><div className="mt-4"><WelcomeHandoffScene entry={entry} {...sceneProps} /></div><p className="mt-2 text-sm leading-relaxed text-slate-700">{entry.description}</p>{entry.explanationOfGoodissimaTerm ? <p className="mt-2 text-sm font-semibold text-cyan-900">{entry.explanationOfGoodissimaTerm}</p> : null}<p className="mt-3 text-sm text-slate-600"><strong>Exemple :</strong> {entry.usageExample}</p><p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950"><strong>Ce que Goodissima ne fera pas automatiquement :</strong> {entry.humanControlNotice}</p><div className="mt-4 flex flex-wrap gap-3"><Link href={entry.route} onClick={onNavigate} className="inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2">Ouvrir cette page</Link><button type="button" onClick={onCancel} className="min-h-11 rounded-lg border px-4 py-2 text-sm font-bold text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-700">Changer de choix</button></div></section>;
}

function HumanControlNotice({ headingLevel, heading = "Vous restez maître de chaque suite" }: { headingLevel: 2 | 3; heading?: string }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const headingId = `welcome-human-control-title-${headingLevel}`;
  if (headingLevel === 3) {
    return <section data-boussole-id="welcome-human-control-notice" className="rounded-xl bg-amber-50 p-5" aria-labelledby={headingId}><Heading id={headingId} className="text-xl font-bold text-amber-950">{heading}</Heading><p className="mt-3 text-base leading-relaxed text-amber-950">Vous gardez la main. Rien n’est publié, envoyé, créé ou décidé sans votre action.</p><ul className="mt-4 grid gap-3 text-sm leading-relaxed text-amber-950 sm:grid-cols-2">{welcomeGeneralContent.humanControl.map((notice) => <li key={notice}>{notice}</li>)}</ul></section>;
  }
  return <section data-boussole-id="welcome-human-control-notice" className="rounded-xl bg-amber-50 px-4 py-4 sm:px-5" aria-labelledby={headingId}><Heading id={headingId} className="font-bold text-amber-950">Vous gardez la main</Heading><p className="mt-2 text-sm leading-relaxed text-amber-950">Rien n’est publié, envoyé, créé ou décidé sans votre action.</p><details className="mt-2"><summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-amber-950 outline-none focus-visible:ring-2 focus-visible:ring-amber-700">Voir les garanties de contrôle humain</summary><ul className="mt-2 grid gap-2 text-sm leading-relaxed text-amber-950 sm:grid-cols-2">{welcomeGeneralContent.humanControl.map((notice) => <li key={notice}>{notice}</li>)}</ul></details></section>;
}
