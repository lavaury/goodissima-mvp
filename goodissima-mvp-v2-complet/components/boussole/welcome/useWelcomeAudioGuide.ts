"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type WelcomeAudioState = "idle" | "playing" | "paused" | "unavailable";

export function useWelcomeAudioGuide() {
  const [state, setState] = useState<WelcomeAudioState>("idle");
  const [transcript, setTranscript] = useState("");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const cancelActiveUtterance = useCallback(() => {
    const activeUtterance = utteranceRef.current;
    if (activeUtterance) {
      activeUtterance.onend = null;
      activeUtterance.onerror = null;
    }
    utteranceRef.current = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  const stop = useCallback(() => {
    cancelActiveUtterance();
    setState((current) => current === "unavailable" ? current : "idle");
  }, [cancelActiveUtterance]);

  const reset = useCallback(() => {
    cancelActiveUtterance();
    setState((current) => current === "unavailable" ? current : "idle");
    setTranscript("");
  }, [cancelActiveUtterance]);

  useEffect(() => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) setState("unavailable");
    return () => {
      const activeUtterance = utteranceRef.current;
      if (activeUtterance) {
        activeUtterance.onend = null;
        activeUtterance.onerror = null;
      }
      utteranceRef.current = null;
      window.speechSynthesis?.cancel();
    };
  }, []);

  const play = useCallback((text: string) => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setState("unavailable");
      return;
    }
    cancelActiveUtterance();
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
    setTranscript(text);
    setState("playing");
    window.speechSynthesis.speak(utterance);
  }, [cancelActiveUtterance]);

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

  return { state, transcript, play, pause, resume, stop, reset };
}
