"use client";

import { useEffect, useRef, useState } from "react";
import {
  BackgroundBlur,
  VirtualBackground,
  supportsBackgroundProcessors,
} from "@livekit/track-processors";
import {
  createLocalVideoTrack,
  DisconnectReason,
  LocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type TrackPublication,
} from "livekit-client";

export type MediaRoomCapabilities = {
  canJoin: boolean;
  canEnd: boolean;
  tokenEndpoint: string;
  tokenBody?: Record<string, unknown>;
  usageEndpoint?: string;
  attendanceEndpoint?: string;
  endEndpoint?: string;
};
export type MediaRoomExpectedPerson = {
  identity: string;
  displayName: string;
  roleLabel: string;
  accessKind: string;
};
type TokenResponse = {
  livekitUrl?: string;
  token?: string;
  communicationSessionId?: string;
  error?: string;
};
type BackgroundMode = "none" | "blur" | "image";

function humanMediaError(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError")
    return "L’autorisation de la caméra ou du micro a été refusée.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "Le périphérique sélectionné n’est plus disponible.";
  return "La connexion à la réunion n’a pas pu être établie.";
}

function presentation(participant: Participant) {
  try {
    const data = JSON.parse(participant.metadata || "{}") as Record<
      string,
      unknown
    >;
    return typeof data.displayName === "string"
      ? data.displayName
      : participant.name || "Participant";
  } catch {
    return participant.name || "Participant";
  }
}

function MediaTrack({
  publication,
  muted,
}: {
  publication: TrackPublication;
  muted?: boolean;
}) {
  const ref = useRef<HTMLMediaElement | null>(null);
  useEffect(() => {
    const element = ref.current;
    const track = publication.track;
    if (!element || !track) return;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [publication.track]);
  if (!publication.track) return null;
  if (publication.kind === Track.Kind.Audio)
    return (
      <audio
        ref={ref as React.RefObject<HTMLAudioElement>}
        autoPlay
        muted={muted}
      />
    );
  return (
    <video
      ref={ref as React.RefObject<HTMLVideoElement>}
      autoPlay
      muted={muted}
      playsInline
      className="h-full w-full rounded-xl bg-slate-950 object-contain"
    />
  );
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function PersonTile({
  participant,
  local,
}: {
  participant: Participant;
  local: boolean;
}) {
  const publications = [...participant.trackPublications.values()];
  const videos = publications.filter(
    (item) => item.track && item.kind === Track.Kind.Video,
  );
  const audios = local
    ? []
    : publications.filter(
        (item) => item.track && item.kind === Track.Kind.Audio,
      );
  const name = presentation(participant);
  return (
    <article
      className={`relative min-h-52 rounded-2xl border bg-slate-900 p-2 text-white ${participant.isSpeaking ? "ring-4 ring-cyan-400" : "border-slate-700"}`}
      aria-label={`${local ? "Vous, " : ""}${name}${participant.isSpeaking ? ", parle actuellement" : ""}`}
    >
      {videos.length ? (
        <div className="grid h-full gap-2">
          {videos.map((publication) => (
            <div
              key={publication.trackSid}
              className={
                publication.source === Track.Source.ScreenShare
                  ? "min-h-64 md:col-span-2"
                  : "min-h-44"
              }
            >
              <MediaTrack publication={publication} muted={local} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid min-h-44 place-items-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-cyan-800 text-2xl font-bold">
            {initials(name)}
          </span>
        </div>
      )}
      {audios.map((publication) => (
        <MediaTrack key={publication.trackSid} publication={publication} />
      ))}
      <p className="absolute bottom-3 left-3 rounded bg-slate-950/75 px-2 py-1 text-sm font-semibold">
        {local ? "Vous · " : ""}
        {name} ·{" "}
        {publications.some(
          (item) => item.source === Track.Source.Microphone && !item.isMuted,
        )
          ? "Micro activé"
          : "Micro coupé"}
      </p>
    </article>
  );
}

export function GoodissimaMediaRoom({
  capabilities,
  expectedPeople = [],
  title = "Réunion",
  joinLabel = "Rejoindre la réunion",
}: {
  capabilities: MediaRoomCapabilities;
  expectedPeople?: MediaRoomExpectedPerson[];
  title?: string;
  joinLabel?: string;
}) {
  const roomRef = useRef<Room | null>(null);
  const previewTrackRef = useRef<LocalVideoTrack | null>(null);
  const previewElementRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<string | null>(null);
  const imageUrlRef = useRef<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraWanted, setCameraWanted] = useState(false);
  const [microphoneWanted, setMicrophoneWanted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [screenEnabled, setScreenEnabled] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [microphoneId, setMicrophoneId] = useState("");
  const [speakerId, setSpeakerId] = useState("");
  const [background, setBackground] = useState<BackgroundMode>(() =>
    typeof window === "undefined"
      ? "none"
      : (localStorage.getItem(
          "goodissima.media.background",
        ) as BackgroundMode) || "none",
  );
  const [backgroundAvailable, setBackgroundAvailable] = useState(false);
  const [, render] = useState(0);

  useEffect(() => {
    setBackgroundAvailable(supportsBackgroundProcessors());
    navigator.mediaDevices
      ?.enumerateDevices()
      .then(setDevices)
      .catch(() => setDevices([]));
    return () => {
      roomRef.current?.disconnect();
      previewTrackRef.current?.stop();
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    };
  }, []);
  function refresh() {
    render((value) => value + 1);
  }

  async function request(endpoint: string, body: Record<string, unknown>) {
    return fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  async function markUsage(usage: "audio" | "video" | "screen") {
    if (capabilities.usageEndpoint && sessionRef.current)
      await request(capabilities.usageEndpoint, {
        communicationSessionId: sessionRef.current,
        usage,
      }).catch(() => null);
  }
  async function attendance(event: "join" | "leave") {
    if (capabilities.attendanceEndpoint && sessionRef.current)
      await request(capabilities.attendanceEndpoint, {
        communicationSessionId: sessionRef.current,
        event,
      }).catch(() => null);
  }

  async function applyBackground(mode: BackgroundMode, imageUrl?: string) {
    const publication = roomRef.current?.localParticipant.getTrackPublication(
      Track.Source.Camera,
    );
    const track = publication?.track ?? previewTrackRef.current;
    if (!(track instanceof LocalVideoTrack)) return;
    if (mode === "none") await track.stopProcessor();
    else if (!backgroundAvailable) throw new Error("background-unavailable");
    else
      await track.setProcessor(
        mode === "blur" ? BackgroundBlur(10) : VirtualBackground(imageUrl!),
      );
    setBackground(mode);
    localStorage.setItem(
      "goodissima.media.background",
      mode === "image" ? "none" : mode,
    );
  }

  async function togglePreview() {
    setError(null);
    if (previewTrackRef.current) {
      previewTrackRef.current.detach();
      previewTrackRef.current.stop();
      previewTrackRef.current = null;
      setCameraWanted(false);
      return;
    }
    try {
      const track = await createLocalVideoTrack(
        cameraId ? { deviceId: cameraId } : undefined,
      );
      previewTrackRef.current = track;
      setCameraWanted(true);
      if (previewElementRef.current) track.attach(previewElementRef.current);
      if (background !== "none") await applyBackground(background);
      navigator.mediaDevices
        .enumerateDevices()
        .then(setDevices)
        .catch(() => null);
    } catch (cause) {
      setCameraWanted(false);
      setError(humanMediaError(cause));
    }
  }

  async function join() {
    if (connecting || joined) return;
    setConnecting(true);
    setError(null);
    try {
      previewTrackRef.current?.detach();
      previewTrackRef.current?.stop();
      previewTrackRef.current = null;
      const response = await request(
        capabilities.tokenEndpoint,
        capabilities.tokenBody ?? {},
      );
      const payload = (await response.json()) as TokenResponse;
      if (
        !response.ok ||
        !payload.livekitUrl ||
        !payload.token ||
        !payload.communicationSessionId
      )
        throw new Error(payload.error || "join-failed");
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      sessionRef.current = payload.communicationSessionId;
      [
        RoomEvent.ParticipantConnected,
        RoomEvent.ParticipantDisconnected,
        RoomEvent.TrackSubscribed,
        RoomEvent.TrackUnsubscribed,
        RoomEvent.ActiveSpeakersChanged,
        RoomEvent.TrackMuted,
        RoomEvent.TrackUnmuted,
      ].forEach((event) => room.on(event, refresh));
      room.on(RoomEvent.Disconnected, (reason) => {
        setJoined(false);
        setCameraEnabled(false);
        setMicrophoneEnabled(false);
        if (reason === DisconnectReason.ROOM_DELETED)
          setError("Cette réunion est terminée.");
        refresh();
      });
      await room.connect(payload.livekitUrl, payload.token, {
        autoSubscribe: true,
      });
      if (microphoneWanted) {
        await room.localParticipant.setMicrophoneEnabled(
          true,
          microphoneId ? { deviceId: microphoneId } : undefined,
        );
        setMicrophoneEnabled(true);
        await markUsage("audio");
      }
      if (cameraWanted) {
        await room.localParticipant.setCameraEnabled(
          true,
          cameraId ? { deviceId: cameraId } : undefined,
        );
        setCameraEnabled(true);
        await markUsage("video");
        if (background !== "none") await applyBackground(background);
      }
      if (speakerId) await room.switchActiveDevice("audiooutput", speakerId);
      setJoined(true);
      await attendance("join");
      refresh();
    } catch (cause) {
      roomRef.current?.disconnect();
      setError(humanMediaError(cause));
    } finally {
      setConnecting(false);
    }
  }

  async function toggle(kind: "microphone" | "camera" | "screen") {
    const room = roomRef.current;
    if (!room || pending) return;
    setPending(true);
    setError(null);
    try {
      if (kind === "microphone") {
        const next = !microphoneEnabled;
        await room.localParticipant.setMicrophoneEnabled(
          next,
          microphoneId ? { deviceId: microphoneId } : undefined,
        );
        setMicrophoneEnabled(next);
        if (next) await markUsage("audio");
      } else if (kind === "camera") {
        const next = !cameraEnabled;
        await room.localParticipant.setCameraEnabled(
          next,
          cameraId ? { deviceId: cameraId } : undefined,
        );
        setCameraEnabled(next);
        if (next) {
          await markUsage("video");
          if (background !== "none") await applyBackground(background);
        }
      } else {
        const next = !screenEnabled;
        await room.localParticipant.setScreenShareEnabled(next);
        setScreenEnabled(next);
        if (next) await markUsage("screen");
      }
      refresh();
    } catch (cause) {
      setError(humanMediaError(cause));
    } finally {
      setPending(false);
    }
  }
  async function leave() {
    await attendance("leave");
    roomRef.current?.disconnect();
    setJoined(false);
  }
  async function end() {
    if (!capabilities.endEndpoint || !sessionRef.current || pending) return;
    setPending(true);
    try {
      const response = await request(capabilities.endEndpoint, {
        sessionId: sessionRef.current,
        reason: "Réunion terminée explicitement par l’organisateur.",
      });
      if (!response.ok) throw new Error();
      roomRef.current?.disconnect();
      setJoined(false);
    } catch {
      setError("La réunion n’a pas pu être terminée.");
    } finally {
      setPending(false);
    }
  }
  async function chooseImage(file: File | undefined) {
    if (
      !file ||
      !/^image\/(jpeg|png|webp)$/.test(file.type) ||
      file.size > 8_000_000
    ) {
      setError("Choisissez une image JPEG, PNG ou WebP de moins de 8 Mo.");
      return;
    }
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    imageUrlRef.current = URL.createObjectURL(file);
    try {
      await applyBackground("image", imageUrlRef.current);
    } catch {
      setError("Le fond virtuel n’est pas disponible sur cet appareil.");
    }
  }

  const room = roomRef.current;
  const people = room
    ? [room.localParticipant, ...room.remoteParticipants.values()]
    : [];
  const connectedIdentities = new Set(people.map((person) => person.identity));
  const waitingPeople = expectedPeople.filter(
    (person) => !connectedIdentities.has(person.identity),
  );
  const cameras = devices.filter((device) => device.kind === "videoinput"),
    microphones = devices.filter((device) => device.kind === "audioinput"),
    speakers = devices.filter((device) => device.kind === "audiooutput");
  return (
    <main className="min-h-[70vh] rounded-2xl bg-slate-950 p-4 text-white sm:p-6">
      <header>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-slate-300">
          Aucun média ne démarre sans votre action.
        </p>
      </header>
      {!joined ? (
        <section className="mx-auto mt-6 max-w-3xl rounded-2xl bg-white p-5 text-slate-900">
          <h2 className="text-xl font-bold">Préparer mon entrée</h2>
          <video
            ref={previewElementRef}
            autoPlay
            muted
            playsInline
            className={`mt-4 aspect-video w-full rounded-xl bg-slate-900 object-contain ${cameraWanted ? "block" : "hidden"}`}
            aria-label="Aperçu de votre caméra"
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              aria-pressed={cameraWanted}
              onClick={() => void togglePreview()}
              className="min-h-11 rounded-lg border px-3"
            >
              Caméra {cameraWanted ? "activée" : "désactivée"}
            </button>
            <button
              type="button"
              aria-pressed={microphoneWanted}
              onClick={() => setMicrophoneWanted((value) => !value)}
              className="min-h-11 rounded-lg border px-3"
            >
              Micro {microphoneWanted ? "activé à l’entrée" : "désactivé"}
            </button>
            <label>
              Caméra
              <select
                value={cameraId}
                onChange={(event) => setCameraId(event.target.value)}
                className="mt-1 min-h-11 w-full rounded border"
              >
                <option value="">Par défaut</option>
                {cameras.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || "Caméra disponible"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Micro
              <select
                value={microphoneId}
                onChange={(event) => setMicrophoneId(event.target.value)}
                className="mt-1 min-h-11 w-full rounded border"
              >
                <option value="">Par défaut</option>
                {microphones.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || "Micro disponible"}
                  </option>
                ))}
              </select>
            </label>
            {speakers.length ? (
              <label>
                Haut-parleur
                <select
                  value={speakerId}
                  onChange={(event) => setSpeakerId(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded border"
                >
                  <option value="">Par défaut</option>
                  {speakers.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || "Haut-parleur disponible"}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              Arrière-plan
              <select
                value={background}
                disabled={!backgroundAvailable}
                onChange={(event) => {
                  const mode = event.target.value as BackgroundMode;
                  setBackground(mode);
                  localStorage.setItem(
                    "goodissima.media.background",
                    mode === "image" ? "none" : mode,
                  );
                  if (cameraWanted)
                    void applyBackground(mode).catch(() =>
                      setError(
                        "Le flou d’arrière-plan n’est pas disponible sur cet appareil.",
                      ),
                    );
                }}
                className="mt-1 min-h-11 w-full rounded border"
              >
                <option value="none">Aucun</option>
                <option value="blur">Flou</option>
              </select>
            </label>
          </div>
          {!backgroundAvailable ? (
            <p className="mt-3 text-sm text-amber-800">
              Le flou d’arrière-plan n’est pas disponible sur cet appareil.
            </p>
          ) : null}
        <button
          type="button"
          data-boussole-id="join-secure-communication"
          onClick={() => void join()}
            disabled={!capabilities.canJoin || connecting}
            className="mt-5 min-h-11 rounded-lg bg-cyan-800 px-5 font-bold text-white disabled:opacity-60"
          >
            {connecting ? "Connexion…" : joinLabel}
          </button>
        </section>
      ) : (
        <>
          <section
            className={`mt-6 grid gap-3 ${people.length === 1 ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-3"}`}
          >
            {people.map((person) => (
              <PersonTile
                key={person.identity}
                participant={person}
                local={person === room?.localParticipant}
              />
            ))}
          </section>
          <nav
            aria-label="Contrôles de la réunion"
            className="sticky bottom-3 mt-5 flex flex-wrap gap-2 rounded-2xl bg-slate-900/95 p-3"
          >
            <button
              aria-label={
                microphoneEnabled ? "Couper le micro" : "Activer le micro"
              }
              disabled={pending}
              onClick={() => void toggle("microphone")}
              className="min-h-11 rounded border px-3"
            >
              Micro {microphoneEnabled ? "activé" : "coupé"}
            </button>
            <button
              aria-label={
                cameraEnabled ? "Couper la caméra" : "Activer la caméra"
              }
              disabled={pending}
              onClick={() => void toggle("camera")}
              className="min-h-11 rounded border px-3"
            >
              Caméra {cameraEnabled ? "activée" : "coupée"}
            </button>
            <button
              disabled={pending || !navigator.mediaDevices?.getDisplayMedia}
              onClick={() => void toggle("screen")}
              className="min-h-11 rounded border px-3"
            >
              {screenEnabled ? "Arrêter le partage" : "Partager l’écran"}
            </button>
            <button
              onClick={() => setParticipantsOpen((value) => !value)}
              className="min-h-11 rounded border px-3"
            >
              Participants ({people.length})
            </button>
            <details className="relative">
              <summary className="min-h-11 cursor-pointer rounded border px-3 py-2">
                Arrière-plan
              </summary>
              <div className="absolute bottom-12 right-0 z-10 w-64 rounded bg-white p-3 text-slate-900">
                <button
                  onClick={() => void applyBackground("none")}
                  className="min-h-11 w-full text-left"
                >
                  Aucun
                </button>
                <button
                  disabled={!backgroundAvailable || !cameraEnabled}
                  onClick={() =>
                    void applyBackground("blur").catch(() =>
                      setError(
                        "Le flou d’arrière-plan n’est pas disponible sur cet appareil.",
                      ),
                    )
                  }
                  className="min-h-11 w-full text-left disabled:opacity-50"
                >
                  Flou
                </button>
                <label className="block min-h-11 py-2">
                  Image
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={!backgroundAvailable || !cameraEnabled}
                    onChange={(event) =>
                      void chooseImage(event.target.files?.[0])
                    }
                    className="block w-full text-xs"
                  />
                </label>
              </div>
            </details>
            <button
              onClick={() => void leave()}
              className="min-h-11 rounded border border-rose-400 px-3"
            >
              Quitter
            </button>
            {capabilities.canEnd ? (
              <button
                disabled={pending}
                onClick={() => void end()}
                className="min-h-11 rounded bg-rose-700 px-3"
              >
                Terminer la réunion
              </button>
            ) : null}
          </nav>
          {participantsOpen ? (
            <aside className="mt-3 rounded-xl bg-white p-4 text-slate-900">
              <div className="flex justify-between">
                <h2 className="font-bold">Participants présents</h2>
                <button
                  onClick={() => setParticipantsOpen(false)}
                  aria-label="Fermer le panneau des participants"
                >
                  Fermer
                </button>
              </div>
              <ul className="mt-2 divide-y">
                {people.map((person) => (
                  <li key={person.identity} className="py-2">
                    {presentation(person)} ·{" "}
                    {person.isSpeaking ? "Parle" : "Connecté"}
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </>
      )}
      {joined && waitingPeople.length ? (
        <section className="mt-3 rounded-xl bg-white p-4 text-slate-900">
          <h2 className="font-bold">Invités non connectés</h2>
          <ul className="mt-2 divide-y">
            {waitingPeople.map((person) => (
              <li key={person.identity} className="py-2">
                {person.displayName} · {person.roleLabel} · {person.accessKind}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {error ? (
        <p
          role="alert"
          aria-live="assertive"
          className="mt-4 rounded bg-rose-100 p-3 text-rose-900"
        >
          {error}
        </p>
      ) : null}
      <p className="mt-4 text-xs text-slate-400">
        Aucun enregistrement ni transcription automatique. Les effets
        d’arrière-plan sont traités localement sur cet appareil.
      </p>
    </main>
  );
}
