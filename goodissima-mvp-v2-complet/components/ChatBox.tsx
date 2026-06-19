"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { VoiceCaptureButton } from "@/components/VoiceCaptureButton";
import { mergeVoiceTranscript } from "@/lib/voice-opportunity";

type ChatMessage = {
  id: string;
  body: string;
  senderType?: string;
  senderEmail?: string;
  createdAt: Date | string;
};

const messageDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatMessageDate(date: Date | string) {
  return messageDateFormatter.format(new Date(date));
}

export function ChatBox({
  caseId,
  candidateAccessToken,
  candidateDisplayName = "Candidat",
  candidateContactLabel,
  candidateIdentityStatus,
  readOnly = false,
  readOnlyReason,
  senderEmail,
  senderType,
}: {
  caseId?: string;
  candidateAccessToken?: string;
  candidateDisplayName?: string;
  candidateContactLabel?: string;
  candidateIdentityStatus?: string;
  readOnly?: boolean;
  readOnlyReason?: string;
  senderEmail?: string;
  senderType: "OWNER" | "CANDIDATE";
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [showLatestButton, setShowLatestButton] = useState(false);
  const [newMessagesFromId, setNewMessagesFromId] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);
  const hasLoadedMessagesRef = useRef(false);
  const previousMessageCountRef = useRef(0);
  const toast = useToast();

  const updateNearBottomState = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearBottom = distanceFromBottom < 120;
    isNearBottomRef.current = isNearBottom;
    setShowLatestButton(!isNearBottom);

    return isNearBottom;
  }, []);

  const scrollToLatestMessage = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
    isNearBottomRef.current = true;
    setShowLatestButton(false);
    setNewMessagesFromId(null);
  }, []);

  const loadMessages = useCallback(async () => {
    if (!candidateAccessToken && !caseId) {
      console.error("ChatBox.loadMessages missing case reference", {
        caseId,
        hasCandidateAccessToken: Boolean(candidateAccessToken),
        senderType,
      });
      return;
    }

    const query = candidateAccessToken
      ? `candidateAccessToken=${encodeURIComponent(candidateAccessToken)}`
      : `caseId=${encodeURIComponent(caseId!)}`;

    try {
      const res = await fetch(`/api/messages?${query}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        console.error("ChatBox.loadMessages failed", {
          status: res.status,
          caseId,
          hasCandidateAccessToken: Boolean(candidateAccessToken),
          senderType,
        });
        return;
      }

      const freshMessages = (await res.json()) as ChatMessage[];
      if (
        hasLoadedMessagesRef.current &&
        !isNearBottomRef.current &&
        freshMessages.length > previousMessageCountRef.current
      ) {
        const firstNewMessage = freshMessages[previousMessageCountRef.current];
        if (firstNewMessage) setNewMessagesFromId(firstNewMessage.id);
      }
      previousMessageCountRef.current = freshMessages.length;
      setMessages(freshMessages);
    } catch (error) {
      console.error("ChatBox.loadMessages error", {
        error,
        caseId,
        hasCandidateAccessToken: Boolean(candidateAccessToken),
        senderType,
      });
    }
  }, [caseId, candidateAccessToken, senderType]);

  useEffect(() => {
    void loadMessages();

    const interval = setInterval(() => {
      void loadMessages();
    }, 3000);

    return () => clearInterval(interval);
  }, [loadMessages]);

  useEffect(() => {
    function useDraft(event: Event) {
      const detail = (event as CustomEvent<{ caseId?: string; message?: string }>).detail;
      if (!detail?.message || detail.caseId !== caseId) return;

      setBody(detail.message);
      requestAnimationFrame(() => inputRef.current?.focus());
    }

    window.addEventListener("goodissima:use-ai-draft", useDraft);
    return () => window.removeEventListener("goodissima:use-ai-draft", useDraft);
  }, [caseId]);

  useEffect(() => {
    if (!hasLoadedMessagesRef.current) {
      hasLoadedMessagesRef.current = true;
      requestAnimationFrame(() => scrollToLatestMessage("auto"));
      return;
    }

    if (isNearBottomRef.current) {
      requestAnimationFrame(() => scrollToLatestMessage("smooth"));
      return;
    }

    updateNearBottomState();
  }, [messages, scrollToLatestMessage, updateNearBottomState]);

  async function sendMessage() {
    if (!body.trim() || sending || readOnly) return;

    setSending(true);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseId,
        candidateAccessToken,
        senderType,
        body,
      }),
    });
    setSending(false);

    if (!res.ok) {
      toast.error("Erreur lors de l'action");
      inputRef.current?.focus();
      return;
    }

    setBody("");
    toast.success("Message envoye");
    await loadMessages();
    requestAnimationFrame(() => scrollToLatestMessage("smooth"));
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-[#d6e7e8] bg-[#fffcf8] shadow-[0_18px_44px_rgba(47,52,55,0.07)] transition hover:shadow-[0_22px_52px_rgba(47,52,55,0.095)] lg:h-[560px] lg:min-h-0">
      <div className="border-b border-[#e7e0d6] bg-[#fffcf8] px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-[#2f3437]">Conversation</p>
            <p className="text-xs font-medium text-[#247f88]">
              {candidateDisplayName} · {candidateContactLabel ?? "Contact non renseigné"}
            </p>
            <p className="text-xs text-slate-500">Échanges horodatés et protégés.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {candidateIdentityStatus ? (
              <span className="inline-flex items-center rounded-full bg-[#e8f8f9] px-3 py-1 text-xs font-medium text-[#247f88] ring-1 ring-[#d6e7e8]">
                {candidateIdentityStatus}
              </span>
            ) : null}
            {sending ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-[#e8f8f9] px-3 py-1 text-xs font-medium text-[#247f88]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#2fb8c4]" />
                Envoi...
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={messagesContainerRef}
          onScroll={updateNearBottomState}
          className="h-full space-y-3 overflow-y-auto px-4 py-5 sm:px-5"
        >
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-sm rounded-2xl bg-[#f6f0e8] p-5 text-center ring-1 ring-[#e7e0d6]">
                <p className="font-medium text-[#2f3437]">Aucun message pour le moment</p>
                <p className="mt-1 text-sm text-[#766f68]">
                  Envoyez un premier message pour lancer l'échange dans cet espace sécurisé.
                </p>
              </div>
            </div>
          ) : null}
          {messages.map((message) => {
            const isOwnerMessage =
              message.senderType === "OWNER" ||
              Boolean(!message.senderType && senderEmail && message.senderEmail !== senderEmail);

            return (
              <div key={message.id}>
                {newMessagesFromId === message.id ? (
                  <div className="my-2 flex items-center gap-3 text-xs font-medium text-amber-700">
                    <span className="h-px flex-1 bg-amber-200" />
                    Nouveaux messages
                    <span className="h-px flex-1 bg-amber-200" />
                  </div>
                ) : null}
                <div
                  className={`flex ${isOwnerMessage ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={[
                      "max-w-[88%] rounded-[1.55rem] px-4 py-3.5 text-sm leading-relaxed shadow-[0_7px_18px_rgba(47,52,55,0.05)] transition hover:-translate-y-0.5 sm:max-w-[76%]",
                      isOwnerMessage
                        ? "rounded-br-xl bg-[#2d4350] text-white"
                        : "rounded-bl-lg border border-[#e7e0d6] bg-[#f6f0e8] text-[#2f3437]",
                    ].join(" ")}
                  >
                    <div
                      className={`flex flex-col gap-0.5 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${
                        isOwnerMessage ? "text-[#c9e7ea]" : "text-[#746d66]"
                      }`}
                    >
                      <span>{isOwnerMessage ? "Proprietaire" : "Candidat"}</span>
                      <time dateTime={new Date(message.createdAt).toISOString()} className="whitespace-nowrap">
                        {formatMessageDate(message.createdAt)}
                      </time>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words">{message.body}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {showLatestButton ? (
          <button
            type="button"
            onClick={() => scrollToLatestMessage("smooth")}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-[#d6e7e8] bg-white px-4 py-2 text-sm font-medium text-[#2f3437] shadow-lg transition hover:bg-[#e8f8f9]"
          >
            ↓ Dernier message
          </button>
        ) : null}
      </div>

      <div data-sticky-input="true" className="sticky bottom-0 flex flex-col gap-2 border-t border-[#e7e0d6] bg-[#fffcf8]/95 p-3 backdrop-blur sm:flex-row sm:items-end sm:p-4">
        {readOnly ? (
          <div className="flex-1 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            {readOnlyReason ?? "Les nouveaux messages sont bloques pour cette relation."}
          </div>
        ) : (
          <textarea
            ref={inputRef}
            rows={1}
            className="min-h-12 flex-1 resize-none rounded-2xl border border-[#d6e7e8] bg-white px-4 py-3 text-base text-[#2f3437] outline-none transition placeholder:text-[#9a928a] focus:border-[#2fb8c4] focus:ring-2 focus:ring-[#2fb8c4]/20 sm:text-sm"
            placeholder="Ecrire un message..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
          />
        )}

        {!readOnly ? (
          <VoiceCaptureButton
            label="Dicter ma réponse"
            compact
            disabled={sending}
            onTranscript={(transcript) => {
              setBody((current) => mergeVoiceTranscript(current, transcript));
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
          />
        ) : null}

        <button
          onClick={sendMessage}
          disabled={readOnly || sending || !body.trim()}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#263846] px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-[#2f4858] focus:outline-none focus:ring-2 focus:ring-[#2fb8c4]/30 disabled:translate-y-0 disabled:opacity-60"
        >
          <SendIcon />
          {sending ? "Envoi..." : "Envoyer"}
        </button>
      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 12l15-7-5 14-3-6-7-1z" />
      <path d="M11 13l8-8" />
    </svg>
  );
}
