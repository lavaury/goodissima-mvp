"use client";
import Link from "next/link";

export default function WorkspaceCreationError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-4xl px-4 py-8">
    <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <h1 className="text-xl font-bold">Création du Workspace indisponible</h1>
      <p className="mt-2">Vérifiez le nom saisi et, si vous créez depuis un Portfolio, que celui-ci est toujours actif et accessible à votre compte.</p>
    </div>
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" onClick={reset} className="min-h-11 rounded-lg border px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Réessayer</button>
      <Link href="/gouvernance" className="inline-flex min-h-11 items-center rounded-lg border px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Mes espaces</Link>
    </div>
  </main>;
}
