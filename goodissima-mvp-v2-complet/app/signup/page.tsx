"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    setIsLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (data.session) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setMessage("Compte créé. Vérifiez votre email si la confirmation est activée.");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Goodissima Banque
      </p>
      <h1 className="mt-3 text-3xl font-bold">Créer un accès conseiller</h1>
      <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border bg-white p-6">
        <input
          className="w-full rounded-xl border px-4 py-3"
          autoComplete="name"
          placeholder="Nom"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
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
          autoComplete="new-password"
          placeholder="Mot de passe"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        <button
          className="w-full rounded-2xl bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-60"
          disabled={isLoading}
        >
          {isLoading ? "Création..." : "Créer le compte"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Déjà un compte ?{" "}
        <Link className="font-medium text-slate-900 underline" href="/login">
          Se connecter
        </Link>
      </p>
    </main>
  );
}
