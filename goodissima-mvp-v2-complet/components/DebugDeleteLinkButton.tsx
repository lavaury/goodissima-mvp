"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

export function DebugDeleteLinkButton({ linkId }: { linkId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);

  async function deleteLink() {
    if (confirmation !== "DELETE" || loading) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/debug/links/${encodeURIComponent(linkId)}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });

      if (!res.ok) {
        toast.error("Action debug refusee");
        return;
      }

      toast.success("Lien de test detruit");
      router.replace(`/dashboard?refresh=${Date.now()}`);
      router.refresh();
    } catch {
      toast.error("Erreur lors de l'action");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
      <p className="text-sm font-semibold text-red-950">Supprimer ce lien de test</p>
      <input
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        placeholder="DELETE"
        className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm"
      />
      <button
        type="button"
        onClick={deleteLink}
        disabled={confirmation !== "DELETE" || loading}
        className="rounded-xl bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Suppression..." : "Supprimer ce lien de test"}
      </button>
    </div>
  );
}
