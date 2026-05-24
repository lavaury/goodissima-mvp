"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ToastProvider";

type ChatMessage = {
  id: string;
  body: string;
  senderType?: string;
  senderEmail?: string;
  createdAt: Date | string;
};

export function ChatBox({
  caseId,
  candidateAccessToken,
  senderEmail,
  senderType,
}: {
  caseId?: string;
  candidateAccessToken?: string;
  senderEmail?: string;
  senderType: "OWNER" | "CANDIDATE";
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [showLatestButton, setShowLatestButton] = useState(false);
  const [newMessagesFromId, setNewMessagesFromId] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
    if (!body.trim() || sending) return;

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
    <div className="flex h-[calc(100vh-9rem)] min-h-[560px] flex-col rounded-2xl border bg-white lg:h-[520px] lg:min-h-0">
      <div className="border-b px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Conversation</p>
            <p className="text-xs text-slate-500">Échanges horodatés et protégés.</p>
          </div>
          {sending ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Envoi...</span>
          ) : null}
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
              <div className="max-w-sm rounded-2xl bg-slate-50 p-5 text-center">
                <p className="font-medium text-slate-800">Aucun message pour le moment</p>
                <p className="mt-1 text-sm text-slate-500">
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
                      "max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm transition sm:max-w-[72%]",
                      isOwnerMessage
                        ? "rounded-br-md bg-slate-900 text-white"
                        : "rounded-bl-md border bg-slate-50 text-slate-900",
                    ].join(" ")}
                  >
                    <p className={isOwnerMessage ? "text-xs text-slate-300" : "text-xs text-slate-500"}>
                      {isOwnerMessage ? "Proprietaire" : "Candidat"}
                    </p>
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
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-lg hover:bg-slate-50"
          >
            ↓ Dernier message
          </button>
        ) : null}
      </div>

      <div className="sticky bottom-0 flex gap-2 border-t bg-white p-3 sm:p-4">
        <input
          ref={inputRef}
          className="min-h-12 flex-1 rounded-xl border px-4 py-3 text-base sm:text-sm"
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

        <button
          onClick={sendMessage}
          disabled={sending || !body.trim()}
          className="min-h-12 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {sending ? "Envoi..." : "Envoyer"}
        </button>
      </div>
    </div>
  );
}
