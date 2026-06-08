"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RecoveryState = "checking" | "ready" | "invalid";

const invalidRecoveryLinkMessage =
  "Le lien de reinitialisation est expire ou invalide. Veuillez demander un nouveau lien.";

function getPasswordUpdateErrorMessage(message: string) {
  return message.toLowerCase().includes("auth session missing")
    ? invalidRecoveryLinkMessage
    : message;
}

function UpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("checking");

  useEffect(() => {
    let active = true;

    async function prepareRecoverySession() {
      const supabase = createClient();
      const code = searchParams.get("code");

      setError(null);

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!active) return;

        if (error) {
          setError(invalidRecoveryLinkMessage);
          setRecoveryState("invalid");
          return;
        }

        setRecoveryState("ready");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (!session) {
        setError(invalidRecoveryLinkMessage);
        setRecoveryState("invalid");
        return;
      }

      setRecoveryState("ready");
    }

    prepareRecoverySession().catch(() => {
      if (!active) return;

      setError(invalidRecoveryLinkMessage);
      setRecoveryState("invalid");
    });

    return () => {
      active = false;
    };
  }, [searchParams]);

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
      setError(getPasswordUpdateErrorMessage(error.message));
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
        Goodissima
      </p>
      <h1 className="mt-3 text-3xl font-bold">Nouveau mot de passe</h1>
      <div className="mt-8 rounded-2xl border bg-white p-6">
        {recoveryState === "checking" ? (
          <p className="text-sm text-slate-600">Verification du lien de reinitialisation...</p>
        ) : null}

        {recoveryState === "invalid" ? (
          <div className="space-y-4">
            <p className="text-sm text-red-600">{error ?? invalidRecoveryLinkMessage}</p>
            <Link
              className="block w-full rounded-2xl bg-slate-900 px-5 py-3 text-center font-medium text-white"
              href="/reset-password"
            >
              Demander un nouveau lien
            </Link>
          </div>
        ) : null}

        {recoveryState === "ready" ? (
          <form onSubmit={submit} className="space-y-4">
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
        ) : null}
      </div>
      <p className="mt-4 text-center text-sm text-slate-600">
        <Link className="font-medium text-slate-900 underline" href="/login">
          Retour a la connexion
        </Link>
      </p>
    </main>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={null}>
      <UpdatePasswordForm />
    </Suspense>
  );
}
