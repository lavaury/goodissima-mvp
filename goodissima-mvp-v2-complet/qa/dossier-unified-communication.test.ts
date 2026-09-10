import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const launcher = source("components/DossierCommunicationLauncher.tsx");
const workspace = source("components/RelationCaseWorkspace.tsx");
const livekit = source("components/RelationLiveKitMediaRoom.tsx");
const tabs = source("components/DossierWorkspaceTabs.tsx");
const boussole = source("components/ContextualBoussole.tsx");

test("Conversation exposes the four communication modalities at the same level", () => {
  for (const label of ["Message", "Audio", "Vidéo", "Partager l’écran"]) assert.ok(launcher.includes(label));
  assert.match(launcher, /grid-cols-2/);
  assert.match(launcher, /sm:grid-cols-4/);
  assert.match(launcher, /min-h-11/);
  assert.match(workspace, /dossier-panel-conversation[\s\S]*DossierCommunicationLauncher[\s\S]*ChatBox/);
});

test("media opens in an accessible local window without automatic device activation", () => {
  assert.match(launcher, /createPortal/);
  assert.match(launcher, /role="dialog"/);
  assert.match(launcher, /aria-modal="true"/);
  assert.match(launcher, /event\.key === "Escape"/);
  assert.match(launcher, /event\.key === "Tab"/);
  assert.match(launcher, /setMode\(item\.id\)/);
  assert.doesNotMatch(launcher, /setMicrophoneEnabled|setCameraEnabled|setScreenShareEnabled|getUserMedia|getDisplayMedia/);
  assert.match(livekit, /onClick=\{\(\) => toggleMedia\("microphone"\)\}/);
  assert.match(livekit, /onClick=\{\(\) => toggleMedia\("camera"\)\}/);
  assert.match(livekit, /onClick=\{\(\) => toggleMedia\("screen"\)\}/);
});

test("non-active governance keeps history readable and disables new communication", () => {
  assert.match(workspace, /enabled=\{relationWritable\}/);
  assert.match(workspace, /disabledReason=\{governanceBlockedMessage\}/);
  assert.match(launcher, /disabled=\{!enabled\}/);
  assert.match(launcher, /role="status"/);
  assert.match(workspace, /data-dossier-tab-content="conversation"[\s\S]*case-communication-history/);
});

test("media history moved out of Details and fallback remains available", () => {
  assert.doesNotMatch(workspace, /data-dossier-section="communication"/);
  assert.doesNotMatch(workspace, /Communication avancée/);
  assert.match(workspace, /Historique des communications/);
  assert.match(launcher, /RelationLiveKitMediaRoom/);
  assert.match(launcher, /RelationSecureMediaRoom/);
  assert.match(launcher, /!liveKitConfigured/);
});

test("Boussole reveals Conversation and the requested real media surface without starting it", () => {
  assert.match(launcher, /goodissima:reveal-dossier-target/);
  assert.match(launcher, /setMode\("audio"\)/);
  assert.match(tabs, /case-secure-media-room/);
  assert.match(tabs, /selectTab\("conversation"\)/);
  assert.match(boussole, /await new Promise<void>/);
});
