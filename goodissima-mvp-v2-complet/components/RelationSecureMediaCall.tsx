"use client";

import { useEffect, useRef, useState } from "react";

type ChannelType = "VOICE_IP" | "VIDEO_IP" | "SCREEN_SHARE";

type SessionSummary = {
  id: string;
  channelType: ChannelType;
  provider: string;
  status: string;
  title: string;
  recordingEnabled: boolean;
  transcriptionRequested: boolean;
  transcriptionConsented: boolean;
  automaticNotificationSent: boolean;
  tokenGenerated: boolean;
  accessOpened: boolean;
  workflowStarted: boolean;
};

const channelLabels: Record<ChannelType, string> = {
  VOICE_IP: "Appel audio",
  VIDEO_IP: "Visio",
  SCREEN_SHARE: "Partage d'ecran",
};

const actions: Array<{ channelType: ChannelType; label: string; media: "audio" | "video" | "screen" }> = [
  { channelType: "VOICE_IP", label: "Appel audio", media: "audio" },
  { channelType: "VIDEO_IP", label: "Visio", media: "video" },
  { channelType: "SCREEN_SHARE", label: "Partage d'ecran", media: "screen" },
];

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function providerLabel(provider: string | undefined) {
  if (provider === "NONE") return "Navigateur local - provider distant non branche";
  return provider || "Non renseigne";
}

async function requestLocalStream(media: "audio" | "video" | "screen") {
  if (!navigator.mediaDevices) {
    throw new Error("Les medias navigateur ne sont pas disponibles dans ce contexte.");
  }

  if (media === "screen") {
    if (!navigator.mediaDevices.getDisplayMedia) {
      throw new Error("Le partage d'ecran n'est pas disponible dans ce navigateur.");
    }

    return navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  }

  if (!navigator.mediaDevices.getUserMedia) {
    throw new Error("Le micro ou la camera ne sont pas disponibles dans ce navigateur.");
  }

  return navigator.mediaDevices.getUserMedia(media === "audio" ? { audio: true, video: false } : { audio: true, video: true });
}

export function RelationSecureMediaCall({ caseId }: { caseId: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [activeChannel, setActiveChannel] = useState<ChannelType | null>(null);
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [pendingChannel, setPendingChannel] = useState<ChannelType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      stopStream(stream);
    };
  }, [stream]);

  async function startMedia(channelType: ChannelType, media: "audio" | "video" | "screen") {
    setError(null);
    setPendingChannel(channelType);

    try {
      stopStream(stream);

      const response = await fetch(`/api/cases/${caseId}/media/protected-call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channelType }),
      });

      const payload = (await response.json().catch(() => ({}))) as { session?: SessionSummary; error?: string };

      if (!response.ok || !payload.session) {
        throw new Error(payload.error || "Impossible de preparer la session relationnelle.");
      }

      const localStream = await requestLocalStream(media);
      localStream.getTracks().forEach((track) => {
        track.addEventListener(
          "ended",
          () => {
            setStream(null);
            setActiveChannel(null);
          },
          { once: true },
        );
      });

      setSession(payload.session);
      setStream(localStream);
      setActiveChannel(channelType);
    } catch (startError) {
      setStream(null);
      setActiveChannel(null);
      setError(startError instanceof Error ? startError.message : "Impossible de demarrer le media local.");
    } finally {
      setPendingChannel(null);
    }
  }

  function stopMedia() {
    stopStream(stream);
    setStream(null);
    setActiveChannel(null);
  }

  const hasVideoPreview = activeChannel === "VIDEO_IP" || activeChannel === "SCREEN_SHARE";

  return (
    <section className="rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] p-4 shadow-[0_12px_30px_rgba(47,52,55,0.055)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-[#2f3437]">Communication securisee</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#766f68]">
            Demarrage explicite uniquement. Le flux reste local au navigateur en V1.
          </p>
        </div>
        <span className="rounded-full bg-[#e8f8f9] px-2.5 py-1 text-xs font-semibold text-[#247f88] ring-1 ring-[#d6e7e8]">
          V1 local
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {actions.map((action) => (
          <button
            key={action.channelType}
            type="button"
            onClick={() => startMedia(action.channelType, action.media)}
            disabled={pendingChannel !== null}
            className="rounded-xl border border-[#d6e7e8] bg-white px-3 py-2 text-sm font-semibold text-[#247f88] transition hover:bg-[#e8f8f9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingChannel === action.channelType ? "Preparation..." : action.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      ) : null}

      {stream ? (
        <div className="mt-4 rounded-xl border border-[#d6e7e8] bg-white p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-[#2f3437]">
              {activeChannel ? channelLabels[activeChannel] : "Communication"} locale active
            </p>
            <button
              type="button"
              onClick={stopMedia}
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-800 transition hover:bg-rose-100"
            >
              Arreter
            </button>
          </div>
          {hasVideoPreview ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="mt-3 aspect-video w-full rounded-lg bg-slate-950 object-contain"
            />
          ) : (
            <p className="mt-3 rounded-lg bg-[#f6f0e8] px-3 py-2 text-sm text-[#766f68]">
              Flux audio local actif. Aucune connexion distante n'est ouverte automatiquement.
            </p>
          )}
        </div>
      ) : null}

      <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg bg-[#f6f0e8] px-3 py-2">
          <dt className="font-medium text-[#766f68]">Provider</dt>
          <dd className="mt-0.5 font-semibold text-[#2f3437]">{providerLabel(session?.provider)}</dd>
        </div>
        <div className="rounded-lg bg-[#f6f0e8] px-3 py-2">
          <dt className="font-medium text-[#766f68]">Statut</dt>
          <dd className="mt-0.5 font-semibold text-[#2f3437]">
            {activeChannel ? "Demarree localement" : session?.status ?? "Non demarree"}
          </dd>
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
          <dt className="font-medium text-[#766f68]">Acces</dt>
          <dd className="mt-0.5 font-semibold text-[#2f3437]">Non ouvert automatiquement</dd>
        </div>
      </dl>
    </section>
  );
}
