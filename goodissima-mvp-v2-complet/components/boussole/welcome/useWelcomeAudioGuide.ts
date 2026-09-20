"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type WelcomeAudioState = "idle" | "playing" | "paused" | "unavailable";

const welcomeChimeNotes = [
  { frequency: 392, offset: 0, duration: 0.34 },
  { frequency: 493.88, offset: 0.32, duration: 0.34 },
  { frequency: 587.33, offset: 0.64, duration: 0.44 },
] as const;

export function playWelcomeChime({ audioContext, destination = audioContext.destination, signal }: {
  audioContext: AudioContext;
  destination?: AudioNode;
  signal?: AbortSignal;
}): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    const startAt = audioContext.currentTime + 0.02;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      for (const oscillator of oscillators) oscillator.disconnect();
      for (const gain of gains) gain.disconnect();
      resolve();
    };
    const abort = () => {
      for (const oscillator of oscillators) {
        try { oscillator.stop(); } catch { /* already stopped */ }
      }
      finish();
    };

    signal?.addEventListener("abort", abort, { once: true });
    welcomeChimeNotes.forEach((note, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const noteStart = startAt + note.offset;
      const noteEnd = noteStart + note.duration;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(note.frequency, noteStart);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.045, noteStart + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start(noteStart);
      oscillator.stop(noteEnd + 0.02);
      if (index === welcomeChimeNotes.length - 1) oscillator.onended = finish;
      oscillators.push(oscillator);
      gains.push(gain);
    });
  });
}

export function useWelcomeAudioGuide() {
  const [state, setState] = useState<WelcomeAudioState>("idle");
  const [transcript, setTranscript] = useState("");
  const [chimeEnabled, setChimeEnabled] = useState(true);
  const [isIntroducing, setIsIntroducing] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chimeAbortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef(0);

  const cancelActiveSession = useCallback(() => {
    sessionRef.current += 1;
    chimeAbortRef.current?.abort();
    chimeAbortRef.current = null;
    const activeUtterance = utteranceRef.current;
    if (activeUtterance) {
      activeUtterance.onend = null;
      activeUtterance.onerror = null;
    }
    utteranceRef.current = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setIsIntroducing(false);
  }, []);

  const stop = useCallback(() => {
    cancelActiveSession();
    setState((current) => current === "unavailable" ? current : "idle");
  }, [cancelActiveSession]);

  const reset = useCallback(() => {
    cancelActiveSession();
    setState((current) => current === "unavailable" ? current : "idle");
    setTranscript("");
  }, [cancelActiveSession]);

  useEffect(() => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) setState("unavailable");
    return () => {
      sessionRef.current += 1;
      chimeAbortRef.current?.abort();
      const activeUtterance = utteranceRef.current;
      if (activeUtterance) {
        activeUtterance.onend = null;
        activeUtterance.onerror = null;
      }
      utteranceRef.current = null;
      window.speechSynthesis?.cancel();
      const audioContext = audioContextRef.current;
      audioContextRef.current = null;
      if (audioContext && audioContext.state !== "closed") void audioContext.close();
    };
  }, []);

  const play = useCallback(async (text: string) => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setState("unavailable");
      return;
    }
    cancelActiveSession();
    const sessionId = sessionRef.current;
    const chimeAbort = new AbortController();
    chimeAbortRef.current = chimeAbort;
    setTranscript(text);
    setState("playing");

    if (chimeEnabled && "AudioContext" in window) {
      setIsIntroducing(true);
      try {
        const audioContext = audioContextRef.current ?? new AudioContext();
        audioContextRef.current = audioContext;
        if (audioContext.state === "suspended") await audioContext.resume();
        await playWelcomeChime({ audioContext, signal: chimeAbort.signal });
      } catch {
        // The optional chime must never prevent the spoken presentation.
      }
    }
    if (sessionRef.current !== sessionId || chimeAbort.signal.aborted) return;
    chimeAbortRef.current = null;
    setIsIntroducing(false);

    const utterance = new SpeechSynthesisUtterance(text);
    const frenchVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("fr"));
    if (frenchVoice) utterance.voice = frenchVoice;
    utterance.lang = "fr-FR";
    utterance.rate = 0.9;
    utterance.volume = 0.75;
    utterance.onend = () => {
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null;
      setState("idle");
    };
    utterance.onerror = () => {
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null;
      setState("idle");
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [cancelActiveSession, chimeEnabled]);

  const pause = useCallback(() => {
    if (state !== "playing") return;
    window.speechSynthesis.pause();
    setState("paused");
  }, [state]);

  const resume = useCallback(() => {
    if (state !== "paused") return;
    window.speechSynthesis.resume();
    setState("playing");
  }, [state]);

  return { state, transcript, chimeEnabled, isIntroducing, setChimeEnabled, play, pause, resume, stop, reset };
}
