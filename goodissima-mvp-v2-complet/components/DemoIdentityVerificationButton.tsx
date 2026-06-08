"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

export function DemoIdentityVerificationButton() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function verifyIdentity() {
    if (loading) return;

    setLoading(true);

    try {
      const response = await fetch("/api/identity/demo-verification", {
        method: "POST",
      });

      if (!response.ok) {
        toast.error("Identité non vérifiée");
        return;
      }

      toast.success("Identité vérifiée");
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
      onClick={verifyIdentity}
      disabled={loading}
      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Vérification..." : "Vérifier mon identité"}
    </button>
  );
}
