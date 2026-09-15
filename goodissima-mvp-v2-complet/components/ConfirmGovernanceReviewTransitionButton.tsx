"use client";

export function ConfirmGovernanceReviewTransitionButton({ nextStatus }: { nextStatus: "IN_HUMAN_REVIEW" | "COMPLETED" }) {
  const completing = nextStatus === "COMPLETED";
  return (
    <button
      type="submit"
      data-boussole-id={completing ? "complete-governance-review" : "conduct-governance-review"}
      onClick={(event) => {
        const message = completing
          ? "Confirmer que cette décision a été examinée ?"
          : "Commencer l’examen de cette décision ?";
        if (!window.confirm(message)) event.preventDefault();
      }}
      className="rounded-lg bg-[#247f88] px-3 py-2 text-xs font-bold text-white"
    >
      {completing ? "Marquer comme examinée" : "Examiner la décision"}
    </button>
  );
}
