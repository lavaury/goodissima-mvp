import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { activeCandidateAccessWhere } from "@/lib/candidate-access";
import { DEFAULT_FORM_TEMPLATE_KEY, getFormFields, getFormTemplateByKey } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import CandidateForm from "./candidate-form";
import { PublicLinkBox } from "@/components/PublicLinkBox";

const defaultFields = [
  {
    key: "fullName",
    label: "Nom complet",
    type: "TEXT",
    required: true,
    placeholder: "Votre nom",
    defaultValue: null,
  },
  {
    key: "email",
    label: "Email",
    type: "EMAIL",
    required: true,
    placeholder: "Votre email",
    defaultValue: null,
  },
  {
    key: "message",
    label: "Message",
    type: "TEXTAREA",
    required: true,
    placeholder: "Presentez-vous et indiquez votre demande",
    defaultValue: null,
  },
];

export default async function PublicLinkPage({ params }: { params: { slug: string } }) {
  const link = await prisma.gLink.findUnique({
    where: { slug: params.slug },
    include: { owner: true },
  });

  if (!link || link.status !== "ACTIVE") notFound();

  const candidateCookie = cookies().get(`goodissima_candidate_${link.id}`)?.value;

  if (candidateCookie) {
    const existingCase = await prisma.relationCase.findFirst({
      where: {
        ...activeCandidateAccessWhere(candidateCookie),
        gLinkId: link.id,
      },
      select: { candidateAccessToken: true },
    });

    if (existingCase) {
      redirect(`/secure/${encodeURIComponent(existingCase.candidateAccessToken)}`);
    }
  }

  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/l/${link.slug}`;
  const formTemplate = await getFormTemplateByKey(DEFAULT_FORM_TEMPLATE_KEY);
  const formFields = formTemplate ? await getFormFields(formTemplate.id) : [];
  const candidateFields = formFields.length
    ? formFields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type.toUpperCase(),
        required: field.required,
        placeholder: field.placeholder,
        defaultValue: field.defaultValue,
      }))
    : defaultFields;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Goodissima — Relation sécurisée
        </p>
      </div>

      <div className="mb-6">
        <PublicLinkBox url={publicUrl} />
      </div>

      <div className="rounded-3xl border bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Contacter le propriétaire
        </p>

        <h1 className="mt-3 text-3xl font-bold">{link.title}</h1>

        {link.city && <p className="mt-1 text-slate-500">{link.city}</p>}
        {link.description && <p className="mt-5 text-slate-700">{link.description}</p>}

        <div className="mt-8 rounded-2xl bg-slate-50 p-5">
          <h2 className="font-semibold">🔒 Ce propriétaire utilise un lien sécurisé</h2>
          <p className="mt-2 text-sm text-slate-600">
            Ce lien permet d’éviter les messages inutiles, les faux profils et les contacts hors contexte.
            Merci de vous présenter clairement : votre demande sera traitée plus rapidement.
          </p>
        </div>

        <CandidateForm gLinkId={link.id} formTemplateId={formTemplate?.id ?? null} fields={candidateFields} />
      </div>
    </main>
  );
}
