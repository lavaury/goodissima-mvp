"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function PublicOpportunitySecureExchange({ gLinkId }: { gLinkId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function startExchange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gLinkId, message: message.trim() }),
      });
      const result = await response.json();
      const token = typeof result.candidateAccessToken === "string" ? result.candidateAccessToken : "";
      if (!response.ok || !token) {
        setError(typeof result.error === "string" ? result.error : "Impossible de commencer l’échange pour le moment.");
        setPending(false);
        return;
      }
      router.push(`/secure/${encodeURIComponent(token)}`);
    } catch {
      setError("Impossible de commencer l’échange pour le moment.");
      setPending(false);
    }
  }

  return <section className="mt-7 border-t pt-7" aria-labelledby="secure-exchange-title">
    <h2 id="secure-exchange-title" className="text-xl font-bold text-slate-950">Cette opportunité vous intéresse ?</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">
      Commencez un échange sécurisé avec son auteur. Vous pourrez ensuite discuter et partager uniquement les informations nécessaires.
    </p>
    <form className="mt-5" onSubmit={startExchange}>
      <label className="block text-sm font-semibold text-slate-800">
        Votre message <span className="font-normal text-slate-500">(facultatif)</span>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Vous pouvez ajouter un premier message."
          className="mt-2 block w-full resize-y rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/20"
        />
      </label>
      {error ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 min-h-12 w-full rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:cursor-wait disabled:opacity-70 sm:w-auto"
      >
        {pending ? "Ouverture de l’échange…" : "Commencer l’échange sécurisé"}
      </button>
    </form>
  </section>;
}
