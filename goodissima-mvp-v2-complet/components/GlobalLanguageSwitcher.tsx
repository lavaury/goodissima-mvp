"use client";

import { usePathname } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function GlobalLanguageSwitcher() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <div className="fixed right-4 top-4 z-40 sm:right-6 sm:top-6">
      <LanguageSwitcher compact />
    </div>
  );
}
