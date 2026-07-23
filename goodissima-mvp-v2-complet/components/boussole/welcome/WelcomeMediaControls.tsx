"use client";

import type { WelcomeAnimationState } from "./WelcomeScenes";
import type { WelcomeAudioState } from "./useWelcomeAudioGuide";

export function WelcomeMediaControls({ animationState, reducedMotion, audioState, transcript, chimeEnabled, isIntroducing, onPlayAnimation, onPauseAnimation, onRestartAnimation, onReducedMotionChange, onChimeEnabledChange, onPlayAudio, onPauseAudio, onResumeAudio, onStopAudio }: {
  animationState: WelcomeAnimationState;
  reducedMotion: boolean;
  audioState: WelcomeAudioState;
  transcript: string;
  chimeEnabled: boolean;
  isIntroducing: boolean;
  onPlayAnimation: () => void;
  onPauseAnimation: () => void;
  onRestartAnimation: () => void;
  onReducedMotionChange: (value: boolean) => void;
  onChimeEnabledChange: (value: boolean) => void;
  onPlayAudio: () => void;
  onPauseAudio: () => void;
  onResumeAudio: () => void;
  onStopAudio: () => void;
}) {
  const animationStatus = reducedMotion
    ? "État final statique affiché."
    : animationState === "paused"
      ? "Animations suspendues."
      : "Animations autorisées pour la scène visible.";

  return (
    <section className="rounded-xl bg-slate-50 px-4 py-4 sm:px-5" aria-labelledby="welcome-media-title">
      <h2 id="welcome-media-title" className="text-base font-bold text-slate-950">Présentation facultative</h2>
      <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {audioState === "unavailable" ? <p className="text-sm text-slate-600" role="status">La narration n’est pas disponible dans ce navigateur.</p> : null}
        {audioState === "idle" ? <button type="button" onClick={onPlayAudio} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2">Écouter la présentation</button> : null}
        {audioState === "playing" ? <>{!isIntroducing ? <button type="button" onClick={onPauseAudio} className="min-h-11 rounded-lg border bg-white px-4 py-2 text-sm font-bold focus-visible:ring-2 focus-visible:ring-cyan-700">Pause</button> : null}<button type="button" onClick={onStopAudio} className="min-h-11 rounded-lg border bg-white px-4 py-2 text-sm font-bold focus-visible:ring-2 focus-visible:ring-cyan-700">Arrêter</button></> : null}
        {audioState === "paused" ? <><button type="button" onClick={onResumeAudio} className="min-h-11 rounded-lg border bg-white px-4 py-2 text-sm font-bold focus-visible:ring-2 focus-visible:ring-cyan-700">Reprendre</button><button type="button" onClick={onStopAudio} className="min-h-11 rounded-lg border bg-white px-4 py-2 text-sm font-bold focus-visible:ring-2 focus-visible:ring-cyan-700">Arrêter</button></> : null}
        {audioState !== "unavailable" ? <p className="text-sm text-slate-600" role="status">État sonore : {audioState === "playing" ? "lecture" : audioState === "paused" ? "pause" : "arrêté"}.</p> : null}
      </div>

      <details className="mt-4 border-t border-slate-200 pt-3">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-cyan-950 outline-none focus-visible:ring-2 focus-visible:ring-cyan-700">Options d’animation et d’accessibilité</summary>
        <div className="mt-3 space-y-4">
          <div>
            <h3 className="font-bold text-slate-950">Animation</h3>
            <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap">
              {!reducedMotion && animationState === "paused" ? <button type="button" onClick={onPlayAnimation} className="min-h-11 rounded-lg border bg-white px-4 py-2 text-sm font-bold">Lire l’animation</button> : null}
              {!reducedMotion && animationState === "playing" ? <button type="button" onClick={onPauseAnimation} className="min-h-11 rounded-lg border bg-white px-4 py-2 text-sm font-bold">Mettre en pause</button> : null}
              {!reducedMotion ? <button type="button" onClick={onRestartAnimation} className="min-h-11 rounded-lg border bg-white px-4 py-2 text-sm font-bold">Recommencer la scène</button> : null}
            </div>
            <label className="mt-3 flex min-h-11 items-center gap-3 text-sm font-semibold text-slate-800"><input type="checkbox" checked={reducedMotion} onChange={(event) => onReducedMotionChange(event.target.checked)} /> Réduire les animations</label>
            <p className="mt-2 text-sm text-slate-600" role="status">{animationStatus}</p>
          </div>

          <div>
            <h3 className="font-bold text-slate-950">Son</h3>
            <label className="mt-2 flex min-h-11 items-center gap-3 text-sm font-semibold text-slate-800"><input type="checkbox" checked={chimeEnabled} onChange={(event) => onChimeEnabledChange(event.target.checked)} /> Jouer la courte introduction musicale</label>
          </div>

          {transcript ? <details className="rounded-lg border border-slate-200 bg-white p-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-slate-900">Transcription de la présentation</summary><p className="mt-2 text-sm leading-relaxed text-slate-700">{transcript}</p></details> : null}
        </div>
      </details>
    </section>
  );
}
