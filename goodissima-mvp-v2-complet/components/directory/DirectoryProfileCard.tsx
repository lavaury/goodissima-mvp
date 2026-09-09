import Link from "next/link";
import type { PublishedDirectoryProfileDto } from "@/lib/directory/contracts";
import type { DirectorySearchResultDto } from "@/lib/directory/directory-search-contracts";

const labels = { PROFESSION: "Métier", SKILL: "Compétence", LANGUAGE: "Langue", LOCATION: "Localisation", QUALIFICATION: "Qualification", CERTIFICATION: "Certification", ORGANIZATION_DOMAIN: "Domaine" } as const;
export function DirectoryProfileCard({ profile, detailed = false }: { profile: PublishedDirectoryProfileDto | DirectorySearchResultDto; detailed?: boolean }) {
  const reasons = "matchReasons" in profile ? profile.matchReasons : [];
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{profile.actorType === "PERSON" ? "Personne" : "Organisation"}</p>
    <h2 className="mt-1 text-xl font-bold text-slate-950">{profile.publicName}</h2>
    {profile.attributes.length ? <dl className="mt-4 grid gap-3 sm:grid-cols-2">{profile.attributes.map((attribute, index) => <div key={`${attribute.kind}-${attribute.displayValue}-${index}`} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{labels[attribute.kind]}</dt><dd className="mt-1 text-sm font-medium text-slate-900">{attribute.displayValue}</dd><dd className="mt-1 text-xs text-slate-600">{attribute.trustLevel === "VERIFIED" ? "✓ Vérifié" : "Déclaré"}</dd></div>)}</dl> : <p className="mt-4 text-sm text-slate-600">Aucune information publique supplémentaire.</p>}
    {reasons.length ? <details className="mt-4 text-sm text-slate-600"><summary className="cursor-pointer font-semibold text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">Pourquoi ce résultat ?</summary><ul className="mt-2 list-disc space-y-1 pl-5">{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></details> : null}
    {!detailed ? <Link href={`/annuaire/${encodeURIComponent(profile.publicId)}`} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">Voir le profil</Link> : null}
  </article>;
}
