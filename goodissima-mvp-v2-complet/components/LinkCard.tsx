import Link from "next/link";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { QRCodeBox } from "@/components/QRCodeBox";

export function LinkCard({
  item
}: {
  item: { id: string; slug: string; title: string; city?: string | null };
}) {
  const publicPath = `/l/${item.slug}`;
  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}${publicPath}`;

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold">{item.title}</h3>
      {item.city && <p className="text-sm text-slate-500">{item.city}</p>}

      <div className="mt-4 rounded-xl bg-slate-50 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Lien à partager
        </p>
        <input
          value={publicUrl}
          readOnly
          className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <CopyLinkButton value={publicUrl} />
        <Link className="rounded-xl border px-4 py-2 text-sm" href={publicPath}>
          Voir le lien
        </Link>
        <Link className="rounded-xl border px-4 py-2 text-sm" href="/cases">
          Voir les dossiers
        </Link>
      </div>

      <div className="mt-5">
        <QRCodeBox value={publicUrl} fileName={`goodissima-${item.slug}.png`} />
      </div>
    </div>
  );
}
