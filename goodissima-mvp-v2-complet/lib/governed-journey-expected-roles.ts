type ExpectedRole = { id: string; name: string; label: string; isFallback: boolean };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function expectedRolesFromSnapshot(snapshotValue: unknown): ExpectedRole[] {
  const snapshot = record(snapshotValue);
  const metadata = record(snapshot.metadata);
  const plan = record(metadata.creationPlan);
  const source = Array.isArray(plan.participants) ? plan.participants : Array.isArray(plan.actors) ? plan.actors : [];
  return source.flatMap((value, index) => {
    const row = record(value);
    const name = typeof row.name === "string" && row.name.trim() ? row.name.trim() : "";
    if (!name) return [];
    const label = typeof row.role === "string" && row.role.trim() ? row.role.trim() : "Participant attendu";
    const id = typeof row.roleId === "string" && row.roleId.trim() ? row.roleId.trim() : `expected-role-${index + 1}`;
    return [{ id, name, label, isFallback: label === "Participant attendu" }];
  });
}
