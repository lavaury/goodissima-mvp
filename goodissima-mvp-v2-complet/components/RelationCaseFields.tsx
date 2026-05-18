"use client";

import { RelationPriority, RelationStatus } from "@prisma/client";
import { useState } from "react";
import { useToast } from "@/components/ToastProvider";

const priorityOptions = [
  { value: RelationPriority.NORMAL, label: "Normale" },
  { value: RelationPriority.HIGH, label: "Prioritaire" },
  { value: RelationPriority.URGENT, label: "Urgente" },
];

const statusOptions = [
  { value: RelationStatus.NEW, label: "Nouveau" },
  { value: RelationStatus.WAITING_CANDIDATE, label: "En attente candidat" },
  { value: RelationStatus.WAITING_OWNER, label: "En attente proprietaire" },
  { value: RelationStatus.REVIEWING, label: "A verifier" },
  { value: RelationStatus.VALIDATED, label: "Valide" },
  { value: RelationStatus.REJECTED, label: "Refuse" },
  { value: RelationStatus.CLOSED, label: "Cloture" },
];

export function formatRelationPriority(priority: string) {
  return priorityOptions.find((option) => option.value === priority)?.label ?? priority;
}

export function formatRelationStatus(status: string) {
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

export function RelationCaseFields({
  caseId,
  priority,
  status,
  editable,
}: {
  caseId: string;
  priority: RelationPriority;
  status: RelationStatus;
  editable: boolean;
}) {
  const [currentPriority, setCurrentPriority] = useState(priority);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [feedback, setFeedback] = useState("");
  const toast = useToast();

  async function updateCase(data: { priority?: RelationPriority; status?: RelationStatus }) {
    const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      toast.error("Erreur lors de l'action");
      return false;
    }

    setFeedback("Mis a jour");
    setTimeout(() => setFeedback(""), 2000);
    return true;
  }

  async function onPriorityChange(nextPriority: RelationPriority) {
    const previousPriority = currentPriority;
    setCurrentPriority(nextPriority);

    if (!(await updateCase({ priority: nextPriority }))) {
      setCurrentPriority(previousPriority);
      return;
    }

    toast.success("Priorite mise a jour");
  }

  async function onStatusChange(nextStatus: RelationStatus) {
    const previousStatus = currentStatus;
    setCurrentStatus(nextStatus);

    if (!(await updateCase({ status: nextStatus }))) {
      setCurrentStatus(previousStatus);
      return;
    }

    toast.success("Statut mis a jour");
  }

  if (!editable) {
    return (
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          Priorite : {formatRelationPriority(currentPriority)}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          Statut : {formatRelationStatus(currentStatus)}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <label className="text-xs font-medium text-slate-600">
        Priorite
        <select
          value={currentPriority}
          onChange={(event) => onPriorityChange(event.target.value as RelationPriority)}
          className="ml-2 rounded-full border bg-white px-3 py-1 text-xs font-medium text-slate-700"
        >
          {priorityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-slate-600">
        Statut
        <select
          value={currentStatus}
          onChange={(event) => onStatusChange(event.target.value as RelationStatus)}
          className="ml-2 rounded-full border bg-white px-3 py-1 text-xs font-medium text-slate-700"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {feedback ? <span className="text-xs font-medium text-slate-500">{feedback}</span> : null}
    </div>
  );
}
