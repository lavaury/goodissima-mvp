"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
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
      className="rounded-2xl border bg-white px-5 py-3 text-slate-900 disabled:opacity-60"
      disabled={isLoading}
      onClick={signOut}
    >
      {isLoading ? "Déconnexion..." : "Déconnexion"}
    </button>
  );
}
