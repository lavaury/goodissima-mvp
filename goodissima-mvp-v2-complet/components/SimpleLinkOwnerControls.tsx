"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { QRCodeBox } from "@/components/QRCodeBox";

type Action = "disable" | "publish" | "archive";

export function SimpleLinkOwnerControls({ linkId, publicUrl, status }: { linkId: string; publicUrl: string; status: string }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Action | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const labels: Record<Action, { button: string; title: string; body: string }> = {
    disable: { button: "Suspendre", title: "Suspendre ce lien ?", body: "Le formulaire public ne sera plus accessible. Vous pourrez le réactiver plus tard." },
    publish: { button: "Réactiver", title: "Réactiver ce lien ?", body: "Le formulaire public redeviendra immédiatement accessible avec la même adresse." },
    archive: { button: "Archiver", title: "Archiver ce lien ?", body: "Le lien public sera fermé définitivement. Les réponses existantes resteront conservées." },
  };

  async function run(action: Action) {
    setBusy(true); setError("");
    const response = await fetch(`/api/links/${encodeURIComponent(linkId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Action impossible.");
    else { setDialog(null); router.refresh(); }
    setBusy(false);
  }
  async function share() {
    if (navigator.share) await navigator.share({ title: "Lien Goodissima", url: publicUrl });
    else await navigator.clipboard.writeText(publicUrl);
  }
  const primary: Action | null = status === "ACTIVE" ? "disable" : status === "DISABLED" ? "publish" : null;
  return <>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => void share()} className="min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold">Partager</button>
      <button type="button" onClick={() => setQrOpen((value) => !value)} aria-expanded={qrOpen} className="min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold">QR code</button>
      {primary ? <button type="button" onClick={() => setDialog(primary)} className="min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold">{labels[primary].button}</button> : null}
      {status !== "ARCHIVED" ? <button type="button" onClick={() => setDialog("archive")} className="min-h-11 rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-800">Archiver</button> : null}
    </div>
    {qrOpen ? <div className="mt-4"><QRCodeBox value={publicUrl} fileName={`lien-goodissima-${linkId}.png`} description="Partagez ce QR code pour ouvrir directement ce lien." boussoleId="simple-link-qr-download" /></div> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p> : null}
    {dialog ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}><div role="dialog" aria-modal="true" aria-labelledby="simple-link-dialog-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h2 id="simple-link-dialog-title" className="text-xl font-bold">{labels[dialog].title}</h2><p className="mt-2 text-sm text-slate-600">{labels[dialog].body}</p><div className="mt-6 flex justify-end gap-3"><button type="button" disabled={busy} onClick={() => setDialog(null)} className="rounded-xl border px-4 py-2 font-semibold">Annuler</button><button type="button" disabled={busy} onClick={() => void run(dialog)} className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white">{busy ? "Traitement…" : "Confirmer"}</button></div></div></div> : null}
  </>;
}
