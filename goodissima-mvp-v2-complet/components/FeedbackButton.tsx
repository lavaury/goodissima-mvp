"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";

const feedbackTypes = ["Bug", "Suggestion", "UX", "Compréhension", "Autre"] as const;
const maxScreenshots = 5;
const maxScreenshotSizeBytes = 10 * 1024 * 1024;
const allowedScreenshotTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

type FeedbackType = (typeof feedbackTypes)[number];

function getPageContext() {
  if (typeof window === "undefined") {
    return {
      page: "",
      caseId: null as string | null,
      templateId: null as string | null,
      opportunityId: null as string | null,
    };
  }

  const url = new URL(window.location.href);
  const caseMatch = url.pathname.match(/\/cases\/([^/?#]+)/);
  const templateMatch = url.pathname.match(/\/templates\/([^/?#]+)/);
  const opportunityMatch = url.pathname.match(/\/(?:links|opportunities)\/([^/?#]+)/);

  return {
    page: `${url.pathname}${url.search}`,
    caseId: caseMatch?.[1] ?? url.searchParams.get("caseId"),
    templateId: templateMatch?.[1] ?? url.searchParams.get("templateId"),
    opportunityId: opportunityMatch?.[1] ?? url.searchParams.get("opportunityId") ?? url.searchParams.get("linkId"),
  };
}

async function getApiErrorMessage(res: Response, fallback: string) {
  try {
    const body = await res.json();
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export function FeedbackButton() {
  const pathname = usePathname();
  const toast = useToast();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("UX");
  const [message, setMessage] = useState("");
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [includePageContext, setIncludePageContext] = useState(true);
  const [sending, setSending] = useState(false);
  const context = useMemo(() => getPageContext(), [open]);
  const canSubmit = message.trim().length >= 4;

  if (pathname === "/") return null;

  function updateScreenshots(fileList: FileList | null) {
    const next = Array.from(fileList ?? []);

    if (next.length > maxScreenshots) {
      toast.error("Maximum 5 captures d'écran.");
      return;
    }

    const invalid = next.find((file) => !allowedScreenshotTypes.has(file.type));
    if (invalid) {
      toast.error("Formats acceptés : PNG, JPG ou WEBP.");
      return;
    }

    const tooLarge = next.find((file) => file.size > maxScreenshotSizeBytes);
    if (tooLarge) {
      toast.error("Chaque capture doit faire 10 Mo maximum.");
      return;
    }

    setScreenshots(next);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      toast.error(t("feedback.tooShort"));
      return;
    }

    setSending(true);

    const formData = new FormData();
    formData.set("type", type);
    formData.set("message", message.trim());
    formData.set("includePageContext", String(includePageContext));
    formData.set("browserLanguage", navigator.language);
    formData.set("timestamp", new Date().toISOString());

    if (includePageContext) {
      formData.set("page", context.page);
      if (context.caseId) formData.set("caseId", context.caseId);
      if (context.templateId) formData.set("templateId", context.templateId);
      if (context.opportunityId) formData.set("opportunityId", context.opportunityId);
      formData.set("viewport", JSON.stringify({ width: window.innerWidth, height: window.innerHeight }));
    }

    screenshots.forEach((file) => formData.append("screenshots", file));

    const res = await fetch("/api/feedback", {
      method: "POST",
      body: formData,
    });

    setSending(false);

    if (!res.ok) {
      toast.error(await getApiErrorMessage(res, t("common.error")));
      return;
    }

    setMessage("");
    setScreenshots([]);
    setIncludePageContext(true);
    setType("UX");
    setOpen(false);
    toast.success(t("feedback.success"));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:shadow-xl sm:bottom-6 sm:right-6"
      >
        <span aria-hidden="true">💬</span> {t("feedback.button")}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 px-3 py-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{t("feedback.title")}</h2>
                <p className="mt-1 text-sm text-slate-500">{t("feedback.subtitle")}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-3 py-1 text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label={t("common.close")}
              >
                ×
              </button>
            </div>

            <form onSubmit={submit} className="space-y-5 px-5 py-5">
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">{t("feedback.type")}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {feedbackTypes.map((item) => {
                    const selected = type === item;

                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setType(item)}
                        className={
                          selected
                            ? "rounded-xl border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                            : "rounded-xl border bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        }
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="feedback-message" className="text-sm font-medium text-slate-700">
                    {t("feedback.message")}
                  </label>
                  <span className="text-xs text-slate-400">{message.length}/800</span>
                </div>
                <textarea
                  id="feedback-message"
                  maxLength={800}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={t("feedback.placeholder")}
                  className="min-h-36 w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                />
                {!message.trim() ? (
                  <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    {t("feedback.empty")}
                  </p>
                ) : null}
              </div>

              <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={includePageContext}
                    onChange={(event) => setIncludePageContext(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />
                  <span>
                    <span className="block font-medium text-slate-700">Joindre la page actuelle</span>
                    <span className="mt-1 block break-all">
                      {includePageContext ? context.page || "Page courante" : "Aucun contexte de page joint"}
                    </span>
                  </span>
                </label>
                {includePageContext ? (
                  <div className="mt-2 flex flex-wrap gap-2 pl-7">
                    {context.caseId ? <span className="rounded-full bg-white px-2.5 py-1">Dossier {context.caseId}</span> : null}
                    {context.templateId ? <span className="rounded-full bg-white px-2.5 py-1">Parcours {context.templateId}</span> : null}
                    {context.opportunityId ? <span className="rounded-full bg-white px-2.5 py-1">Opportunité {context.opportunityId}</span> : null}
                    <span className="rounded-full bg-white px-2.5 py-1">{t("feedback.serverRole")}</span>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <label htmlFor="feedback-screenshots" className="text-sm font-medium text-slate-700">
                      Ajouter une capture d'écran
                    </label>
                    <p className="mt-1 text-xs text-slate-500">PNG, JPG ou WEBP. 5 captures maximum, 10 Mo chacune.</p>
                  </div>
                  <input
                    id="feedback-screenshots"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={(event) => updateScreenshots(event.target.files)}
                    className="max-w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white"
                  />
                </div>
                {screenshots.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {screenshots.map((file) => (
                      <span key={`${file.name}-${file.size}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                        {file.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={sending || !canSubmit}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? t("feedback.sending") : t("feedback.send")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
