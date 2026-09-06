"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function DashboardRealtimeRefresh() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refreshKey = searchParams.get("refresh");

  useEffect(() => {
    if (!refreshKey) return;

    router.refresh();
  }, [refreshKey, router]);

  return null;
}
