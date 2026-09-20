"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function GovernedInvitationStatusRefresh({ intervalMs = 5000, pendingCount = 1 }: { intervalMs?: number; pendingCount?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refreshVisible = () => { if (document.visibilityState === "visible") router.refresh(); };
    const onVisibility = () => { if (document.visibilityState === "visible") router.refresh(); };
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", onVisibility);
    const timer = pendingCount > 0 ? window.setInterval(refreshVisible, intervalMs) : null;
    return () => { window.removeEventListener("focus", refreshVisible); document.removeEventListener("visibilitychange", onVisibility); if (timer !== null) window.clearInterval(timer); };
  }, [intervalMs, pendingCount, router]);
  return null;
}
