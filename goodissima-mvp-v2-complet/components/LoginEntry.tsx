"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const next = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";
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
      setError(access?.reason ?? "Accès non autorisé.");
      return;
    }

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    setIsLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.replace(next);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10 sm:px-6">
      <div className="w-full max-w-sm">
        <Image
          src="/logo-goodissima.png"
          alt="Goodissima"
          width={280}
          height={120}
          priority
          className="mx-auto h-auto w-48 sm:w-56"
        />

        <h1 className="mt-8 text-center text-3xl font-bold text-slate-950">Connexion</h1>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="login-email" className="text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="login-email"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="login-password" className="text-sm font-medium text-slate-700">
              Mot de passe
            </label>
            <input
              id="login-password"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {privateAccessDenied ? (
            <p role="alert" className="text-sm text-red-700">
              Accès privé actif : votre email doit être invité pour créer un espace propriétaire.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-lg bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
          >
            {isLoading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <div className="mt-6 space-y-4 text-center text-sm">
          <Link className="font-medium text-slate-700 underline underline-offset-4 hover:text-slate-950" href="/reset-password">
            Mot de passe oublié ?
          </Link>
          <p className="text-slate-600">
            Pas encore de compte ?{" "}
            <Link
              className="font-semibold text-slate-950 underline underline-offset-4"
              href={`/signup?next=${encodeURIComponent(next)}`}
            >
              Créer un accès
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
