"use client";

import { useEffect, useRef, useState } from "react";
import { VOICE_STATUS_LABELS, voiceFeatureSupported } from "@/lib/voice-opportunity";

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorLike = { error?: string };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type CaptureStatus = "idle" | "listening" | "transcribing" | "ready" | "error";
type MicrophoneStatus = "idle" | "active" | "low" | "transcribing";

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function VoiceCaptureButton({
  label,
  onTranscript,
  disabled = false,
  compact = false,
}: {
  label: string;
  onTranscript: (transcript: string, capturedAt: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantsListeningRef = useRef(false);
  const cancelledRef = useRef(false);
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [microphoneStatus, setMicrophoneStatus] = useState<MicrophoneStatus>("idle");
  const [testingMicrophone, setTestingMicrophone] = useState(false);

  useEffect(() => {
    setSupported(voiceFeatureSupported(window));
    return () => {
      wantsListeningRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      recognitionRef.current?.stop();
    };
  }, []);

  function completeCapture() {
    if (cancelledRef.current) return;
    const transcript = [finalTranscriptRef.current, interimTranscriptRef.current].filter(Boolean).join(" ").trim();
    interimTranscriptRef.current = "";
    if (transcript) {
      setStatus("ready");
      setMicrophoneStatus("idle");
      onTranscript(transcript, new Date().toISOString());
    } else {
      setStatus("idle");
      setMicrophoneStatus("idle");
    }
  }

  function startRecognition() {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition || !wantsListeningRef.current) return;

    const recognition = new Recognition();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => {
      setStatus("listening");
      setMicrophoneStatus("active");
    };
    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const segment = result[0].transcript.trim();
        if (!segment) continue;
        if (result.isFinal) finalTranscriptRef.current = [finalTranscriptRef.current, segment].filter(Boolean).join(" ").trim();
        else interim = [interim, segment].filter(Boolean).join(" ").trim();
      }
      interimTranscriptRef.current = interim;
      setStatus("transcribing");
      setMicrophoneStatus("transcribing");
    };
    recognition.onerror = (event) => {
      const permissionRevoked = event.error === "not-allowed" || event.error === "service-not-allowed";
      if (permissionRevoked) {
        wantsListeningRef.current = false;
        setMicrophoneStatus("idle");
        setStatus("error");
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      if (cancelledRef.current) return;
      if (wantsListeningRef.current) {
        if (interimTranscriptRef.current) {
          finalTranscriptRef.current = [finalTranscriptRef.current, interimTranscriptRef.current].filter(Boolean).join(" ").trim();
          interimTranscriptRef.current = "";
        }
        restartTimerRef.current = setTimeout(() => {
          restartTimerRef.current = null;
          startRecognition();
        }, 150);
        return;
      }
      completeCapture();
    };
    recognitionRef.current = recognition;
    recognition.start();
  }

  function startListening() {
    if (!voiceFeatureSupported(window)) {
      setStatus("error");
      return;
    }
    cancelledRef.current = false;
    wantsListeningRef.current = true;
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    setStatus("listening");
    setMicrophoneStatus("active");
    startRecognition();
  }

  function stopListening() {
    wantsListeningRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRef.current) recognitionRef.current.stop();
    else completeCapture();
  }

  function cancelDictation() {
    cancelledRef.current = true;
    wantsListeningRef.current = false;
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setStatus("idle");
    setMicrophoneStatus("idle");
  }

  async function testMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      return;
    }
    setTestingMicrophone(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      analyser.fftSize = 256;
      source.connect(analyser);
      const samples = new Uint8Array(analyser.frequencyBinCount);
      await new Promise((resolve) => setTimeout(resolve, 600));
      analyser.getByteFrequencyData(samples);
      const average = samples.reduce((sum, value) => sum + value, 0) / Math.max(samples.length, 1);
      setMicrophoneStatus(average < 4 ? "low" : "active");
      stream.getTracks().forEach((track) => track.stop());
      await audioContext.close();
    } catch {
      setStatus("error");
    } finally {
      setTestingMicrophone(false);
    }
  }

  const active = status === "listening" || status === "transcribing";
  if (supported === false) return null;

  return <div className={compact ? "shrink-0" : "w-full sm:w-auto"}>
    {!compact ? <p className="mb-2 text-xs text-slate-600">Parlez distinctement près du micro, puis relisez votre réponse avant d’envoyer.</p> : null}
    <div className={compact ? "flex flex-wrap items-end gap-2" : "flex flex-col gap-2 sm:flex-row"}>
      <button type="button" onClick={active ? stopListening : startListening} disabled={disabled} aria-pressed={active} className={`inline-flex items-center justify-center gap-2 rounded-xl border text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${compact ? "min-h-12 px-3 py-2" : "min-h-11 w-full px-4 py-2 sm:w-auto"} ${active ? "border-red-300 bg-red-50 text-red-800" : "border-violet-300 bg-white text-violet-900"}`}>
        <MicrophoneIcon active={active} />
        <span>{active ? "Arrêter l'écoute" : label}</span>
      </button>
      {!compact ? <button type="button" onClick={() => void testMicrophone()} disabled={disabled || active || testingMicrophone} className="min-h-11 rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-900 disabled:cursor-not-allowed disabled:opacity-50">{testingMicrophone ? "Test..." : "Tester mon micro"}</button> : null}
      {active ? <button type="button" onClick={cancelDictation} className={`rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 ${compact ? "min-h-12 px-3 py-2" : "min-h-11 px-4 py-2"}`}>Annuler la dictée</button> : null}
    </div>
    <div className={compact ? "mt-1 text-[11px] leading-snug" : "mt-2 text-xs"} aria-live="polite">
      {!compact && microphoneStatus === "active" ? <p className="font-semibold text-emerald-700">Micro actif</p> : null}
      {!compact && microphoneStatus === "low" ? <p className="font-semibold text-amber-700">Son faible détecté, rapprochez-vous du micro</p> : null}
      {!compact && microphoneStatus === "transcribing" ? <p className="font-semibold text-cyan-700">Écoute en cours</p> : null}
      {status === "error" ? <p className="text-red-700">La capture vocale s'est arrêtée. Vérifiez l'autorisation du microphone ou utilisez le clavier.</p> : null}
      {active ? <><p className="font-semibold text-violet-800">{VOICE_STATUS_LABELS.listening}</p><p className={compact ? "mt-0.5 text-slate-600" : "mt-1 text-slate-600"}>Parlez distinctement près du micro, puis relisez votre réponse avant d’envoyer.</p></> : null}
      {status === "ready" ? <p className="font-semibold text-emerald-700">{VOICE_STATUS_LABELS.transcriptionReady}</p> : null}
      {!compact && status === "idle" ? <p className="text-slate-500">Saisie vocale facultative.</p> : null}
    </div>
  </div>;
}

function MicrophoneIcon({ active }: { active: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 shrink-0 ${active ? "animate-pulse" : ""}`}>
    <rect x="9" y="2" width="6" height="11" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0" />
    <path d="M12 17v5" />
    <path d="M8 22h8" />
  </svg>;
}
