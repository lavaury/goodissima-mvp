"use client";
import { useFormStatus } from "react-dom";
export function GovernedMeetingSubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Préparation…" : "Préparer cette réunion"}</button>;
}
