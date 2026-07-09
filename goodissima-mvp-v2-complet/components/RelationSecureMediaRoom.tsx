"use client";

import { useEffect, useRef, useState } from "react";

type ChannelType = "VOICE_IP" | "VIDEO_IP" | "SCREEN_SHARE";
type ParticipantRole = "OWNER" | "CANDIDATE";
type SignalType = "offer" | "answer" | "candidate" | "leave";

type SessionSummary = {
  id: string;
  channelType: ChannelType;
  provider: string;
  status: string;
  title: string;
  recordingEnabled: boolean;
  transcriptionRequested: boolean;
  automaticNotificationSent: boolean;
  tokenGenerated: boolean;
  accessOpened: boolean;
  workflowStarted: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  roomName: string;
};

type SignalMessage = {
  id: string;
  from: string;
  type: SignalType;
  payload: unknown;
  cursor?: number;
  createdAt: number;
};

type SignalingResponse = {
  messages: SignalMessage[];
  participants: Array<{ peerId: string; role: ParticipantRole; isSelf: boolean; seenAt: number }>;
  leaves?: Array<{
    peerId: string;
    role: ParticipantRole;
    sessionId: string;
    caseId: string | null;
    leftAt: number;
    isSelf: boolean;
  }>;
  cursor: number;
};

const actions: Array<{ channelType: ChannelType; label: string; media: "audio" | "video" | "screen" }> = [
  { channelType: "VOICE_IP", label: "Appel audio", media: "audio" },
  { channelType: "VIDEO_IP", label: "Visio", media: "video" },
  { channelType: "SCREEN_SHARE", label: "Partage d'ecran", media: "screen" },
];

const channelLabels: Record<ChannelType, string> = {
  VOICE_IP: "Appel audio",
  VIDEO_IP: "Visio",
  SCREEN_SHARE: "Partage d'ecran",
};

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function isSessionDescription(value: unknown): value is RTCSessionDescriptionInit {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (value as { type?: unknown }).type === "string" &&
      typeof (value as { sdp?: unknown }).sdp === "string",
  );
}

function isIceCandidate(value: unknown): value is RTCIceCandidateInit {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function requestLocalStream(media: "audio" | "video" | "screen") {
  if (!navigator.mediaDevices) {
    throw new Error("Les medias navigateur ne sont pas disponibles dans ce contexte.");
  }

  if (media === "screen") {
    if (!navigator.mediaDevices.getDisplayMedia) {
      throw new Error("Le partage d'ecran n'est pas disponible dans ce navigateur.");
    }

    return navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  }

  if (!navigator.mediaDevices.getUserMedia) {
    throw new Error("Le micro ou la camera ne sont pas disponibles dans ce navigateur.");
  }

  return navigator.mediaDevices.getUserMedia(media === "audio" ? { audio: true, video: false } : { audio: true, video: true });
}

function providerLabel(provider: string | undefined) {
  if (provider === "MANUAL_EXTERNAL") return "WebRTC navigateur - signalisation Goodissima V1";
  if (provider === "LIVEKIT_PENDING") return "LiveKit prevu - non branche";
  return provider || "Non renseigne";
}

function isScreenShareAbort(error: unknown) {
  if (!(error instanceof DOMException)) return false;
  return error.name === "AbortError" || error.name === "NotAllowedError" || error.name === "NotFoundError";
}

function isCameraOrMicrophoneAbort(error: unknown) {
  if (!(error instanceof DOMException)) return false;
  return error.name === "AbortError" || error.name === "NotAllowedError" || error.name === "NotFoundError" || error.name === "NotReadableError";
}

export function RelationSecureMediaRoom({
  caseId,
  role,
  candidateAccessToken,
}: {
  caseId: string;
  role: ParticipantRole;
  candidateAccessToken?: string;
}) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<SessionSummary | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const cursorRef = useRef(0);
  const outgoingRef = useRef<Array<{ type: SignalType; payload: unknown }>>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const pollingInFlightRef = useRef(false);
  const negotiationPendingRef = useRef(false);
  const applyingLocalMediaRef = useRef(false);
  const isStartingMediaRef = useRef(false);
  const isClosingRoomRef = useRef(false);
  const lastAppliedRemoteAnswerRef = useRef<string | null>(null);
  const lastAppliedRemoteOfferRef = useRef<string | null>(null);
  const appliedIceCandidatesRef = useRef<Set<string>>(new Set());

  const [session, setSession] = useState<SessionSummary | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [activeChannel, setActiveChannel] = useState<ChannelType | null>(null);
  const [participants, setParticipants] = useState<SignalingResponse["participants"]>([]);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStartingMedia, setIsStartingMedia] = useState(false);
  const [isClosingRoom, setIsClosingRoom] = useState(false);
  const [terminalState, setTerminalState] = useState<"ended" | "expired" | null>(null);
  const [localParticipantLeft, setLocalParticipantLeft] = useState(false);
  const [remoteParticipantLeft, setRemoteParticipantLeft] = useState(false);

  const polite = role === "CANDIDATE";
  const prepareEndpoint =
    role === "OWNER"
      ? `/api/cases/${caseId}/media/protected-call`
      : `/api/candidate/cases/${caseId}/media/protected-call`;
  const signalingEndpoint =
    role === "OWNER" ? `/api/cases/${caseId}/media/signaling` : `/api/candidate/cases/${caseId}/media/signaling`;
  const endEndpoint = `/api/cases/${caseId}/media/protected-call/end`;

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    return () => {
      void closeRoom();
    };
    // closeRoom intentionally reads refs so cleanup uses the current media/session objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function enqueueSignal(type: SignalType, payload: unknown) {
    outgoingRef.current.push({ type, payload });
    void pollSignals();
  }

  function logIgnoredSignal(action: string, details: Record<string, unknown>) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[relation-media:${role}] ${action}`, details);
    }
  }

  function logMediaSignal(action: string, details: Record<string, unknown> = {}) {
    if (process.env.NODE_ENV !== "production") {
      const peerConnection = peerConnectionRef.current;
      console.info(`[relation-media:${role}] ${action}`, {
        sessionId: sessionRef.current?.id,
        signalingState: peerConnection?.signalingState,
        iceConnectionState: peerConnection?.iceConnectionState,
        connectionState: peerConnection?.connectionState,
        localTracks: localStreamRef.current?.getTracks().length ?? 0,
        remoteTracks: remoteStreamRef.current?.getTracks().length ?? 0,
        ...details,
      });
    }
  }

  function ensurePeerConnection() {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const remote = new MediaStream();
    remoteStreamRef.current = remote;
    setRemoteStream(remote);

    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        logMediaSignal("ICE candidate sent");
        enqueueSignal("candidate", event.candidate.toJSON());
      }
    };

    peerConnection.ontrack = (event) => {
      const eventStream = event.streams[0] ?? null;
      const nextRemote = eventStream ?? remoteStreamRef.current ?? new MediaStream();
      const tracks = eventStream?.getTracks() ?? [event.track];

      tracks.forEach((track) => {
        if (!nextRemote.getTracks().some((existingTrack) => existingTrack.id === track.id)) {
          nextRemote.addTrack(track);
        }
      });

      remoteStreamRef.current = nextRemote;
      setRemoteStream(nextRemote);
      logMediaSignal("Remote track received", {
        receivedTracks: tracks.length,
        remoteTracks: nextRemote.getTracks().length,
      });
    };

    peerConnection.onsignalingstatechange = () => {
      if (peerConnection.signalingState === "stable" && negotiationPendingRef.current) {
        void createAndSendOffer(peerConnection);
      }
    };

    peerConnection.onnegotiationneeded = () => {
      if (applyingLocalMediaRef.current) {
        negotiationPendingRef.current = true;
        logIgnoredSignal("Deferring negotiationneeded while local media changes", {
          signalingState: peerConnection.signalingState,
        });
        return;
      }

      void createAndSendOffer(peerConnection);
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  }

  async function createAndSendOffer(peerConnection = peerConnectionRef.current) {
    if (!peerConnection) return;

    if (makingOfferRef.current) {
      logIgnoredSignal("Ignoring concurrent offer request", {
        signalingState: peerConnection.signalingState,
      });
      return;
    }

    if (peerConnection.signalingState !== "stable") {
      negotiationPendingRef.current = true;
      logIgnoredSignal("Deferring offer request while not stable", {
        signalingState: peerConnection.signalingState,
      });
      return;
    }

    try {
      makingOfferRef.current = true;
      negotiationPendingRef.current = false;
      await peerConnection.setLocalDescription();
      if (peerConnection.localDescription) {
        lastAppliedRemoteAnswerRef.current = null;
        logMediaSignal("Offer published", {
          role,
          localTracks: localStreamRef.current?.getTracks().length ?? 0,
        });
        enqueueSignal("offer", peerConnection.localDescription.toJSON());
      }
    } catch (negotiationError) {
      setError(negotiationError instanceof Error ? negotiationError.message : "Negociation WebRTC impossible.");
    } finally {
      makingOfferRef.current = false;
    }
  }

  function addStreamTracks(peerConnection: RTCPeerConnection, stream: MediaStream) {
    stream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, stream);
      track.addEventListener(
        "ended",
        () => {
          stopLocalMedia(true);
        },
        { once: true },
      );
    });
  }

  async function replaceOrAddScreenTracks(peerConnection: RTCPeerConnection, screenStream: MediaStream) {
    const previousStream = localStreamRef.current;
    const nextStream = new MediaStream();
    const screenVideoTrack = screenStream.getVideoTracks()[0] ?? null;
    const screenAudioTrack = screenStream.getAudioTracks()[0] ?? null;

    if (screenVideoTrack) {
      const existingVideoSender = peerConnection.getSenders().find((sender) => sender.track?.kind === "video");

      if (existingVideoSender) {
        await existingVideoSender.replaceTrack(screenVideoTrack);
        previousStream?.getVideoTracks().forEach((track) => track.stop());
      } else {
        peerConnection.addTrack(screenVideoTrack, screenStream);
      }

      nextStream.addTrack(screenVideoTrack);
      screenVideoTrack.addEventListener(
        "ended",
        () => {
          stopLocalMedia(true);
        },
        { once: true },
      );
    }

    const previousAudioTrack = previousStream?.getAudioTracks()[0] ?? null;
    const nextAudioTrack = screenAudioTrack ?? previousAudioTrack;

    if (nextAudioTrack) {
      const existingAudioSender = peerConnection.getSenders().find((sender) => sender.track?.kind === "audio");

      if (existingAudioSender && existingAudioSender.track !== nextAudioTrack) {
        await existingAudioSender.replaceTrack(nextAudioTrack);
      } else if (!existingAudioSender) {
        peerConnection.addTrack(nextAudioTrack, screenStream);
      }

      nextStream.addTrack(nextAudioTrack);
    }

    previousStream
      ?.getTracks()
      .filter((track) => !nextStream.getTracks().some((nextTrack) => nextTrack.id === track.id))
      .forEach((track) => track.stop());

    localStreamRef.current = nextStream;
    setLocalStream(nextStream);
  }

  async function prepareSession(channelType: ChannelType) {
    if (terminalState) {
      throw new Error(
        terminalState === "expired"
          ? "Cette session a expire. Creez ou ouvrez une nouvelle session depuis le dossier."
          : "Session terminee.",
      );
    }

    const response = await fetch(prepareEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channelType, candidateAccessToken }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      session?: SessionSummary;
      signaling?: { peerId?: string; role?: ParticipantRole };
      error?: string;
    };

    if (!response.ok || !payload.session || !payload.signaling?.peerId) {
      throw new Error(payload.error || "Impossible de rejoindre la session media.");
    }

    sessionRef.current = payload.session;
    peerIdRef.current = payload.signaling.peerId;
    setTerminalState(null);
    setLocalParticipantLeft(false);
    setRemoteParticipantLeft(false);
    setSession(payload.session);
    ensurePeerConnection();
    startPolling();

    return payload.session;
  }

  async function joinRoom(channelType: ChannelType = "VIDEO_IP") {
    if (terminalState || pendingLabel || isStartingMediaRef.current || isClosingRoomRef.current || sessionRef.current) return;

    setError(null);
    setPendingLabel("Connexion...");

    try {
      await prepareSession(channelType);
      await pollSignals();
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Impossible de rejoindre la session.");
    } finally {
      setPendingLabel(null);
    }
  }

  async function startMedia(channelType: ChannelType, media: "audio" | "video" | "screen") {
    if (terminalState || pendingLabel || isStartingMediaRef.current || isClosingRoomRef.current) return;

    isStartingMediaRef.current = true;
    setIsStartingMedia(true);
    setError(null);
    setPendingLabel(channelLabels[channelType]);

    try {
      await prepareSession(channelType);
      const peerConnection = ensurePeerConnection();
      applyingLocalMediaRef.current = true;

      const stream = await requestLocalStream(media);

      if (media === "screen") {
        await replaceOrAddScreenTracks(peerConnection, stream);
      } else {
        stopLocalMedia(false);
        addStreamTracks(peerConnection, stream);
        localStreamRef.current = stream;
        setLocalStream(stream);
      }

      setActiveChannel(channelType);
      logMediaSignal("Local media tracks added", {
        channelType,
        localTracks: localStreamRef.current?.getTracks().length ?? 0,
      });

      applyingLocalMediaRef.current = false;
      negotiationPendingRef.current = false;
      await createAndSendOffer(peerConnection);
    } catch (startError) {
      applyingLocalMediaRef.current = false;
      if (media === "screen" && isScreenShareAbort(startError)) {
        setError("Partage d'ecran annule ou refuse. Cliquez de nouveau sur Partage d'ecran, choisissez une source, puis cliquez sur Partager.");
      } else if (media !== "screen" && isCameraOrMicrophoneAbort(startError)) {
        setError("Permission camera/micro refusee ou annulee. Vous pouvez reessayer avec le bouton Visio.");
      } else {
        setError(startError instanceof Error ? startError.message : "Impossible de demarrer le media.");
      }
    } finally {
      isStartingMediaRef.current = false;
      setIsStartingMedia(false);
      setPendingLabel(null);
    }
  }

  function stopLocalMedia(clearChannel = true) {
    const peerConnection = peerConnectionRef.current;
    const currentStream = localStreamRef.current;

    if (peerConnection && currentStream) {
      for (const track of currentStream.getTracks()) {
        const sender = peerConnection.getSenders().find((candidateSender) => candidateSender.track === track);
        if (sender) peerConnection.removeTrack(sender);
      }
    }

    stopStream(currentStream);
    localStreamRef.current = null;
    setLocalStream(null);
    if (clearChannel) setActiveChannel(null);
  }

  function startPolling() {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(() => {
      void pollSignals();
    }, 1000);
  }

  async function pollSignals() {
    const currentSession = sessionRef.current;
    const peerId = peerIdRef.current;
    if (!currentSession || !peerId || pollingInFlightRef.current) return;

    pollingInFlightRef.current = true;

    try {
      const outgoing = outgoingRef.current.splice(0, outgoingRef.current.length);
      const response = await fetch(signalingEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: currentSession.id,
          peerId,
          cursor: cursorRef.current,
          candidateAccessToken,
          messages: outgoing,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as Partial<SignalingResponse> & { error?: string };

      if (!response.ok || !Array.isArray(payload.messages) || typeof payload.cursor !== "number") {
        if (response.status === 410 && (payload as { state?: unknown }).state === "expired") {
          cleanupRoom({ terminal: "expired" });
          setError("Cette session a expire. Creez ou ouvrez une nouvelle session depuis le dossier.");
          return;
        }

        if (response.status === 410 && (payload as { state?: unknown }).state === "ended") {
          cleanupRoom({ terminal: "ended" });
          setError(null);
          return;
        }

        throw new Error(payload.error || "Signalisation media indisponible.");
      }

      cursorRef.current = payload.cursor;
      setParticipants(Array.isArray(payload.participants) ? payload.participants : []);
      if (Array.isArray(payload.leaves) && payload.leaves.some((leave) => !leave.isSelf)) {
        handleRemoteParticipantLeft();
      }

      for (const message of payload.messages) {
        await handleSignal(message);
      }
    } catch (pollError) {
      setError(pollError instanceof Error ? pollError.message : "Signalisation media interrompue.");
    } finally {
      pollingInFlightRef.current = false;
    }
  }

  async function handleSignal(message: SignalMessage) {
    if (terminalState) return;

    if (message.type === "leave") {
      handleRemoteParticipantLeft();
      return;
    }

    const peerConnection = ensurePeerConnection();

    if (message.type === "offer" || message.type === "answer") {
      if (!isSessionDescription(message.payload)) return;

      const description = message.payload;
      const sdp = description.sdp ?? "";

      if (description.type === "answer") {
        logMediaSignal("Answer received", {
          signalingState: peerConnection.signalingState,
        });

        if (lastAppliedRemoteAnswerRef.current === sdp) {
          logIgnoredSignal("Ignoring duplicate answer", {
            signalingState: peerConnection.signalingState,
            remoteDescriptionType: description.type,
          });
          return;
        }

        if (peerConnection.signalingState !== "have-local-offer") {
          logIgnoredSignal("Ignoring stale answer", {
            signalingState: peerConnection.signalingState,
            remoteDescriptionType: description.type,
          });
          return;
        }

        await peerConnection.setRemoteDescription(description);
        lastAppliedRemoteAnswerRef.current = sdp;
        logMediaSignal("Answer applied");
        return;
      }

      logMediaSignal("Offer received", {
        signalingState: peerConnection.signalingState,
      });

      if (lastAppliedRemoteOfferRef.current === sdp) {
        logIgnoredSignal("Ignoring duplicate offer", {
          signalingState: peerConnection.signalingState,
          remoteDescriptionType: description.type,
        });
        return;
      }

      const offerCollision = makingOfferRef.current || peerConnection.signalingState !== "stable";
      ignoreOfferRef.current = !polite && offerCollision;
      if (ignoreOfferRef.current || peerConnection.signalingState !== "stable") {
        logIgnoredSignal("Ignoring offer while not stable", {
          signalingState: peerConnection.signalingState,
          remoteDescriptionType: description.type,
          ignoredByCollision: ignoreOfferRef.current,
        });
        return;
      }

      await peerConnection.setRemoteDescription(description);
      lastAppliedRemoteOfferRef.current = sdp;
      lastAppliedRemoteAnswerRef.current = null;

      if (description.type === "offer") {
        await peerConnection.setLocalDescription();
        if (peerConnection.localDescription) {
          logMediaSignal("Answer published");
          enqueueSignal("answer", peerConnection.localDescription.toJSON());
        }
      }

      return;
    }

    if (message.type === "candidate") {
      if (!isIceCandidate(message.payload)) return;

      try {
        const candidateFingerprint = JSON.stringify(message.payload);
        if (appliedIceCandidatesRef.current.has(candidateFingerprint)) {
          logIgnoredSignal("Ignoring duplicate ICE candidate", {
            signalingState: peerConnection.signalingState,
          });
          return;
        }

        logMediaSignal("ICE candidate received");
        await peerConnection.addIceCandidate(message.payload);
        appliedIceCandidatesRef.current.add(candidateFingerprint);
      } catch (candidateError) {
        if (!ignoreOfferRef.current) throw candidateError;
      }
    }
  }

  function clearRemoteMedia() {
    stopStream(remoteStreamRef.current);
    remoteStreamRef.current = null;
    setRemoteStream(null);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
      remoteVideoRef.current.load();
    }
  }

  function handleRemoteParticipantLeft() {
    clearRemoteMedia();
    peerConnectionRef.current?.getReceivers().forEach((receiver) => receiver.track?.stop());
    setRemoteParticipantLeft(true);
  }

  async function sendLeaveSignal() {
    const currentSession = sessionRef.current;
    const peerId = peerIdRef.current;
    if (!currentSession || !peerId) return;

    try {
      const response = await fetch(signalingEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        keepalive: true,
        body: JSON.stringify({
          sessionId: currentSession.id,
          peerId,
          cursor: cursorRef.current,
          candidateAccessToken,
          messages: [
            {
              type: "leave",
              payload: {
                participantRole: role.toLowerCase(),
                leftAt: Date.now(),
                sessionId: currentSession.id,
                caseId,
              },
            },
          ],
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<SignalingResponse>;
      if (response.ok && typeof payload.cursor === "number") {
        cursorRef.current = payload.cursor;
      }
    } catch {
      // Best effort only: leaving local media must never be blocked by signaling.
    }
  }

  function cleanupRoom({
    localLeft = false,
    terminal = null,
  }: {
    localLeft?: boolean;
    terminal?: "ended" | "expired" | null;
  } = {}) {
    if (isClosingRoomRef.current) return;

    isClosingRoomRef.current = true;
    setIsClosingRoom(true);

    stopLocalMedia();
    clearRemoteMedia();

    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    sessionRef.current = null;
    peerIdRef.current = null;
    cursorRef.current = 0;
    makingOfferRef.current = false;
    ignoreOfferRef.current = false;
    negotiationPendingRef.current = false;
    applyingLocalMediaRef.current = false;
    isStartingMediaRef.current = false;
    lastAppliedRemoteAnswerRef.current = null;
    lastAppliedRemoteOfferRef.current = null;
    appliedIceCandidatesRef.current = new Set();
    setIsStartingMedia(false);
    setSession(null);
    setParticipants([]);
    setPendingLabel(null);
    setRemoteParticipantLeft(false);
    setLocalParticipantLeft(localLeft);
    if (terminal) setTerminalState(terminal);
    isClosingRoomRef.current = false;
    setIsClosingRoom(false);
  }

  async function closeRoom() {
    if (isClosingRoomRef.current) return;
    setPendingLabel("Deconnexion...");
    await sendLeaveSignal();
    cleanupRoom({ localLeft: true });
  }

  async function endSessionForEveryone() {
    const currentSession = sessionRef.current;
    if (role !== "OWNER" || !currentSession || pendingLabel || isClosingRoomRef.current) return;

    setPendingLabel("Fin de session...");
    setError(null);

    try {
      const response = await fetch(endEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: currentSession.id,
          reason: "Session terminee explicitement par le proprietaire depuis le dossier.",
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Impossible de terminer la session.");
      }

      cleanupRoom({ terminal: "ended" });
    } catch (endError) {
      setError(endError instanceof Error ? endError.message : "Impossible de terminer la session.");
    } finally {
      setPendingLabel(null);
    }
  }

  const remoteTrackCount = remoteStream?.getTracks().length ?? 0;
  const otherParticipants = participants.filter((participant) => !participant.isSelf);
  const otherParticipantPresent = otherParticipants.length > 0;
  const controlsDisabled = Boolean(pendingLabel) || isStartingMedia || isClosingRoom || Boolean(terminalState);
  const statusLabel = terminalState === "expired"
    ? "Session expiree"
    : terminalState === "ended"
      ? "Session terminee"
      : localParticipantLeft
        ? "Vous avez quitte la session"
        : remoteParticipantLeft
          ? "L'autre personne a quitte la session"
          : session
        ? remoteTrackCount > 0
          ? "Flux distant recu"
          : otherParticipantPresent
            ? "Vous etes connecte - l'autre partie est presente"
            : "Vous etes connecte - en attente du media de l'autre personne"
        : "Session non ouverte";

  return (
    <section className="rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] p-4 shadow-[0_12px_30px_rgba(47,52,55,0.055)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-[#2f3437]">Communication securisee</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#766f68]">
            Session distante WebRTC ouverte uniquement apres action explicite. Aucun enregistrement ni transcription automatique.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#766f68]">
            Rejoindre la session ne demarre pas la camera. Chaque personne active volontairement son micro, sa camera ou son ecran.
          </p>
        </div>
        <span className="rounded-full bg-[#e8f8f9] px-2.5 py-1 text-xs font-semibold text-[#247f88] ring-1 ring-[#d6e7e8]">
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => joinRoom()}
          disabled={controlsDisabled || Boolean(session)}
          className="rounded-xl border border-[#d6e7e8] bg-white px-3 py-2 text-sm font-semibold text-[#247f88] transition hover:bg-[#e8f8f9] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {session ? "Session rejointe" : pendingLabel === "Connexion..." ? "Connexion..." : "Rejoindre"}
        </button>
        {actions.map((action) => (
          <button
            key={action.channelType}
            type="button"
            onClick={() => startMedia(action.channelType, action.media)}
            disabled={controlsDisabled}
            className="rounded-xl border border-[#d6e7e8] bg-white px-3 py-2 text-sm font-semibold text-[#247f88] transition hover:bg-[#e8f8f9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingLabel === channelLabels[action.channelType] ? "Demarrage..." : action.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void closeRoom()}
          disabled={controlsDisabled || (!session && !localStream)}
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isClosingRoom ? "Fermeture..." : "Quitter"}
        </button>
        {role === "OWNER" ? (
          <button
            type="button"
            onClick={endSessionForEveryone}
            disabled={controlsDisabled || !session}
            className="rounded-xl border border-slate-300 bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pendingLabel === "Fin de session..." ? "Fin..." : "Terminer pour tous"}
          </button>
        ) : null}
      </div>

      {terminalState ? (
        <p className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800">
          {terminalState === "expired"
            ? "Cette session a expire. Creez ou ouvrez une nouvelle session depuis le dossier."
            : "Session terminee."}
        </p>
      ) : null}

      {!terminalState && localParticipantLeft ? (
        <p className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800">
          Vous avez quitte la session.
        </p>
      ) : null}

      {!terminalState && remoteParticipantLeft ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          L'autre personne a quitte la session.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-[#d6e7e8] bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#2f3437]">
              Local{activeChannel ? ` - ${channelLabels[activeChannel]}` : ""}
            </p>
            <button
              type="button"
              onClick={() => stopLocalMedia()}
              disabled={!localStream}
              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Arreter media
            </button>
          </div>
          {localStream && activeChannel !== "VOICE_IP" ? (
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="mt-3 aspect-video w-full rounded-lg bg-slate-950 object-contain"
            />
          ) : (
            <p className="mt-3 rounded-lg bg-[#f6f0e8] px-3 py-2 text-sm text-[#766f68]">
              {localStream ? "Flux audio local actif." : "Aucun media local actif."}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-[#d6e7e8] bg-white p-3">
          <p className="text-sm font-semibold text-[#2f3437]">Distant</p>
          {remoteTrackCount > 0 ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="mt-3 aspect-video w-full rounded-lg bg-slate-950 object-contain"
            />
          ) : (
            <p className="mt-3 rounded-lg bg-[#f6f0e8] px-3 py-2 text-sm text-[#766f68]">
              {remoteParticipantLeft
                ? "L'autre personne a quitte la session."
                : otherParticipantPresent
                ? "L'autre personne est connectee, mais n'a pas encore active de media."
                : "En attente du media de l'autre personne. Elle doit cliquer sur Audio, Visio ou Partage d'ecran pour envoyer un flux."}
            </p>
          )}
        </div>
      </div>

      <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg bg-[#f6f0e8] px-3 py-2">
          <dt className="font-medium text-[#766f68]">Provider</dt>
          <dd className="mt-0.5 font-semibold text-[#2f3437]">{providerLabel(session?.provider)}</dd>
        </div>
        <div className="rounded-lg bg-[#f6f0e8] px-3 py-2">
          <dt className="font-medium text-[#766f68]">Room</dt>
          <dd className="mt-0.5 break-all font-semibold text-[#2f3437]">{session?.roomName ?? "Non ouverte"}</dd>
        </div>
        <div className="rounded-lg bg-[#f6f0e8] px-3 py-2">
          <dt className="font-medium text-[#766f68]">Enregistrement</dt>
          <dd className="mt-0.5 font-semibold text-[#2f3437]">Desactive</dd>
        </div>
        <div className="rounded-lg bg-[#f6f0e8] px-3 py-2">
          <dt className="font-medium text-[#766f68]">Transcription</dt>
          <dd className="mt-0.5 font-semibold text-[#2f3437]">Desactivee</dd>
        </div>
        <div className="rounded-lg bg-[#f6f0e8] px-3 py-2">
          <dt className="font-medium text-[#766f68]">Notification automatique</dt>
          <dd className="mt-0.5 font-semibold text-[#2f3437]">Non envoyee</dd>
        </div>
        <div className="rounded-lg bg-[#f6f0e8] px-3 py-2">
          <dt className="font-medium text-[#766f68]">Token media</dt>
          <dd className="mt-0.5 font-semibold text-[#2f3437]">Non genere</dd>
        </div>
      </dl>
    </section>
  );
}
