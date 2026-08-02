import type { ResolvedMemoryPermissions } from "../persistence/permission-resolver.ts";
import type { GovernedMemoryReadSnapshot } from "./repository.ts";
import type { GovernedMemoryRedaction, GovernedMemorySourceView } from "./types.ts";

type Snapshot = NonNullable<GovernedMemoryReadSnapshot>;
type SourceRow = Snapshot["sources"][number];

export function filterMemoryReadByCurrentAccess(sources: SourceRow[], access: ResolvedMemoryPermissions) {
  const visible: GovernedMemorySourceView[] = [];
  const redactions: GovernedMemoryRedaction[] = [];
  const visibleIds = new Set<string>();
  const mayViewSources = access.permissions.has("VIEW_SOURCES");
  for (const source of sources) {
    const unavailable = source.status === "DELETED" || source.status === "ANONYMIZED";
    const restricted = source.status === "RESTRICTED" || Boolean(source.visibilityPolicyRef);
    const targeted = access.sourceResourceIds.has(source.id);
    const existenceDisclosed = source.visibilityPolicyRef?.startsWith("EXISTENCE_DISCLOSED:") === true;
    if (!mayViewSources || (restricted && !targeted)) {
      redactions.push({ level: existenceDisclosed ? "EXISTENCE_DISCLOSED" : "FULLY_HIDDEN", objectType: "SOURCE", disclosedId: existenceDisclosed ? source.id : null, reasonCode: "SOURCE_RESTRICTED" });
      continue;
    }
    visibleIds.add(source.id);
    visible.push({ id: source.id, kind: source.kind, statusAtReference: source.status, title: unavailable ? "Unavailable source" : source.title, authoredAt: source.authoredAt?.toISOString() ?? null, receivedAt: source.receivedAt?.toISOString() ?? null, recordedAt: source.recordedAt.toISOString(), knowledgeTiming: "KNOWN_THEN", available: !unavailable, restricted });
    if (unavailable) redactions.push({ level: "EXISTENCE_DISCLOSED", objectType: "SOURCE", disclosedId: source.id, reasonCode: "SOURCE_UNAVAILABLE" });
  }
  return { visible, visibleIds, redactions };
}

export function filterReferencesWithoutLeaks<T extends { type: string; id: string }>(references: T[], visibleSourceIds: ReadonlySet<string>): T[] {
  return references.filter((reference) => reference.type !== "SOURCE" || visibleSourceIds.has(reference.id));
}
