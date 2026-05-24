import { getCurrentPrismaUser } from "@/lib/auth";
import { sendTestEmail } from "@/lib/email";

async function sendTest() {
  "use server";

  const owner = await getCurrentPrismaUser();
  await sendTestEmail(owner.email);
}

export default async function TestEmailPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Goodissima</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">Test email transactionnel</h1>
        <p className="mt-3 text-sm text-slate-600">
          Envoi d'un email test vers votre canal technique prive via le service Resend serveur.
        </p>
        <form action={sendTest} className="mt-6">
          <button className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
            Envoyer email test
          </button>
        </form>
      </div>
    </main>
  );
}
