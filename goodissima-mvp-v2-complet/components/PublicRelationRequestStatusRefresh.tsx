"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function PublicRelationRequestStatusRefresh({ pending }: { pending: boolean }) {
  const router = useRouter();
  useEffect(() => { if (!pending) return; const timer = window.setInterval(() => router.refresh(), 20_000); return () => window.clearInterval(timer); }, [pending, router]);
  return null;
}
