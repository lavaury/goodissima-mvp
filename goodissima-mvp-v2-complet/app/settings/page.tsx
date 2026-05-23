export const dynamic = "force-dynamic";

import { unstable_noStore as noStore } from "next/cache";
import { LogoutButton } from "@/components/LogoutButton";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { SettingsPanel } from "./SettingsPanel";

export default async function SettingsPage() {
  noStore();

  const { t } = getI18n();
  const owner = await getCurrentPrismaUser();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("settings.title")}</h1>
          <p className="mt-1 text-slate-500">{t("settings.subtitle")}</p>
        </div>
        <LogoutButton />
      </div>

      <PlatformNavigation active="settings" />
      <SettingsPanel ownerEmail={owner.email} organizationName={organizationName} />
    </main>
  );
}
