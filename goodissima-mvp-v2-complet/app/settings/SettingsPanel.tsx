"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";

type ToggleRowProps = {
  title: string;
  help: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function ToggleRow({ title, help, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border bg-white p-4">
      <div>
        <p className="font-medium text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{help}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          "relative h-7 w-12 shrink-0 rounded-full transition",
          checked ? "bg-slate-900" : "bg-slate-200",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition",
            checked ? "left-6" : "left-1",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

function SectionCard({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{eyebrow}</p>
      <h2 className="mt-1 text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

export function SettingsPanel({ ownerEmail, organizationName }: { ownerEmail: string; organizationName: string }) {
  const toast = useToast();
  const { t } = useI18n();
  const [org, setOrg] = useState({
    name: organizationName,
    logo: "",
    primaryColor: "#0f172a",
    accentColor: "#10b981",
    branding: true,
  });
  const [security, setSecurity] = useState({
    linkExpiration: "14",
    emailProtection: true,
    consentRequired: true,
    documentRetention: "90",
  });
  const [notifications, setNotifications] = useState({
    messages: true,
    documents: true,
    requests: true,
  });
  const colors = ["#0f172a", "#2563eb", "#059669", "#7c3aed", "#dc2626", "#d97706"];

  function save() {
    toast.success(t("settings.saved"));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-300">{t("settings.governance")}</p>
            <h2 className="mt-1 text-2xl font-semibold">{org.name || "Organisation Goodissima"}</h2>
            <p className="mt-2 text-sm text-slate-300">
              {t("settings.subtitle")} {ownerEmail}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3">
            <span className="h-4 w-4 rounded-full" style={{ backgroundColor: org.primaryColor }} />
            <span className="h-4 w-4 rounded-full" style={{ backgroundColor: org.accentColor }} />
            <span className="text-sm font-medium">Branding actif</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title={t("settings.org.title")} eyebrow={t("settings.org.eyebrow")}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t("settings.org.name")}</span>
            <input
              value={org.name}
              onChange={(event) => setOrg({ ...org, name: event.target.value })}
              className="mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              placeholder="Nom de l'organisation"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t("settings.org.logo")}</span>
            <input
              value={org.logo}
              onChange={(event) => setOrg({ ...org, logo: event.target.value })}
              className="mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              placeholder="URL ou nom du logo"
            />
            {!org.logo ? (
              <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                {t("settings.org.logoEmpty")}
              </p>
            ) : null}
          </label>
          <div>
            <p className="text-sm font-medium text-slate-700">{t("settings.org.colors")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setOrg({ ...org, primaryColor: color })}
                  className={
                    org.primaryColor === color
                      ? "h-9 w-9 rounded-full ring-2 ring-slate-900 ring-offset-2"
                      : "h-9 w-9 rounded-full ring-1 ring-slate-200"
                  }
                  style={{ backgroundColor: color }}
                  aria-label={`Couleur ${color}`}
                />
              ))}
            </div>
          </div>
          <ToggleRow
            title={t("settings.org.branding")}
            help={t("settings.org.brandingHelp")}
            checked={org.branding}
            onChange={(branding) => setOrg({ ...org, branding })}
          />
        </SectionCard>

        <SectionCard title={t("settings.security.title")} eyebrow={t("settings.security.eyebrow")}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t("settings.security.linkExpiration")}</span>
            <select
              value={security.linkExpiration}
              onChange={(event) => setSecurity({ ...security, linkExpiration: event.target.value })}
              className="mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            >
              <option value="7">7 jours</option>
              <option value="14">14 jours</option>
              <option value="30">30 jours</option>
              <option value="never">Pas d'expiration automatique</option>
            </select>
            <p className="mt-2 text-xs text-slate-500">{t("settings.security.recommended")}</p>
          </label>
          <ToggleRow
            title={t("settings.security.emailProtection")}
            help={t("settings.security.emailProtectionHelp")}
            checked={security.emailProtection}
            onChange={(emailProtection) => setSecurity({ ...security, emailProtection })}
          />
          <ToggleRow
            title={t("settings.security.consent")}
            help={t("settings.security.consentHelp")}
            checked={security.consentRequired}
            onChange={(consentRequired) => setSecurity({ ...security, consentRequired })}
          />
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t("settings.security.retention")}</span>
            <select
              value={security.documentRetention}
              onChange={(event) => setSecurity({ ...security, documentRetention: event.target.value })}
              className="mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            >
              <option value="30">30 jours</option>
              <option value="90">90 jours</option>
              <option value="180">180 jours</option>
              <option value="manual">Archivage manuel</option>
            </select>
          </label>
        </SectionCard>

        <SectionCard title={t("settings.notifications.title")} eyebrow={t("settings.notifications.eyebrow")}>
          <ToggleRow
            title={t("settings.notifications.messages")}
            help={t("settings.notifications.messagesHelp")}
            checked={notifications.messages}
            onChange={(messages) => setNotifications({ ...notifications, messages })}
          />
          <ToggleRow
            title={t("settings.notifications.documents")}
            help={t("settings.notifications.documentsHelp")}
            checked={notifications.documents}
            onChange={(documents) => setNotifications({ ...notifications, documents })}
          />
          <ToggleRow
            title={t("settings.notifications.requests")}
            help={t("settings.notifications.requestsHelp")}
            checked={notifications.requests}
            onChange={(requests) => setNotifications({ ...notifications, requests })}
          />
          {!notifications.messages && !notifications.documents && !notifications.requests ? (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
              {t("settings.notifications.allOff")}
            </p>
          ) : null}
        </SectionCard>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">{t("settings.demoReady")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("settings.demoReadyHelp")}</p>
        </div>
        <button
          type="button"
          onClick={save}
          className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          {t("settings.save")}
        </button>
      </div>
    </div>
  );
}
