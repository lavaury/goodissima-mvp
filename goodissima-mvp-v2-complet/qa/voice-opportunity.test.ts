import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parseVoiceAuditInput,
  mergeVoiceTranscript,
  voiceAuditRecord,
  voiceFeatureSupported,
  voiceRevisionContext,
} from "../lib/voice-opportunity.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const transcript = "Je recherche un locataire pour un T3 de 70 mètres carrés à Beauvais avec un budget de 900 euros.";

test("ingests a French voice transcript for proposal generation", () => {
  const audit = parseVoiceAuditInput({ mode: "generation", transcript, capturedAt: "2026-06-15T12:00:00.000Z", proposalVersion: 1 }, "generation");
  assert.equal(audit?.transcript, transcript);
  assert.equal(audit?.proposalVersion, 1);
});

test("rejects malformed or mismatched voice audit input", () => {
  assert.equal(parseVoiceAuditInput({ mode: "refinement", transcript, capturedAt: "invalid" }, "generation"), null);
  assert.equal(parseVoiceAuditInput(null, "generation"), null);
});

test("resolves contextual voice references against the current proposal", () => {
  const context = voiceRevisionContext({ transcript: "Modifie la deuxième étape.", proposalVersion: 2, stageNames: ["Cadrage", "Visite", "Validation"] });
  assert.match(context, /proposition v2/);
  assert.match(context, /2\. Visite/);
  assert.match(context, /dernière version/);
});

test("stores transcript, timestamp, proposal version and resulting changes", () => {
  const input = parseVoiceAuditInput({ mode: "refinement", transcript: "Ajoute une visite virtuelle.", capturedAt: "2026-06-15T12:05:00.000Z", confirmedAt: "2026-06-15T12:06:00.000Z", proposalVersion: 3 }, "refinement");
  assert.ok(input);
  const audit = voiceAuditRecord(input, { added: ["Étapes : Visite virtuelle"], modified: [], removed: [] });
  assert.deepEqual(audit.resultingChanges.added, ["Étapes : Visite virtuelle"]);
  assert.equal(audit.confirmedAt, "2026-06-15T12:06:00.000Z");
});

test("uses the existing text generation and refinement pipelines", () => {
  const designer = source("components/AITemplateDesigner.tsx");
  assert.match(designer, /fetch\("\/api\/templates\/ai-generate"/);
  assert.match(designer, /fetch\(`\/api\/templates\/ai-generate\/\$\{generationId\}\/revise`/);
  assert.match(designer, /voiceAudit:/);
  assert.match(designer, /proposalHistory\.length \+ 1/);
});

test("requires confirmation before applying a voice or keyboard revision", () => {
  const designer = source("components/AITemplateDesigner.tsx");
  assert.match(designer, /Voici ce que je vais modifier\./);
  assert.match(designer, /"Confirmer"/);
  assert.match(designer, />Annuler<\/button>/);
  assert.match(designer, /if \(!generationId \|\| !draft \|\| !pendingRevision\) return/);
});

test("attaches voice history to the existing TemplateGeneration audit trail", () => {
  const persistence = source("lib/ai/template-designer.ts");
  const generationRoute = source("app/api/templates/ai-generate/route.ts");
  const revisionRoute = source("app/api/templates/ai-generate/[generationId]/revise/route.ts");
  assert.match(persistence, /voiceAudit: voiceAuditRecord/);
  assert.match(persistence, /changes: changes as unknown as Prisma\.InputJsonValue/);
  assert.match(generationRoute, /voiceAuditStored/);
  assert.match(revisionRoute, /voiceAuditStored/);
});

test("keeps voice optional and provides responsive keyboard fallback", () => {
  const capture = source("components/VoiceCaptureButton.tsx");
  assert.equal(voiceFeatureSupported({ webkitSpeechRecognition: class {} }), true);
  assert.equal(voiceFeatureSupported({}), false);
  assert.match(capture, /if \(supported === false\) return null/);
  assert.match(capture, /w-full sm:w-auto/);
  assert.match(capture, /min-h-11/);
  assert.match(capture, /lang = "fr-FR"/);
  assert.match(capture, /function MicrophoneIcon/);
  assert.match(capture, /viewBox="0 0 24 24"/);
  assert.match(capture, /Parlez distinctement près du micro, puis relisez votre réponse avant d’envoyer\./);
});

test("starts and stops listening only through explicit user actions", () => {
  const capture = source("components/VoiceCaptureButton.tsx");
  assert.match(capture, /function startListening\(\)/);
  assert.match(capture, /wantsListeningRef\.current = true/);
  assert.match(capture, /function stopListening\(\)/);
  assert.match(capture, /wantsListeningRef\.current = false/);
  assert.match(capture, /recognitionRef\.current\.stop\(\)/);
  assert.match(capture, /active \? stopListening : startListening/);
  assert.match(capture, /Arrêter l'écoute/);
});

test("accumulates final and interim transcripts across recognition sessions", () => {
  const capture = source("components/VoiceCaptureButton.tsx");
  assert.match(capture, /finalTranscriptRef\.current = \[finalTranscriptRef\.current, segment\]/);
  assert.match(capture, /interimTranscriptRef\.current = interim/);
  assert.match(capture, /finalTranscriptRef\.current = \[finalTranscriptRef\.current, interimTranscriptRef\.current\]/);
  assert.match(capture, /\[finalTranscriptRef\.current, interimTranscriptRef\.current\]/);
});

test("does not use a short timeout to stop voice capture", () => {
  const capture = source("components/VoiceCaptureButton.tsx");
  assert.match(capture, /continuous = true/);
  assert.doesNotMatch(capture, /setTimeout\(\(\) => \{[\s\S]{0,300}\.stop\(\)/);
});

test("safely restarts when the browser ends recognition unexpectedly", () => {
  const capture = source("components/VoiceCaptureButton.tsx");
  assert.match(capture, /recognition\.onend/);
  assert.match(capture, /if \(wantsListeningRef\.current\)/);
  assert.match(capture, /startRecognition\(\)/);
  assert.match(capture, /not-allowed/);
  assert.match(capture, /service-not-allowed/);
});

test("preserves existing textarea content when dictation completes", () => {
  assert.equal(mergeVoiceTranscript("Texte déjà saisi.", "Ajoute une visite virtuelle."), "Texte déjà saisi. Ajoute une visite virtuelle.");
  assert.equal(mergeVoiceTranscript("", "Nouvelle dictée"), "Nouvelle dictée");
  const designer = source("components/AITemplateDesigner.tsx");
  assert.match(designer, /setDescription\(\(current\) => mergeVoiceTranscript\(current, transcript\)\)/);
});

test("supports cancelling dictation without inserting or generating", () => {
  const capture = source("components/VoiceCaptureButton.tsx");
  const designer = source("components/AITemplateDesigner.tsx");
  assert.match(capture, /Annuler la dictée/);
  assert.match(capture, /cancelledRef\.current = true/);
  assert.match(capture, /if \(cancelledRef\.current\) return/);
  assert.doesNotMatch(designer, /onTranscript=\{[^}]*generate\(/);
});

test("shows microphone guidance, status and a short test action", () => {
  const capture = source("components/VoiceCaptureButton.tsx");
  assert.match(capture, /Micro actif/);
  assert.match(capture, /Son faible détecté, rapprochez-vous du micro/);
  assert.match(capture, /Écoute en cours/);
  assert.match(capture, /Tester mon micro/);
  assert.match(capture, /function testMicrophone\(\)/);
  assert.match(capture, /getUserMedia\(\{ audio: true \}\)/);
  assert.match(capture, /createAnalyser\(\)/);
});

test("microphone test does not insert transcript or auto-generate", () => {
  const capture = source("components/VoiceCaptureButton.tsx");
  const designer = source("components/AITemplateDesigner.tsx");
  assert.doesNotMatch(capture, /testMicrophone[\s\S]*onTranscript\(/);
  assert.doesNotMatch(capture, /testMicrophone[\s\S]*fetch\(/);
  assert.doesNotMatch(designer, /onTranscript=\{[^}]*generate\(/);
});

test("does not introduce automatic publication, decisions or contact", () => {
  const designer = source("components/AITemplateDesigner.tsx");
  const refinement = source("lib/ai/template-designer.ts");
  assert.match(designer, /Elle ne publie rien et ne contacte personne/);
  assert.match(refinement, /ne publie rien, ne contacte personne/);
});
