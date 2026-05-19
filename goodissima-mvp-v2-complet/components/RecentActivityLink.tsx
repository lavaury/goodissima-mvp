"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function RecentActivityLink({
  caseId,
  children,
}: {
  caseId: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={`/cases/${caseId}?refresh=1`}
      prefetch={false}
      className="flex flex-col gap-1 py-3 text-sm hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
      onClick={() => {
        console.log("NAVIGATION FROM RecentActivity", caseId, Date.now());
      }}
    >
      {children}
    </Link>
  );
}
