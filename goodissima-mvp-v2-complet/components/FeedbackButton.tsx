"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ToastProvider";

const feedbackTypes = ["Bug", "Suggestion", "UX", "Compréhension", "Autre"] as const;

type FeedbackType = (typeof feedbackTypes)[number];

function getPageContext() {
  if (typeof window === "undefined") {
    return { page: "", caseId: null as string | null, templateId: null as string | null };
  }

  const url = new URL(window.location.href);
  const caseMatch = url.pathname.match(/\/cases\/([^/?#]+)/);
  const templateMatch = url.pathname.match(/\/templates\/([^/?#]+)/);

  return {
    page: `${url.pathname}${url.search}`,
    caseId: caseMatch?.[1] ?? url.searchParams.get("caseId"),
    templateId: templateMatch?.[1] ?? url.searchParams.get("templateId"),
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
  const toast = useToast();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("UX");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const context = useMemo(() => getPageContext(), [open]);
  const canSubmit = message.trim().length >= 4;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      toast.error(t("feedback.tooShort"));
      return;
    }

    setSending(true);

    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        message: message.trim(),
        page: context.page,
        caseId: context.caseId,
        templateId: context.templateId,
        timestamp: new Date().toISOString(),
      }),
    });

    setSending(false);

    if (!res.ok) {
      toast.error(await getApiErrorMessage(res, t("common.error")));
      return;
    }

    setMessage("");
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
                <p className="font-medium text-slate-700">{t("feedback.context")}</p>
                <p className="mt-1 break-all">{context.page || "Page courante"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {context.caseId ? <span className="rounded-full bg-white px-2.5 py-1">Dossier {context.caseId}</span> : null}
                  {context.templateId ? <span className="rounded-full bg-white px-2.5 py-1">Parcours {context.templateId}</span> : null}
                  <span className="rounded-full bg-white px-2.5 py-1">{t("feedback.serverRole")}</span>
                </div>
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
