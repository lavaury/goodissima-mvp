"use client";

import { RelationGovernanceStatus } from "@prisma/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import {
  getRelationGovernanceStatusDescription,
  getRelationGovernanceStatusLabel,
} from "@/lib/relation-governance";

const actionButtons = [
  { status: RelationGovernanceStatus.SUSPENDED, label: "Suspendre" },
  { status: RelationGovernanceStatus.CLOSED, label: "Cloturer" },
  { status: RelationGovernanceStatus.BLOCKED, label: "Bloquer" },
];

export function RelationGovernanceBadge({
  status,
  reason,
}: {
  status: RelationGovernanceStatus | string;
  reason?: string | null;
}) {
  const classes =
    status === RelationGovernanceStatus.ACTIVE
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === RelationGovernanceStatus.SUSPENDED
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : status === RelationGovernanceStatus.CLOSED
          ? "bg-slate-100 text-slate-700 ring-slate-200"
          : "bg-rose-50 text-rose-700 ring-rose-200";

  return (
    <div className={`rounded-2xl px-3 py-2 text-xs ring-1 ${classes}`}>
      <p className="font-semibold">Gouvernance : {getRelationGovernanceStatusLabel(status)}</p>
      <p className="mt-0.5">{getRelationGovernanceStatusDescription(status)}</p>
      {reason ? <p className="mt-1 font-medium">Motif : {reason}</p> : null}
    </div>
  );
}

export function RelationGovernanceControls({
  caseId,
  status,
  reason,
}: {
  caseId: string;
  status: RelationGovernanceStatus;
  reason?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentReason, setCurrentReason] = useState(reason ?? "");
  const [nextReason, setNextReason] = useState("");
  const [savingStatus, setSavingStatus] = useState<RelationGovernanceStatus | null>(null);

  async function updateGovernance(nextStatus: RelationGovernanceStatus) {
    setSavingStatus(nextStatus);
    const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ governanceStatus: nextStatus, governanceReason: nextReason }),
    });
    setSavingStatus(null);

    if (!res.ok) {
      toast.error("Gouvernance non modifiee");
      return;
    }

    const updated = (await res.json()) as {
      governanceStatus: RelationGovernanceStatus;
      governanceReason?: string | null;
    };
    setCurrentStatus(updated.governanceStatus);
    setCurrentReason(updated.governanceReason ?? "");
    setNextReason("");
    toast.success("Gouvernance mise a jour");
    router.refresh();
  }

  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5 lg:p-4">
      <div>
        <h2 className="font-semibold">Gouvernance relationnelle</h2>
        <p className="mt-1 text-sm text-slate-500">Maitrise des echanges et de l'acces participant.</p>
      </div>
      <div className="mt-3">
        <RelationGovernanceBadge status={currentStatus} reason={currentReason} />
      </div>
      <textarea
        className="mt-3 min-h-20 w-full rounded-xl border bg-white px-3 py-2 text-sm"
        placeholder="Motif optionnel"
        value={nextReason}
        onChange={(event) => setNextReason(event.target.value)}
      />
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {currentStatus === RelationGovernanceStatus.ACTIVE
          ? actionButtons.map((action) => (
              <button
                key={action.status}
                type="button"
                onClick={() => void updateGovernance(action.status)}
                disabled={savingStatus !== null}
                className="rounded-xl border px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {savingStatus === action.status ? "Mise a jour..." : action.label}
              </button>
            ))
          : null}
        {currentStatus === RelationGovernanceStatus.SUSPENDED ? (
          <button
            type="button"
            onClick={() => void updateGovernance(RelationGovernanceStatus.ACTIVE)}
            disabled={savingStatus !== null}
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {savingStatus === RelationGovernanceStatus.ACTIVE ? "Reactivation..." : "Reactiver"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
