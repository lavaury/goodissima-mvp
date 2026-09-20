export type MediaBackgroundMode = "NONE" | "BLUR" | "IMAGE";

export type MediaSettings = {
  preferredCameraDeviceId: string;
  preferredMicrophoneDeviceId: string;
  preferredAudioOutputDeviceId: string;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  backgroundMode: MediaBackgroundMode;
};

export const mediaSettingsStorageKey = "goodissima.media.settings.v1";

export function defaultMediaSettings(): MediaSettings {
  return {
    preferredCameraDeviceId: "",
    preferredMicrophoneDeviceId: "",
    preferredAudioOutputDeviceId: "",
    cameraEnabled: false,
    microphoneEnabled: false,
    backgroundMode: "NONE",
  };
}

export function loadMediaSettings(storage: Pick<Storage, "getItem"> | undefined): MediaSettings {
  const defaults = defaultMediaSettings();
  if (!storage) return defaults;
  try {
    const value = JSON.parse(storage.getItem(mediaSettingsStorageKey) || "{}") as Partial<MediaSettings>;
    return {
      ...defaults,
      preferredCameraDeviceId: typeof value.preferredCameraDeviceId === "string" ? value.preferredCameraDeviceId : "",
      preferredMicrophoneDeviceId: typeof value.preferredMicrophoneDeviceId === "string" ? value.preferredMicrophoneDeviceId : "",
      preferredAudioOutputDeviceId: typeof value.preferredAudioOutputDeviceId === "string" ? value.preferredAudioOutputDeviceId : "",
      backgroundMode: value.backgroundMode === "BLUR" ? "BLUR" : "NONE",
    };
  } catch {
    return defaults;
  }
}

export function persistMediaPreferences(storage: Pick<Storage, "setItem"> | undefined, settings: MediaSettings) {
  if (!storage) return;
  try {
    storage.setItem(mediaSettingsStorageKey, JSON.stringify({
      preferredCameraDeviceId: settings.preferredCameraDeviceId,
      preferredMicrophoneDeviceId: settings.preferredMicrophoneDeviceId,
      preferredAudioOutputDeviceId: settings.preferredAudioOutputDeviceId,
      backgroundMode: settings.backgroundMode === "BLUR" ? "BLUR" : "NONE",
    }));
  } catch {
    // Local preferences are optional and must never block a meeting.
  }
}
