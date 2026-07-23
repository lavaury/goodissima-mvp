import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { playWelcomeChime } from "../components/boussole/welcome/useWelcomeAudioGuide.ts";

const discovery = readFileSync(new URL("../components/BoussoleWelcomeDiscovery.tsx", import.meta.url), "utf8");
const scenes = readFileSync(new URL("../components/boussole/welcome/WelcomeScenes.tsx", import.meta.url), "utf8");
const controls = readFileSync(new URL("../components/boussole/welcome/WelcomeMediaControls.tsx", import.meta.url), "utf8");
const audio = readFileSync(new URL("../components/boussole/welcome/useWelcomeAudioGuide.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../components/boussole/welcome/welcome-scenes.module.css", import.meta.url), "utf8");
const source = [discovery, scenes, controls, audio, css].join("\n");

test("provides four local pedagogical scenes backed by shared content", () => {
  for (const name of ["WelcomeSituationScene", "WelcomePrincipleScene", "WelcomeEntryScene", "WelcomeHandoffScene"]) {
    assert.match(scenes, new RegExp(`export function ${name}`));
    assert.match(discovery, new RegExp(`<${name}`));
  }
  assert.match(scenes, /welcomeGeneralContent/);
  assert.match(scenes, /welcomeEntries\.map/);
  assert.match(scenes, /Illustration pédagogique — aucune donnée enregistrée/);
  assert.doesNotMatch(scenes, /[\w.+-]+@[\w.-]+|faux dossier|notification inventée|résultat de matching/i);
});

test("uses one accessible inline SVG system for all four entry families", () => {
  assert.match(scenes, /function WelcomeFlowIcon\(\{ entryKey, stepIndex \}: \{ entryKey: WelcomeEntryKey; stepIndex: number \}\)/);
  assert.match(scenes, /<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1\.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">/);
  assert.doesNotMatch(scenes, /[◆⋮♙◇▦◷]/);
  assert.match(scenes, /SIMPLE_LINK: \["form", "link", "responses", "human"\]/);
  assert.match(scenes, /OPPORTUNITY: \["write", "review", "publish", "responses"\]/);
  assert.match(scenes, /GOVERNED_JOURNEY: \["goal", "steps", "people", "shield"\]/);
  assert.match(scenes, /EXISTING_ACTIVITY: \["activity", "overview", "items", "human"\]/);
  assert.match(scenes, /WelcomeEntryBanner[^]*<WelcomeFlowIcon entryKey=\{entryKey\} stepIndex=\{index\}/);
  assert.match(scenes, /WelcomeEntryFlow[^]*<WelcomeFlowIcon entryKey=\{entry\.key\} stepIndex=\{index\}/);
});

test("moves the global detail panel beside readable cards only on wide desktops", () => {
  assert.match(discovery, /welcomeStyles\.entryChoices[^]*detailEntry \? welcomeStyles\.entryChoicesWithDetail/);
  assert.match(discovery, /welcomeStyles\.entryCardsGrid[^]*detailEntry \? <section id="welcome-entry-detail-panel"/);
  assert.match(css, /\.entryChoices \{ display: grid;[^}]*gap: 1\.5rem/);
  assert.match(css, /@media \(min-width: 1280px\) \{[^]*\.entryChoicesWithDetail \{ grid-template-columns: minmax\(0, 2fr\) minmax\(20rem, 1fr\)/);
  assert.doesNotMatch(css, /position:\s*fixed/);
  assert.doesNotMatch(discovery, /role="dialog"|aria-modal|fixed inset|overlay/i);
});

test("preserves targets and makes the human-decision threshold explicit", () => {
  assert.match(scenes, /targetId="welcome-situation-illustration"/);
  assert.match(scenes, /targetId="welcome-principle-illustration"/);
  assert.match(discovery, /data-boussole-id="welcome-primary-navigation"/);
  assert.match(scenes, /Seuil : décision humaine/);
  assert.match(scenes, /Je décide de poursuivre/);
  assert.match(scenes, /Interaction illustrative uniquement/);
});

test("uses finite CSS animations with system and manual motion reduction", () => {
  assert.match(css, /@keyframes welcomeReveal/);
  assert.match(css, /transform:/);
  assert.match(css, /opacity:/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /data-reduced-motion="true"/);
  assert.doesNotMatch(css, /infinite|width\s*:.*animation|height\s*:.*animation/i);
  for (const label of ["Lire l’animation", "Mettre en pause", "Recommencer la scène", "Réduire les animations"]) assert.ok(controls.includes(label));
});

test("starts narration only from a human click and exposes full controls", () => {
  assert.match(discovery, /onPlayAudio=\{\(\) => audio\.play\(narrationText\)\}/);
  assert.match(controls, /onClick=\{onPlayAudio\}/);
  for (const label of ["Écouter la présentation", "Pause", "Reprendre", "Arrêter", "Transcription"]) assert.ok(controls.includes(label));
  const mountEffect = audio.slice(audio.indexOf("useEffect("), audio.indexOf("const play"));
  assert.doesNotMatch(mountEffect, /\.speak\(/);
  assert.match(audio, /window\.speechSynthesis\.speak\(utterance\)/);
});

test("handles unavailable speech and cleans narration lifecycle", () => {
  assert.match(audio, /"speechSynthesis" in window/);
  assert.match(audio, /"SpeechSynthesisUtterance" in window/);
  assert.match(controls, /La narration n’est pas disponible dans ce navigateur/);
  assert.match(audio, /activeUtterance\.onend = null/);
  assert.match(audio, /activeUtterance\.onerror = null/);
  assert.match(audio, /utteranceRef\.current = null[^]*speechSynthesis\?\.cancel\(\)/);
  assert.match(discovery, /function changeMode[^]*audio\.reset\(\)/);
  assert.match(discovery, /onClick=\{onNavigate\}/);
  assert.doesNotMatch(audio, /fetch\s*\(|MediaRecorder|getUserMedia/);
});

test("preserves pause across steps and makes restart explicitly resume animation", () => {
  const stepHandler = discovery.slice(discovery.indexOf("function changeDiscoverStep"), discovery.indexOf("function changeReducedMotion"));
  assert.match(stepHandler, /audio\.reset\(\)/);
  assert.match(stepHandler, /setSceneRunId/);
  assert.match(stepHandler, /setDiscoverStepIndex/);
  assert.doesNotMatch(stepHandler, /setAnimationState\("playing"\)/);
  assert.match(discovery, /onRestartAnimation=\{\(\) => \{ setSceneRunId\([^]*setAnimationState\("playing"\)/);
});

test("manual motion reduction always suspends and never restarts movement", () => {
  const reductionHandler = discovery.slice(discovery.indexOf("function changeReducedMotion"), discovery.indexOf("const sceneProps"));
  assert.match(reductionHandler, /setReducedMotion\(value\)/);
  assert.match(reductionHandler, /setAnimationState\("paused"\)/);
  assert.doesNotMatch(reductionHandler, /setAnimationState\("playing"\)/);
  assert.match(discovery, /onReducedMotionChange=\{changeReducedMotion\}/);
});

test("remounts the principle scene to synchronously reset its human threshold", () => {
  assert.match(discovery, /<WelcomePrincipleScene key=\{sceneProps\.runId\} \{\.\.\.sceneProps\} \/>/);
  assert.doesNotMatch(scenes, /useEffect/);
  assert.match(scenes, /const \[humanDecision, setHumanDecision\] = useState\(false\)/);
  assert.match(scenes, /Seuil : décision humaine/);
  assert.match(scenes, /Je décide de poursuivre/);
});

test("uses honest animation status and a coherent secondary media heading", () => {
  assert.match(controls, /<h2[^>]*>Présentation facultative<\/h2>/);
  assert.match(controls, /<h3[^>]*>Animation<\/h3>/);
  for (const status of ["État final statique affiché.", "Animations suspendues.", "Animations autorisées pour la scène visible."]) assert.ok(controls.includes(status));
  assert.doesNotMatch(controls, /prête ou en lecture|Animation en pause/);
});

test("keeps media options collapsed and renders only relevant audio commands", () => {
  assert.match(controls, /<details[^>]*>[^]*<summary[^>]*>Options d’animation et d’accessibilité<\/summary>/);
  assert.doesNotMatch(controls, /<details[^>]*\sopen(?:=|\s|>)/);
  assert.match(controls, /audioState === "idle" \? <button[^>]*onClick=\{onPlayAudio\}[^]*>Écouter la présentation<\/button> : null/);
  assert.match(controls, /audioState === "playing" \? <>[^]*onClick=\{onPauseAudio\}[^]*onClick=\{onStopAudio\}/);
  assert.match(controls, /audioState === "paused" \? <>[^]*onClick=\{onResumeAudio\}[^]*onClick=\{onStopAudio\}/);
  assert.doesNotMatch(controls, /disabled=\{audioState/);
  assert.match(controls, /<details[^>]*>[^]*Transcription de la présentation[^]*\{transcript\}/);
});

test("offers an enabled-by-default, local-only musical introduction", () => {
  assert.match(audio, /const \[chimeEnabled, setChimeEnabled\] = useState\(true\)/);
  assert.match(controls, /checked=\{chimeEnabled\}[^]*onChimeEnabledChange\(event\.target\.checked\)[^]*Jouer la courte introduction musicale/);
  assert.match(discovery, /chimeEnabled=\{audio\.chimeEnabled\}[^]*onChimeEnabledChange=\{audio\.setChimeEnabled\}/);
  assert.match(audio, /if \(chimeEnabled && "AudioContext" in window\)/);
  assert.match(audio, /await playWelcomeChime[^]*window\.speechSynthesis\.speak\(utterance\)/);
  assert.match(audio, /catch \{[^]*optional chime must never prevent the spoken presentation/);
});

test("synthesizes three finite ascending notes without a loop", async () => {
  const frequencies: number[] = [];
  let oscillatorCount = 0;
  const context = {
    currentTime: 0,
    destination: {},
    createOscillator() {
      oscillatorCount += 1;
      const oscillator = {
        type: "",
        onended: null as null | (() => void),
        frequency: { setValueAtTime(value: number) { frequencies.push(value); } },
        connect() {},
        disconnect() {},
        start() {},
        stop() { queueMicrotask(() => oscillator.onended?.()); },
      };
      return oscillator;
    },
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
      };
    },
  };

  await playWelcomeChime({ audioContext: context as unknown as AudioContext });
  assert.equal(oscillatorCount, 3);
  assert.deepEqual(frequencies, [392, 493.88, 587.33]);
  assert.doesNotMatch(audio, /\.loop\s*=|loop:\s*true|setInterval/);
});

test("reuses one AudioContext and invalidates stopped or superseded sessions", () => {
  assert.match(audio, /const audioContextRef = useRef<AudioContext \| null>\(null\)/);
  assert.match(audio, /audioContextRef\.current \?\? new AudioContext\(\)/);
  assert.match(audio, /audioContext\.state === "suspended"[^]*await audioContext\.resume\(\)/);
  assert.match(audio, /cancelActiveSession\(\)[^]*const sessionId = sessionRef\.current/);
  assert.match(audio, /sessionRef\.current !== sessionId \|\| chimeAbort\.signal\.aborted/);
  assert.match(audio, /chimeAbortRef\.current\?\.abort\(\)[^]*speechSynthesis\?\.cancel\(\)/);
  assert.match(audio, /audioContext\.state !== "closed"[^]*audioContext\.close\(\)/);
});

test("keeps complete scene descriptions accessible behind native disclosures", () => {
  assert.match(scenes, /const generatedId = useId\(\)/);
  assert.match(scenes, /const shortDescriptionId = `[^`]*\$\{generatedId\}[^`]*`/);
  assert.match(scenes, /aria-describedby=\{shortDescriptionId\}/);
  const shortDescription = scenes.slice(scenes.indexOf("<figure"), scenes.indexOf("<details"));
  const fullDescription = scenes.slice(scenes.indexOf("<details"), scenes.indexOf("</details>"));
  assert.match(shortDescription, /aria-describedby=\{shortDescriptionId\}[^]*<p id=\{shortDescriptionId\}[^>]*>\{shortDescription\}<\/p>/);
  assert.doesNotMatch(shortDescription, /Équivalent textuel complet/);
  assert.match(fullDescription, /Lire la description de l’illustration[^]*Équivalent textuel complet/);
  assert.doesNotMatch(fullDescription, /id=\{shortDescriptionId\}/);
  assert.match(scenes, /<details[^>]*>[^]*Lire la description de l’illustration[^]*Équivalent textuel complet/);
  assert.doesNotMatch(scenes, /<details[^>]*>[^]*id=\{shortDescriptionId\}/);
  assert.doesNotMatch(scenes, /<details[^>]*\sopen(?:=|\s|>)/);
  for (const name of ["WelcomeSituationScene", "WelcomePrincipleScene", "WelcomeEntryScene", "WelcomeHandoffScene"]) {
    const scene = scenes.slice(scenes.indexOf(`export function ${name}`));
    assert.match(scene, /<SceneFrame[^>]*shortDescription=/);
    assert.match(scene, /text=/);
  }
  const entryScene = scenes.slice(scenes.indexOf("export function WelcomeEntryScene"), scenes.indexOf("export function WelcomeHandoffScene"));
  assert.match(entryScene, /showDetails=\{false\}/);
  assert.doesNotMatch(entryScene, /<details|<button|onClick/);
  assert.match(scenes, /<p id=\{shortDescriptionId\} className="sr-only">\{text\}<\/p>/);
});

test("separates manual stop from contextual audio reset", () => {
  const stop = audio.slice(audio.indexOf("const stop"), audio.indexOf("const reset"));
  const resetStart = audio.indexOf("const reset");
  const reset = audio.slice(resetStart, audio.indexOf("useEffect", resetStart));
  assert.match(stop, /cancelActiveSession\(\)[^]*setState/);
  assert.doesNotMatch(stop, /setTranscript/);
  assert.match(reset, /cancelActiveSession\(\)[^]*setState[^]*setTranscript\(""\)/);
  assert.match(audio, /return \{ state, transcript, chimeEnabled, isIntroducing, setChimeEnabled, play, pause, resume, stop, reset \}/);

  const modeHandler = discovery.slice(discovery.indexOf("function changeMode"), discovery.indexOf("function changeDiscoverStep"));
  const stepHandler = discovery.slice(discovery.indexOf("function changeDiscoverStep"), discovery.indexOf("function changeReducedMotion"));
  assert.match(modeHandler, /audio\.reset\(\)/);
  assert.match(stepHandler, /audio\.reset\(\)/);
  assert.doesNotMatch(modeHandler + stepHandler, /audio\.stop\(\)/);
  assert.match(discovery, /onStopAudio=\{audio\.stop\}/);
  assert.match(discovery, /onNavigate=\{audio\.reset\}/g);
  assert.match(discovery, /<Link href=\{entry\.route\} onClick=\{onNavigate\}/);
});

test("makes the first scene tell a calm dispersed-to-common-frame story", () => {
  assert.match(scenes, /Éléments dispersés/);
  assert.match(scenes, /Cadre commun Goodissima/);
  assert.match(scenes, /Tout reste distinct, mais devient plus simple à suivre\./);
  assert.match(css, /\.situationInitial/);
  assert.match(css, /\.goodissimaFrame/);
  assert.match(scenes, /aria-hidden="true"[^>]*>\s*<span className="sm:hidden">↓<\/span><span className="hidden sm:inline">→<\/span>/);
  assert.doesNotMatch(css, /rotate\s*\(/);
});

test("guards current utterance callbacks and neutralizes stale callbacks before cancel", () => {
  assert.match(audio, /if \(utteranceRef\.current !== utterance\) return/g);
  const cancelHelper = audio.slice(audio.indexOf("const cancelActiveSession"), audio.indexOf("const stop"));
  assert.match(cancelHelper, /activeUtterance\.onend = null[^]*activeUtterance\.onerror = null[^]*utteranceRef\.current = null[^]*cancel\(\)/);
  const cleanup = audio.slice(audio.indexOf("return \(\) => {"), audio.indexOf("const play"));
  assert.match(cleanup, /activeUtterance\.onend = null[^]*activeUtterance\.onerror = null[^]*utteranceRef\.current = null[^]*cancel\(\)/);
});

test("adds no persistence, external service or automatic navigation", () => {
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie|cookies\s*\(/);
  assert.doesNotMatch(source, /router\.(?:push|replace)|useRouter|setTimeout|requestAnimationFrame/);
  assert.doesNotMatch(source, /fetch\s*\(|\/api\/|Mistral|Repository|repository/);
  assert.doesNotMatch(source, /<audio\b|\.mp3|\.wav|https?:\/\//i);
});
