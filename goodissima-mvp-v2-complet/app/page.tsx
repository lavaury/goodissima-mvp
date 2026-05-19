import Link from "next/link";
import Image from "next/image";
import { t } from "@/lib/i18n";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6">
      <div className="max-w-3xl">
        <Image
          src="/logo-goodissima.png"
          alt="Goodissima"
          width={280}
          height={120}
          priority
          className="mb-5 h-auto w-52 sm:mb-6 sm:w-72"
        />
        <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t("homepage.eyebrow")}
        </p>
        <h1 className="text-5xl font-bold tracking-tight">{t("homepage.headline")}</h1>
        <p className="mt-6 text-xl text-slate-600">{t("homepage.subheadline")}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/links/new"
            className="rounded-2xl bg-slate-900 px-6 py-3 text-center font-medium text-white"
          >
            {t("homepage.cta.createLink")}
          </Link>
          <Link href="/dashboard" className="rounded-2xl border px-6 py-3 text-center font-medium">
            {t("homepage.cta.dashboard")}
          </Link>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-4">
            <p className="font-semibold">{t("homepage.step.create.title")}</p>
            <p className="mt-1 text-sm text-slate-500">{t("homepage.step.create.text")}</p>
          </div>
          <div className="rounded-2xl border bg-white p-4">
            <p className="font-semibold">{t("homepage.step.filter.title")}</p>
            <p className="mt-1 text-sm text-slate-500">{t("homepage.step.filter.text")}</p>
          </div>
          <div className="rounded-2xl border bg-white p-4">
            <p className="font-semibold">{t("homepage.step.exchange.title")}</p>
            <p className="mt-1 text-sm text-slate-500">{t("homepage.step.exchange.text")}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
