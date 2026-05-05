"use client";

import { QRCodeCanvas } from "qrcode.react";

export function QRCodeBox({
  value,
  fileName = "goodissima-qr-code.png"
}: {
  value: string;
  fileName?: string;
}) {
  function downloadQRCode() {
    const canvas = document.getElementById(`qr-${fileName}`) as HTMLCanvasElement | null;

    if (!canvas) {
      alert("QR code introuvable.");
      return;
    }

    const pngUrl = canvas.toDataURL("image/png");
    const downloadLink = document.createElement("a");

    downloadLink.href = pngUrl;
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }

  return (
    <div className="rounded-2xl border bg-white p-4">
      <p className="mb-2 text-sm font-medium text-slate-700">QR Code</p>
      <div className="flex items-center gap-4">
        <div className="rounded-xl border bg-white p-2">
          <QRCodeCanvas id={`qr-${fileName}`} value={value} size={128} includeMargin />
        </div>
        <div>
          <p className="text-sm text-slate-500">
            À imprimer ou afficher pour permettre un contact sécurisé sans donner votre téléphone.
          </p>
          <button
            type="button"
            onClick={downloadQRCode}
            className="mt-3 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Télécharger le QR code
          </button>
        </div>
      </div>
    </div>
  );
}
