"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const privateAccessDenied = searchParams.get("private_access") === "denied";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    const accessRes = await fetch("/api/access-invitations/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail }),
    });

    const access = await accessRes.json().catch(() => null);

    if (!accessRes.ok || access?.allowed === false) {
      setIsLoading(false);
      setError(access?.reason ?? "Acces non autorise.");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

    setIsLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.replace(next);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Goodissima
      </p>
      <h1 className="mt-3 text-3xl font-bold">Connexion</h1>
      <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border bg-white p-6">
        <input
          className="w-full rounded-xl border px-4 py-3"
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          className="w-full rounded-xl border px-4 py-3"
          type="password"
          autoComplete="current-password"
          placeholder="Mot de passe"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {privateAccessDenied ? (
          <p className="text-sm text-red-600">
            Acces prive actif: votre email doit etre invite pour creer un espace proprietaire.
          </p>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          className="w-full rounded-2xl bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-60"
          disabled={isLoading}
        >
          {isLoading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        <Link className="font-medium text-slate-900 underline" href="/reset-password">
          Mot de passe oublie ?
        </Link>
      </p>
      <p className="mt-4 text-center text-sm text-slate-600">
        Pas encore de compte ?{" "}
        <Link className="font-medium text-slate-900 underline" href="/signup">
          Créer un accès
        </Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
