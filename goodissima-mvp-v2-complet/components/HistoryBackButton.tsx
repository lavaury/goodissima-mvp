"use client";

import { useRouter } from "next/navigation";

export function HistoryBackButton() {
  const router = useRouter();
  return <button type="button" onClick={() => router.back()} className="inline-flex min-h-11 items-center font-semibold text-[#247f88] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700">← Retour</button>;
}
