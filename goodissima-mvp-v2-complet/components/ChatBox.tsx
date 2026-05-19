"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

type ChatMessage = {
  id: string;
  body: string;
  senderType?: string;
  senderEmail: string;
  createdAt: Date | string;
};

function getNewestMessageTime(messages: ChatMessage[]) {
  return messages.reduce((newestTime, message) => {
    const messageTime = new Date(message.createdAt).getTime();

    return Number.isFinite(messageTime) ? Math.max(newestTime, messageTime) : newestTime;
  }, 0);
}

export function ChatBox({
  caseId,
  candidateAccessToken,
  initialMessages,
  senderEmail,
  senderType,
}: {
  caseId?: string;
  candidateAccessToken?: string;
  initialMessages: ChatMessage[];
  senderEmail: string;
  senderType: "OWNER" | "CANDIDATE";
}) {
  const initialMessagesKey = useMemo(
    () => initialMessages.map((message) => `${message.id}:${message.createdAt}`).join("|"),
    [initialMessages],
  );
  const initialMessagesNewestTime = useMemo(
    () => getNewestMessageTime(initialMessages),
    [initialMessagesKey],
  );
  const [messages, setMessages] = useState(initialMessages);
  const [syncedMessagesKey, setSyncedMessagesKey] = useState(initialMessagesKey);
  const [body, setBody] = useState("");
  const router = useRouter();
  const toast = useToast();

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
    if (syncedMessagesKey === initialMessagesKey) return;

    setMessages((currentMessages) => {
      if (currentMessages.length === 0) return initialMessages;

      const currentNewestTime = getNewestMessageTime(currentMessages);

      return initialMessagesNewestTime > currentNewestTime ? initialMessages : currentMessages;
    });
    setSyncedMessagesKey(initialMessagesKey);
  }, [initialMessages, initialMessagesKey, initialMessagesNewestTime, syncedMessagesKey]);

  useEffect(() => {
    void loadMessages();

    const interval = setInterval(() => {
      void loadMessages();
    }, 3000);

    return () => clearInterval(interval);
  }, [loadMessages]);

  async function sendMessage() {
    if (!body.trim()) return;

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseId,
        candidateAccessToken,
        senderEmail,
        senderType,
        body,
      }),
    });

    if (!res.ok) {
      toast.error("Erreur lors de l'action");
      return;
    }

    const createdMessage = await res.json();

    setMessages((currentMessages) =>
      currentMessages.some((message) => message.id === createdMessage.id)
        ? currentMessages
        : [...currentMessages, createdMessage],
    );
    setBody("");
    toast.success("Message envoye");
    router.refresh();
    await loadMessages();
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] min-h-[560px] flex-col rounded-2xl border bg-white lg:h-[520px] lg:min-h-0">
      <div className="border-b px-4 py-4 font-semibold sm:px-5">Conversation</div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-5">
        {messages.map((message) => {
          const isOwnerMessage =
            message.senderType === "OWNER" ||
            (!message.senderType && message.senderEmail !== senderEmail);

          return (
            <div
              key={message.id}
              className={`flex ${isOwnerMessage ? "justify-end" : "justify-start"}`}
            >
              <div
                className={[
                  "max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm sm:max-w-[72%]",
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
          );
        })}
      </div>

      <div className="sticky bottom-0 flex gap-2 border-t bg-white p-3 sm:p-4">
        <input
          className="min-h-12 flex-1 rounded-xl border px-4 py-3 text-base sm:text-sm"
          placeholder="Ecrire un message..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        <button
          onClick={sendMessage}
          className="min-h-12 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white"
        >
          Envoyer
        </button>
      </div>
    </div>
  );
}
