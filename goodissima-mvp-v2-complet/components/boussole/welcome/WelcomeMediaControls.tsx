"use client";

import type { WelcomeAnimationState } from "./WelcomeScenes";
import type { WelcomeAudioState } from "./useWelcomeAudioGuide";

export function WelcomeMediaControls({ animationState, reducedMotion, audioState, transcript, onPlayAnimation, onPauseAnimation, onRestartAnimation, onReducedMotionChange, onPlayAudio, onPauseAudio, onResumeAudio, onStopAudio }: {
  animationState: WelcomeAnimationState;
  reducedMotion: boolean;
  audioState: WelcomeAudioState;
  transcript: string;
  onPlayAnimation: () => void;
  onPauseAnimation: () => void;
  onRestartAnimation: () => void;
  onReducedMotionChange: (value: boolean) => void;
  onPlayAudio: () => void;
  onPauseAudio: () => void;
  onResumeAudio: () => void;
  onStopAudio: () => void;
}) {
  return <section className="mt-5 grid gap-4 rounded-xl border bg-slate-50 p-4 lg:grid-cols-2" aria-label="Contrôles de la scène"><div><h2 className="font-bold text-slate-950">Animation</h2><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={reducedMotion || animationState === "playing"} onClick={onPlayAnimation} className="min-h-11 rounded-lg border bg-white px-3 py-2 text-sm font-bold disabled:opacity-40">Lire l’animation</button><button type="button" disabled={reducedMotion || animationState === "paused"} onClick={onPauseAnimation} className="min-h-11 rounded-lg border bg-white px-3 py-2 text-sm font-bold disabled:opacity-40">Mettre en pause</button><button type="button" disabled={reducedMotion} onClick={onRestartAnimation} className="min-h-11 rounded-lg border bg-white px-3 py-2 text-sm font-bold disabled:opacity-40">Recommencer la scène</button></div><label className="mt-3 flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={reducedMotion} onChange={(event) => onReducedMotionChange(event.target.checked)} /> Réduire les animations</label><p className="mt-2 text-xs text-slate-500" role="status">{reducedMotion ? "État final statique affiché." : animationState === "paused" ? "Animations suspendues." : "Animations autorisées pour la scène visible."}</p></div><div><h2 className="font-bold text-slate-950">Présentation sonore facultative</h2>{audioState === "unavailable" ? <p className="mt-3 text-sm text-slate-600" role="status">La narration n’est pas disponible dans ce navigateur.</p> : <><div className="mt-3 flex flex-wrap gap-2">{audioState === "idle" ? <button type="button" onClick={onPlayAudio} className="min-h-11 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white">Écouter la présentation</button> : null}<button type="button" disabled={audioState !== "playing"} onClick={onPauseAudio} className="min-h-11 rounded-lg border bg-white px-3 py-2 text-sm font-bold disabled:opacity-40">Pause</button><button type="button" disabled={audioState !== "paused"} onClick={onResumeAudio} className="min-h-11 rounded-lg border bg-white px-3 py-2 text-sm font-bold disabled:opacity-40">Reprendre</button><button type="button" disabled={audioState === "idle"} onClick={onStopAudio} className="min-h-11 rounded-lg border bg-white px-3 py-2 text-sm font-bold disabled:opacity-40">Arrêter</button></div><p className="mt-2 text-xs text-slate-500" role="status">État sonore : {audioState === "playing" ? "lecture" : audioState === "paused" ? "pause" : "arrêté"}.</p>{transcript ? <details className="mt-3 rounded-lg border bg-white p-3"><summary className="cursor-pointer text-sm font-bold">Transcription</summary><p className="mt-2 text-sm leading-relaxed text-slate-600">{transcript}</p></details> : null}</>}</div></section>;
}
