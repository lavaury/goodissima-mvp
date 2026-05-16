"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setIsLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setIsLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Mot de passe mis a jour. Redirection...");

    window.setTimeout(() => {
      router.replace("/dashboard");
      router.refresh();
    }, 1000);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Goodissima Banque
      </p>
      <h1 className="mt-3 text-3xl font-bold">Nouveau mot de passe</h1>
      <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border bg-white p-6">
        <input
          className="w-full rounded-xl border px-4 py-3"
          type="password"
          autoComplete="new-password"
          placeholder="Nouveau mot de passe"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
          minLength={6}
        />
        <input
          className="w-full rounded-xl border px-4 py-3"
          type="password"
          autoComplete="new-password"
          placeholder="Confirmer le mot de passe"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          minLength={6}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        <button
          className="w-full rounded-2xl bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-60"
          disabled={isLoading}
        >
          {isLoading ? "Mise a jour..." : "Mettre a jour le mot de passe"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        <Link className="font-medium text-slate-900 underline" href="/login">
          Retour a la connexion
        </Link>
      </p>
    </main>
  );
}
