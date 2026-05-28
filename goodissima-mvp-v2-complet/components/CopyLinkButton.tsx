"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastProvider";

export function CopyLinkButton({ value, label = "Copier le lien" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Lien copié");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erreur lors de l'action");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
    >
      {copied ? "Lien copié" : label}
    </button>
  );
}
