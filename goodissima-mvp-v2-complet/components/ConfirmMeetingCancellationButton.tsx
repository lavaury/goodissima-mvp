"use client";
export function ConfirmMeetingCancellationButton() {
  return <button type="submit" onClick={(event) => { if (!window.confirm("Cette réunion sera annulée et conservée dans l’historique. Aucun participant ne sera notifié automatiquement.")) event.preventDefault(); }} className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-bold text-rose-700">Annuler cette réunion</button>;
}
