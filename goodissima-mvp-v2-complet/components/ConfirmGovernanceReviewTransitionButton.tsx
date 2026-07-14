"use client";

export function ConfirmGovernanceReviewTransitionButton({ nextStatus }: { nextStatus: "IN_HUMAN_REVIEW" | "COMPLETED" }) {
  const completing = nextStatus === "COMPLETED";
  return (
    <button
      type="submit"
      onClick={(event) => {
        const message = completing
          ? "Confirmer que cette revue a été conduite humainement ? Aucune notification, réunion ou action automatique ne sera déclenchée."
          : "Démarrer la conduite humaine de cette revue ? Aucune notification, réunion ou action automatique ne sera déclenchée.";
        if (!window.confirm(message)) event.preventDefault();
      }}
      className="rounded-lg bg-[#247f88] px-3 py-2 text-xs font-bold text-white"
    >
      {completing ? "Marquer comme conduite" : "Conduire la revue"}
    </button>
  );
}