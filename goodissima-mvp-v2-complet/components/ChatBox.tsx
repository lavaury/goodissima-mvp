"use client";
import { useState } from "react";
export function ChatBox({ caseId, initialMessages, senderEmail, senderType }: { caseId: string; initialMessages: Array<{ id: string; body: string; senderEmail: string; createdAt: Date | string }>; senderEmail: string; senderType: "OWNER" | "CANDIDATE"; }) {
 const [messages, setMessages] = useState(initialMessages); const [body, setBody] = useState("");const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 4000);

    return () => clearInterval(interval);
  }, [router]);
 async function sendMessage() { if (!body.trim()) return; const res = await fetch("/api/messages", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ caseId, senderEmail, senderType, body }) }); if (!res.ok) { alert("Erreur lors de l'envoi."); return; } const created = await res.json(); setMessages((prev)=>[...prev, created]); setBody(""); }
 return <div className="flex h-[520px] flex-col rounded-2xl border bg-white"><div className="border-b p-4 font-semibold">Conversation</div><div className="flex-1 space-y-3 overflow-y-auto p-4">{messages.map((m)=><div key={m.id} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{m.senderEmail}</p><p>{m.body}</p></div>)}</div><div className="flex gap-2 border-t p-4"><input className="flex-1 rounded-xl border px-3 py-2" placeholder="Écrire un message..." value={body} onChange={(e)=>setBody(e.target.value)}/><button onClick={sendMessage} className="rounded-xl bg-slate-900 px-4 py-2 text-white">Envoyer</button></div></div>;
}
