"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

type RelationTemplateOption = {
  id: string;
  key: string;
  name: string;
};

export function NewLinkForm({
  templates,
  defaultTemplateId,
}: {
  templates: RelationTemplateOption[];
  defaultTemplateId: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    title: "",
    city: "",
    description: "",
    templateId: defaultTemplateId ?? "",
    requireEmail: true,
    requireMessage: true,
    allowDocument: true,
  });

  async function submit() {
    if (!form.title.trim()) {
      toast.error("Erreur lors de l'action");
      return;
    }

    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      toast.error("Erreur lors de l'action");
      return;
    }

    const link = await res.json();
    router.push(`/l/${link.slug}`);
  }

  return (
    <div className="mt-8 space-y-4 rounded-2xl border bg-white p-6">
      <input
        className="w-full rounded-xl border px-4 py-3"
        placeholder="Titre de l'annonce"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
      <input
        className="w-full rounded-xl border px-4 py-3"
        placeholder="Ville"
        value={form.city}
        onChange={(e) => setForm({ ...form, city: e.target.value })}
      />
      <textarea
        className="min-h-32 w-full rounded-xl border px-4 py-3"
        placeholder="Description courte"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <select
        className="w-full rounded-xl border px-4 py-3"
        value={form.templateId}
        onChange={(e) => setForm({ ...form, templateId: e.target.value })}
      >
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name} ({template.key})
          </option>
        ))}
      </select>
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={form.requireEmail}
          onChange={(e) => setForm({ ...form, requireEmail: e.target.checked })}
        />
        Email obligatoire
      </label>
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={form.requireMessage}
          onChange={(e) => setForm({ ...form, requireMessage: e.target.checked })}
        />
        Message obligatoire
      </label>
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={form.allowDocument}
          onChange={(e) => setForm({ ...form, allowDocument: e.target.checked })}
        />
        Document optionnel
      </label>
      <button onClick={submit} className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-white">
        Generer le lien
      </button>
    </div>
  );
}
