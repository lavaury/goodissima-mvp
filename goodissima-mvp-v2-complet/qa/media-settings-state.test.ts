import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  defaultMediaSettings,
  loadMediaSettings,
  mediaSettingsStorageKey,
  persistMediaPreferences,
} from "../lib/media/media-settings.ts";

const room = readFileSync(new URL("../components/media/GoodissimaMediaRoom.tsx", import.meta.url), "utf8");

test("local preferences retain devices and reusable background but never media activation", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  persistMediaPreferences(storage, {
    preferredCameraDeviceId: "camera-a",
    preferredMicrophoneDeviceId: "microphone-b",
    preferredAudioOutputDeviceId: "speaker-c",
    cameraEnabled: true,
    microphoneEnabled: true,
    backgroundMode: "BLUR",
  });
  const raw = values.get(mediaSettingsStorageKey) ?? "";
  assert.doesNotMatch(raw, /cameraEnabled|microphoneEnabled|IMAGE|token/);
  assert.deepEqual(loadMediaSettings(storage), {
    ...defaultMediaSettings(),
    preferredCameraDeviceId: "camera-a",
    preferredMicrophoneDeviceId: "microphone-b",
    preferredAudioOutputDeviceId: "speaker-c",
    backgroundMode: "BLUR",
  });
});

test("prejoin and room share one media state and publish the prepared camera track", () => {
  assert.match(room, /useState<MediaSettings>/);
  assert.doesNotMatch(room, /cameraWanted|microphoneWanted/);
  assert.match(room, /const previewTrack = previewTrackRef\.current/);
  assert.match(room, /publishTrack\(previewTrack, \{ source: Track\.Source\.Camera \}\)/);
  assert.match(room, /microphoneId \? \{ deviceId: microphoneId \}/);
  assert.match(room, /cameraId \? \{ deviceId: cameraId \}/);
});

test("camera, microphone and speaker switch live without reconnecting", () => {
  const changeDevice = room.slice(room.indexOf("async function changeDevice"), room.indexOf("async function leave"));
  assert.match(changeDevice, /room\.switchActiveDevice\(kind, resolvedDeviceId, false\)/);
  assert.match(changeDevice, /kind === "videoinput"/);
  assert.match(changeDevice, /applyBackground\(background\)/);
  assert.doesNotMatch(changeDevice, /room\.connect|disconnect/);
  for (const kind of ["videoinput", "audioinput", "audiooutput"])
    assert.match(room, new RegExp(`changeDevice\\("${kind}"`));
});

test("background changes remain deferred while camera is off and survive camera replacement", () => {
  assert.match(room, /if \(!\(track instanceof LocalVideoTrack\)\) \{[\s\S]*updateMedia\(\{ backgroundMode: mode \}\)/);
  assert.match(room, /if \(background !== "NONE"\) await applyBackground\(background\)/);
  assert.match(room, /mode === "BLUR" \? BackgroundBlur\(10\) : VirtualBackground\(currentImageUrl!\)/);
  assert.match(room, /imageUrlRef\.current = URL\.createObjectURL\(file\)/);
  assert.match(room, /URL\.revokeObjectURL\(imageUrlRef\.current\)/);
});

test("LiveKit events drive the displayed camera and microphone state", () => {
  assert.match(room, /const syncLiveState = \(\) => updateMedia/);
  assert.match(room, /getTrackPublication\(Track\.Source\.Camera\)/);
  assert.match(room, /getTrackPublication\(Track\.Source\.Microphone\)/);
  assert.match(room, /RoomEvent\.TrackMuted/);
  assert.match(room, /RoomEvent\.TrackUnmuted/);
});

test("generic media settings contain no Journey, RSVP or opportunity policy", () => {
  for (const term of ["GovernedJourney", "JourneyConsent", "MeetingRsvp", "Opportunity", "SimpleLink"])
    assert.doesNotMatch(room, new RegExp(term));
});
