import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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
  assert.match(discovery, /function changeMode[^]*audio\.stop\(\)/);
  assert.match(discovery, /onClick=\{onNavigate\}/);
  assert.doesNotMatch(audio, /fetch\s*\(|AudioContext|MediaRecorder|getUserMedia/);
});

test("preserves pause across steps and makes restart explicitly resume animation", () => {
  const stepHandler = discovery.slice(discovery.indexOf("function changeDiscoverStep"), discovery.indexOf("function changeReducedMotion"));
  assert.match(stepHandler, /audio\.stop\(\)/);
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

test("uses honest animation status and autonomous h2 media headings", () => {
  assert.match(controls, /<h2[^>]*>Animation<\/h2>/);
  assert.match(controls, /<h2[^>]*>Présentation sonore facultative<\/h2>/);
  for (const status of ["État final statique affiché.", "Animations suspendues.", "Animations autorisées pour la scène visible."]) assert.ok(controls.includes(status));
  assert.doesNotMatch(controls, /prête ou en lecture|Animation en pause/);
});

test("guards current utterance callbacks and neutralizes stale callbacks before cancel", () => {
  assert.match(audio, /if \(utteranceRef\.current !== utterance\) return/g);
  const cancelHelper = audio.slice(audio.indexOf("const cancelActiveUtterance"), audio.indexOf("const stop"));
  assert.match(cancelHelper, /activeUtterance\.onend = null[^]*activeUtterance\.onerror = null[^]*utteranceRef\.current = null[^]*cancel\(\)/);
  const cleanup = audio.slice(audio.indexOf("return \(\) => {"), audio.indexOf("const play"));
  assert.match(cleanup, /activeUtterance\.onend = null[^]*activeUtterance\.onerror = null[^]*utteranceRef\.current = null[^]*cancel\(\)/);
});

test("adds no persistence, external service or automatic navigation", () => {
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie|cookies\s*\(/);
  assert.doesNotMatch(source, /router\.(?:push|replace)|useRouter|setTimeout|requestAnimationFrame/);
  assert.doesNotMatch(source, /fetch\s*\(|\/api\/|Mistral|Repository|repository/);
  assert.doesNotMatch(source, /<audio|\.mp3|\.wav|https?:\/\//i);
});
