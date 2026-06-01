"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PrivateAccessPage() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login?private_access=denied";
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Goodissima</p>
      <h1 className="mt-3 text-3xl font-bold">Acces prive sur invitation</h1>
      <p className="mt-4 text-sm leading-6 text-slate-600">
        Cet espace proprietaire est reserve aux personnes explicitement invitees. Les liens publics candidats
        restent accessibles.
      </p>
      <div className="mt-8 flex flex-col gap-3 rounded-2xl border bg-white p-6">
        <button
          type="button"
          onClick={signOut}
          disabled={isSigningOut}
          className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {isSigningOut ? "Deconnexion..." : "Changer de compte"}
        </button>
        <Link className="text-center text-sm font-medium text-slate-700 underline" href="/login">
          Retour a la connexion
        </Link>
      </div>
    </main>
  );
}
