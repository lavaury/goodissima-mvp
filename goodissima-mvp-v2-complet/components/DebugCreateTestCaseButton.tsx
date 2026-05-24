"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

export function DebugCreateTestCaseButton({ linkId }: { linkId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function createTestCase() {
    if (loading) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/debug/links/${encodeURIComponent(linkId)}/create-test-case`, {
        method: "POST",
      });

      if (!res.ok) {
        toast.error("Action debug refusee");
        return;
      }

      toast.success("Conversation de test creee");
      router.replace(`/dashboard?refresh=${Date.now()}`);
      router.refresh();
    } catch {
      toast.error("Erreur lors de l'action");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={createTestCase}
      disabled={loading}
      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
    >
      {loading ? "Creation..." : "Creer conversation de test"}
    </button>
  );
}
