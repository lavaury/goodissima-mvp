import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("public candidate textareas expose optional voice dictation", () => {
  const renderer = source("components/DynamicFormRenderer.tsx");

  assert.match(renderer, /case "TEXTAREA"/);
  assert.match(renderer, /<VoiceCaptureButton/);
  assert.match(renderer, /label="Dicter ma réponse"/);
  assert.match(renderer, /sm:flex-row sm:items-start/);
});

test("candidate transcript fills the textarea and remains editable", () => {
  const renderer = source("components/DynamicFormRenderer.tsx");

  assert.match(renderer, /mergeVoiceTranscript\(getStringFieldValue\(values\[field\.key\]\), transcript\)/);
  assert.match(renderer, /onChange\(field\.key, mergeVoiceTranscript/);
  assert.match(renderer, /<textarea/);
  assert.match(renderer, /onChange=\{\(e\) => onChange\(field\.key, e\.target\.value\)\}/);
});

test("candidate voice input never auto-submits or creates a relation", () => {
  const renderer = source("components/DynamicFormRenderer.tsx");
  const voiceBlock = renderer.match(/<VoiceCaptureButton[\s\S]*?\/>/)?.[0] ?? "";

  assert.doesNotMatch(voiceBlock, /submit\(/i);
  assert.doesNotMatch(voiceBlock, /fetch\(/);
  assert.doesNotMatch(voiceBlock, /\/api\/cases/);
});

test("voice controls are hidden when browser speech recognition is unsupported", () => {
  const capture = source("components/VoiceCaptureButton.tsx");

  assert.match(capture, /setSupported\(voiceFeatureSupported\(window\)\)/);
  assert.match(capture, /if \(supported === false\) return null/);
});

test("candidate voice statuses and helper use requested wording", () => {
  const capture = source("components/VoiceCaptureButton.tsx");
  const voice = source("lib/voice-opportunity.ts");

  assert.match(capture, /Micro actif/);
  assert.match(capture, /Écoute en cours/);
  assert.match(voice, /Transcription prête/);
  assert.match(capture, /Son faible détecté, rapprochez-vous du micro/);
  assert.match(capture, /Parlez distinctement près du micro, puis relisez votre réponse avant d’envoyer/);
});

test("audio is not sent or stored by candidate form submission", () => {
  const form = source("app/l/[slug]/candidate-form.tsx");
  const renderer = source("components/DynamicFormRenderer.tsx");
  const capture = source("components/VoiceCaptureButton.tsx");

  assert.doesNotMatch(form, /audio|voiceAudit|capturedAt|transcript/i);
  assert.doesNotMatch(renderer, /audio|voiceAudit|capturedAt/i);
  assert.doesNotMatch(capture, /fetch\(/);
});
