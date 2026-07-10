"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type TrackPublication,
} from "livekit-client";

type ActorKind = "owner" | "candidate";
type RoomState = "not-joined" | "connecting" | "connected" | "error" | "ended";

type TokenResponse = {
  livekitUrl?: string;
  roomName?: string;
  token?: string;
  expiresAt?: string;
  communicationSessionId?: string;
  error?: string;
};

function participantRole(participant: Participant) {
  try {
    const metadata = JSON.parse(participant.metadata || "{}") as { role?: unknown };
    return typeof metadata.role === "string" ? metadata.role : null;
  } catch {
    return null;
  }
}

function LiveKitTrack({ publication, muted = false }: { publication: TrackPublication; muted?: boolean }) {
  const elementRef = useRef<HTMLMediaElement | null>(null);
  const track = publication.track;
  const isAudio = publication.kind === Track.Kind.Audio;

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !track) return;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);

  if (!track) return null;
  if (isAudio) return <audio ref={elementRef as React.RefObject<HTMLAudioElement>} autoPlay muted={muted} />;
  return (
    <video
      ref={elementRef as React.RefObject<HTMLVideoElement>}
      autoPlay
      muted={muted}
      playsInline
      className="aspect-video w-full rounded-lg bg-slate-950 object-contain"
    />
  );
}

function ParticipantCard({ participant, local }: { participant: Participant; local: boolean }) {
  const publications = Array.from(participant.trackPublications.values());
  const videoPublications = publications.filter(
    (publication) => publication.track && publication.kind === Track.Kind.Video,
  );
  const audioPublications = local
    ? []
    : publications.filter((publication) => publication.track && publication.kind === Track.Kind.Audio);
  const role = participantRole(participant);

  return (
    <article className="rounded-xl border border-[#d6e7e8] bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#2f3437]">{participant.name || participant.identity}</p>
        <span className="rounded-full bg-[#e8f8f9] px-2 py-0.5 text-xs font-medium text-[#247f88]">
          {local ? "Vous" : role || "Participant"}
        </span>
      </div>
      <div className="mt-3 grid gap-3">
        {videoPublications.map((publication) => (
          <div key={publication.trackSid}>
            {publication.source === Track.Source.ScreenShare ? (
              <p className="mb-1 text-xs font-medium text-[#766f68]">Partage d&apos;ecran</p>
            ) : null}
            <LiveKitTrack publication={publication} muted={local} />
          </div>
        ))}
        {audioPublications.map((publication) => (
          <LiveKitTrack key={publication.trackSid} publication={publication} />
        ))}
        {videoPublications.length === 0 ? (
          <p className="rounded-lg bg-[#f6f0e8] px-3 py-2 text-sm text-[#766f68]">
            {publications.some((publication) => publication.track) ? "Participant audio" : "Aucun media actif"}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function RelationLiveKitMediaRoom({
  caseId,
  actorKind,
  available,
  candidateAccessToken,
}: {
  caseId: string;
  actorKind: ActorKind;
  available: boolean;
  candidateAccessToken?: string;
}) {
  const router = useRouter();
  const roomRef = useRef<Room | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState>("not-joined");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaPending, setMediaPending] = useState<string | null>(null);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);
  const [renderVersion, setRenderVersion] = useState(0);

  function refreshRoom() {
    setRenderVersion((version) => version + 1);
  }

  function releaseRoom(room: Room | null, disconnect: boolean) {
    if (!room) return;
    const participants = [room.localParticipant, ...Array.from(room.remoteParticipants.values())];
    participants.forEach((participant) => {
      participant.trackPublications.forEach((publication) => publication.track?.detach());
    });
    room.localParticipant.trackPublications.forEach((publication) => publication.track?.stop());
    room.removeAllListeners();
    if (disconnect) room.disconnect();
  }

  function resetClientRoom(room: Room | null, nextState: RoomState, nextNotice: string | null, disconnect = true) {
    releaseRoom(room, disconnect);
    if (!room || roomRef.current === room) roomRef.current = null;
    sessionIdRef.current = null;
    setMicrophoneEnabled(false);
    setCameraEnabled(false);
    setScreenShareEnabled(false);
    setMediaPending(null);
    setError(null);
    setNotice(nextNotice);
    setRoomState(nextState);
    refreshRoom();
  }

  useEffect(() => {
    return () => {
      releaseRoom(roomRef.current, true);
      roomRef.current = null;
      sessionIdRef.current = null;
    };
  }, []);

  async function joinRoom() {
    if (roomState === "connecting" || roomState === "connected") return;
    releaseRoom(roomRef.current, true);
    roomRef.current = null;
    sessionIdRef.current = null;
    setRoomState("connecting");
    setError(null);
    setNotice(null);
    setMicrophoneEnabled(false);
    setCameraEnabled(false);
    setScreenShareEnabled(false);

    try {
      const endpoint =
        actorKind === "owner"
          ? `/api/cases/${caseId}/media/livekit-token`
          : `/api/candidate/cases/${caseId}/media/livekit-token`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actorKind === "candidate" ? { candidateAccessToken } : {}),
      });
      const payload = (await response.json().catch(() => ({}))) as TokenResponse;
      if (!response.ok || !payload.livekitUrl || !payload.token || !payload.communicationSessionId) {
        throw new Error(payload.error || "Impossible de rejoindre la salle securisee.");
      }

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      sessionIdRef.current = payload.communicationSessionId;
      const refreshEvents = [
        RoomEvent.ParticipantConnected,
        RoomEvent.ParticipantDisconnected,
        RoomEvent.TrackSubscribed,
        RoomEvent.TrackUnsubscribed,
        RoomEvent.LocalTrackPublished,
        RoomEvent.LocalTrackUnpublished,
        RoomEvent.TrackMuted,
        RoomEvent.TrackUnmuted,
      ];
      refreshEvents.forEach((event) => room.on(event, refreshRoom));
      room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
        if (publication.source === Track.Source.ScreenShare) setScreenShareEnabled(false);
        if (publication.source === Track.Source.Camera) setCameraEnabled(false);
        if (publication.source === Track.Source.Microphone) setMicrophoneEnabled(false);
      });
      room.on(RoomEvent.Disconnected, (reason) => {
        if (reason === DisconnectReason.ROOM_DELETED) {
          resetClientRoom(
            room,
            "ended",
            actorKind === "owner" ? "Session terminee" : "Session terminee par l'organisateur",
            false,
          );
          router.refresh();
          return;
        }
        resetClientRoom(room, "not-joined", null, false);
      });
      await room.connect(payload.livekitUrl, payload.token, { autoSubscribe: true });
      setRoomState("connected");
      refreshRoom();
      router.refresh();
    } catch (joinError) {
      const message = joinError instanceof Error ? joinError.message : "Connexion a la salle securisee impossible.";
      resetClientRoom(roomRef.current, "error", null);
      setError(message);
      setRoomState("error");
    }
  }

  async function toggleMedia(kind: "microphone" | "camera" | "screen") {
    const room = roomRef.current;
    if (!room || roomState !== "connected" || mediaPending) return;
    setMediaPending(kind);
    setError(null);
    try {
      if (kind === "microphone") {
        const enabled = !microphoneEnabled;
        await room.localParticipant.setMicrophoneEnabled(enabled);
        setMicrophoneEnabled(enabled);
        if (enabled) await markSessionUsage("audio");
      } else if (kind === "camera") {
        const enabled = !cameraEnabled;
        await room.localParticipant.setCameraEnabled(enabled);
        setCameraEnabled(enabled);
        if (enabled) await markSessionUsage("video");
      } else {
        const enabled = !screenShareEnabled;
        await room.localParticipant.setScreenShareEnabled(enabled);
        setScreenShareEnabled(enabled);
        if (enabled) await markSessionUsage("screen");
      }
      refreshRoom();
    } catch (mediaError) {
      setError(mediaError instanceof Error ? mediaError.message : "Activation du media impossible.");
    } finally {
      setMediaPending(null);
    }
  }

  async function markSessionUsage(usage: "audio" | "video" | "screen") {
    const communicationSessionId = sessionIdRef.current;
    if (!communicationSessionId) return;
    const endpoint =
      actorKind === "owner"
        ? `/api/cases/${caseId}/media/session-usage`
        : `/api/candidate/cases/${caseId}/media/session-usage`;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communicationSessionId, usage, candidateAccessToken }),
      });
      if (response.ok) router.refresh();
    } catch {
      // L'historisation ne doit jamais interrompre une communication deja activee.
    }
  }

  function leaveRoom() {
    resetClientRoom(roomRef.current, "not-joined", null);
  }

  async function endRoomForAll() {
    const room = roomRef.current;
    const sessionId = sessionIdRef.current;
    if (!room || !sessionId || actorKind !== "owner") return;
    setMediaPending("end");
    setError(null);
    try {
      const response = await fetch(`/api/cases/${caseId}/media/protected-call/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, reason: "Session LiveKit terminee explicitement par le proprietaire." }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Impossible de terminer la session.");
      resetClientRoom(room, "ended", "Session terminee");
      router.refresh();
    } catch (endError) {
      setError(endError instanceof Error ? endError.message : "Impossible de terminer la session.");
    } finally {
      setMediaPending(null);
    }
  }

  const room = roomRef.current;
  const participants = room
    ? [room.localParticipant, ...Array.from(room.remoteParticipants.values())]
    : [];
  void renderVersion;

  return (
    <section className="rounded-2xl border border-[#b9dfe2] bg-[#f5ffff] p-4 shadow-[0_12px_30px_rgba(47,52,55,0.055)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-[#2f3437]">Communication securisee</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#766f68]">
            La salle securisee permet l&apos;audio, la video et le partage d&apos;ecran. Le micro, la camera et le partage d&apos;ecran ne demarrent qu&apos;apres votre accord.
          </p>
        </div>
        <span className="rounded-full bg-[#dff6f7] px-2.5 py-1 text-xs font-semibold text-[#247f88]">
          {roomState === "connected" ? "Connecte" : roomState === "connecting" ? "Connexion" : roomState === "ended" ? "Session terminee" : roomState === "error" ? "Erreur" : "Non rejoint"}
        </span>
      </div>

      {!available ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          La salle securisee n&apos;est pas disponible pour le moment.
        </p>
      ) : roomState !== "connected" ? (
        <button
          type="button"
          onClick={joinRoom}
          disabled={roomState === "connecting"}
          className="mt-4 rounded-xl bg-[#247f88] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1d6970] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {roomState === "connecting"
            ? "Connexion..."
            : roomState === "ended" && actorKind === "owner"
              ? "Demarrer une nouvelle salle securisee"
              : "Rejoindre la salle securisee"}
        </button>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => toggleMedia("microphone")} disabled={Boolean(mediaPending)} className="rounded-lg border border-[#b9dfe2] bg-white px-3 py-2 text-sm font-semibold text-[#247f88] disabled:opacity-60">
            {microphoneEnabled ? "Couper micro" : "Activer micro"}
          </button>
          <button type="button" onClick={() => toggleMedia("camera")} disabled={Boolean(mediaPending)} className="rounded-lg border border-[#b9dfe2] bg-white px-3 py-2 text-sm font-semibold text-[#247f88] disabled:opacity-60">
            {cameraEnabled ? "Couper camera" : "Activer camera"}
          </button>
          <button type="button" onClick={() => toggleMedia("screen")} disabled={Boolean(mediaPending)} className="rounded-lg border border-[#b9dfe2] bg-white px-3 py-2 text-sm font-semibold text-[#247f88] disabled:opacity-60">
            {screenShareEnabled ? "Arreter partage ecran" : "Partager ecran"}
          </button>
          <button type="button" onClick={leaveRoom} disabled={Boolean(mediaPending)} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-800 disabled:opacity-60">
            Quitter
          </button>
          {actorKind === "owner" ? (
            <button type="button" onClick={endRoomForAll} disabled={Boolean(mediaPending)} className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
              Terminer pour tous
            </button>
          ) : null}
        </div>
      )}

      {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}

      {notice ? (
        <p className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800">
          {notice}
        </p>
      ) : null}

      {roomState === "connected" ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {participants.map((participant) => (
            <ParticipantCard key={participant.identity} participant={participant} local={participant === room?.localParticipant} />
          ))}
        </div>
      ) : null}

      <p className="mt-4 text-xs leading-relaxed text-[#766f68]">
        La salle securisee est concue pour plusieurs participants. L&apos;acces des tiers sera ajoute dans un parcours dedie. Aucun enregistrement ni transcription automatique.
      </p>
    </section>
  );
}
