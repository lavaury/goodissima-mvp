"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

export function DemoCredentialRevocationButton() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function revokeCredential() {
    if (loading) return;

    setLoading(true);

    try {
      const response = await fetch("/api/identity/revoke-demo-credential", {
        method: "POST",
      });

      if (!response.ok) {
        toast.error("Attestation non revoquee");
        return;
      }

      toast.success("Attestation revoquee");
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
      onClick={revokeCredential}
      disabled={loading}
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Revocation..." : "Revoquer mon attestation (demo)"}
    </button>
  );
}
