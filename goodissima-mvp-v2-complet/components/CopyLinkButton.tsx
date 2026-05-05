"use client";
import { useState } from "react";
export function CopyLinkButton({ value, label = "Copier le lien" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { alert("Impossible de copier automatiquement. Copiez le lien manuellement."); } }
  return <button type="button" onClick={copy} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">{copied ? "Lien copié ✓" : label}</button>;
}
