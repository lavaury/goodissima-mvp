function formatUtcCivilDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function PublicSimpleLinkCard({
  title,
  description,
  welcomeMessage,
  expiresAt,
}: {
  title: string;
  description: string | null;
  welcomeMessage: string;
  expiresAt: Date | null;
}) {
  return (
    <article className="rounded-3xl border border-[#d6e7e8] bg-white p-7 shadow-[0_20px_60px_rgba(38,56,70,0.12)] sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#247f88]">Lien de contact sécurisé</p>
      <h1 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">{title}</h1>
      {description ? <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-700">{description}</p> : null}
      {welcomeMessage && welcomeMessage !== description ? (
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-700">{welcomeMessage}</p>
      ) : null}
      <p className="mt-6 rounded-2xl bg-teal-50 px-5 py-4 text-sm font-medium text-teal-950">
        {expiresAt
          ? `Ce lien est actif jusqu’au ${formatUtcCivilDate(expiresAt)}.`
          : "Ce lien reste actif jusqu’à sa désactivation par son propriétaire."}
      </p>
    </article>
  );
}
