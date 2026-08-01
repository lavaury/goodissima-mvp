import { RepresentationCard } from "@/components/directory/RepresentationCard";
import type { DirectoryRepresentation } from "@/components/directory/directory-ui";
import type { RepresentationRelationshipPolicy } from "@/lib/directory/contracts";

export function RepresentationList({ representations, mutationId, onEdit, onTransition, onPolicySave }: {
  representations: DirectoryRepresentation[];
  mutationId: string | null;
  onEdit: (representation: DirectoryRepresentation) => void;
  onTransition: (representation: DirectoryRepresentation, action: "hide" | "restore" | "archive") => void;
  onPolicySave: (representation: DirectoryRepresentation, policy: RepresentationRelationshipPolicy) => Promise<boolean>;
}) {
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      {representations.map((representation) => (
        <RepresentationCard
          key={representation.id}
          representation={representation}
          busy={mutationId === representation.id}
          actionsDisabled={mutationId !== null}
          onEdit={() => onEdit(representation)}
          onTransition={(action) => onTransition(representation, action)}
          onPolicySave={(policy) => onPolicySave(representation, policy)}
        />
      ))}
    </div>
  );
}
