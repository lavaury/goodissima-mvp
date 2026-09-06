"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton({ compact = false }: { compact?: boolean } = {}) {
  const router = useRouter();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);

  async function signOut() {
    setIsLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      className={compact
        ? "rounded-2xl border bg-white px-2 py-3 text-xs text-slate-900 disabled:opacity-60 sm:px-5 sm:text-base"
        : "rounded-2xl border bg-white px-5 py-3 text-slate-900 disabled:opacity-60"}
      disabled={isLoading}
      onClick={signOut}
    >
      {isLoading ? t("auth.loggingOut") : t("auth.logout")}
    </button>
  );
}
