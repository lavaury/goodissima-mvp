export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { TemplateFieldManager } from "@/components/TemplateFieldManager";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formatJson(value: unknown) {
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

export default async function TemplateDetailPage({ params }: { params: { templateId: string } }) {
  noStore();
  await getCurrentPrismaUser();

  const template = await prisma.formTemplate.findUnique({
    where: { id: params.templateId },
    include: {
      relationTemplate: true,
      fields: { orderBy: [{ step: "asc" }, { position: "asc" }, { createdAt: "asc" }] },
    },
  });

  if (!template) notFound();

  const editableFields = template.fields.map((field) => ({
    id: field.id,
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    step: field.step,
    placeholder: field.placeholder ?? "",
    optionsJson: formatJson(field.options),
    conditionalRulesJson: formatJson(field.conditionalRules),
    validationRulesJson: formatJson(field.validationRules),
  }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/templates" className="text-sm font-medium text-slate-500 hover:text-slate-900">
        Retour aux templates
      </Link>

      <section className="mt-6 rounded-2xl border bg-white p-6">
        <p className="font-mono text-xs uppercase text-slate-500">{template.key}</p>
        <h1 className="mt-2 text-3xl font-bold">{template.name}</h1>
        <p className="mt-3 text-slate-600">{template.description ?? "Sans description"}</p>
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <p>
            <span className="text-slate-500">Relation template:</span>{" "}
            {template.relationTemplate?.key ?? "Aucun"}
          </p>
          <p>
            <span className="text-slate-500">Fields:</span> {template.fields.length}
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border bg-white p-6">
        <h2 className="font-semibold">Fields</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">Position</th>
                <th className="py-2">Step</th>
                <th className="py-2">Key</th>
                <th className="py-2">Label</th>
                <th className="py-2">Type</th>
                <th className="py-2">Required</th>
                <th className="py-2">Conditional</th>
                <th className="py-2">Validation</th>
              </tr>
            </thead>
            <tbody>
              {template.fields.map((field) => (
                <tr key={field.id} className="border-t align-top">
                  <td className="py-3">{field.position}</td>
                  <td className="py-3">{field.step}</td>
                  <td className="py-3 font-mono text-xs">{field.key}</td>
                  <td className="py-3">{field.label}</td>
                  <td className="py-3">{field.type}</td>
                  <td className="py-3">{field.required ? "Oui" : "Non"}</td>
                  <td className="max-w-xs py-3">
                    <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs">
                      {formatJson(field.conditionalRules) || "-"}
                    </pre>
                  </td>
                  <td className="max-w-xs py-3">
                    <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs">
                      {formatJson(field.validationRules) || "-"}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <TemplateFieldManager templateId={template.id} fields={editableFields} />
      </section>
    </main>
  );
}
