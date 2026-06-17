import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("conversation composer exposes compact voice dictation beside the message textarea", () => {
  const chat = source("components/ChatBox.tsx");
  assert.match(chat, /import \{ VoiceCaptureButton \}/);
  assert.match(chat, /import \{ mergeVoiceTranscript \}/);
  assert.match(chat, /useRef<HTMLTextAreaElement>/);
  assert.match(chat, /<textarea/);
  assert.match(chat, /label="Dicter ma réponse"/);
  assert.match(chat, /\bcompact\b/);
  assert.match(chat, /sm:flex-row sm:items-end/);
});

test("conversation dictation populates the editable message without auto-send", () => {
  const chat = source("components/ChatBox.tsx");
  assert.match(chat, /setBody\(\(current\) => mergeVoiceTranscript\(current, transcript\)\)/);
  assert.match(chat, /requestAnimationFrame\(\(\) => inputRef\.current\?\.focus\(\)\)/);
  assert.match(chat, /onClick=\{sendMessage\}/);
  assert.match(chat, /event\.key === "Enter" && !event\.shiftKey/);

  const voiceBlock = chat.match(/<VoiceCaptureButton[\s\S]*?\/>/)?.[0] ?? "";
  assert.doesNotMatch(voiceBlock, /sendMessage\(/);
  assert.doesNotMatch(voiceBlock, /fetch\(/);
});

test("conversation voice status is visible and uses the existing browser implementation", () => {
  const capture = source("components/VoiceCaptureButton.tsx");
  assert.match(capture, /window\.SpeechRecognition \?\? window\.webkitSpeechRecognition/);
  assert.match(capture, /VOICE_STATUS_LABELS\.listening/);
  assert.match(capture, /VOICE_STATUS_LABELS\.transcriptionReady/);
  assert.match(capture, /continuous = true/);
});

test("conversation dictation does not add AI processing or AI costs", () => {
  const chat = source("components/ChatBox.tsx");
  assert.match(chat, /fetch\("\/api\/messages"/);
  assert.doesNotMatch(chat, /ai-generate/);
  assert.doesNotMatch(chat, /recordAI/i);
  assert.doesNotMatch(chat, /aiCost/i);
  assert.doesNotMatch(chat, /observability/i);
});
