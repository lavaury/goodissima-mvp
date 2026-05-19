import { Resend } from "resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://goodissima-mvp.vercel.app";
const FROM_EMAIL = "Goodissima <onboarding@resend.dev>";
const LOGO_URL = "https://goodissima-mvp.vercel.app/logo-goodissima.png";

function getResendClient() {
  const hasApiKey = Boolean(process.env.RESEND_API_KEY);
  console.log("RESEND_API_KEY present:", hasApiKey);

  if (!hasApiKey) return null;

  return new Resend(process.env.RESEND_API_KEY);
}

function getCaseUrl(caseId: string) {
  return `${APP_URL}/cases/${encodeURIComponent(caseId)}?refresh=1`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailHtml({
  title,
  intro,
  detail,
  ctaHref,
}: {
  title: string;
  intro: string;
  detail: string;
  ctaHref: string;
}) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#334155;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <img src="${LOGO_URL}" alt="Goodissima" width="220" style="display:block;height:auto;margin:0 0 24px;" />
      <h1 style="margin:0 0 16px;color:#0f172a;font-size:24px;line-height:32px;font-weight:700;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:24px;">${escapeHtml(intro)}</p>
      <div style="margin:0 0 24px;border-left:3px solid #cbd5e1;padding-left:12px;color:#475569;font-size:15px;line-height:24px;">${escapeHtml(detail)}</div>
      <a href="${ctaHref}" style="display:inline-block;border-radius:12px;background:#0f172a;color:#ffffff;font-size:14px;font-weight:600;padding:12px 18px;text-decoration:none;">Ouvrir le dossier</a>
      <hr style="margin:32px 0 16px;border:none;border-top:1px solid #e2e8f0;" />
      <p style="margin:0;color:#64748b;font-size:12px;line-height:18px;">Goodissima vous aide a centraliser les echanges et documents importants dans un espace securise.</p>
    </div>
  </body>
</html>`;
}

export async function sendNewMessageEmail({
  ownerEmail,
  caseId,
  caseTitle,
  candidateName,
  messageBody,
}: {
  ownerEmail: string;
  caseId: string;
  caseTitle: string;
  candidateName: string;
  messageBody: string;
}) {
  const resend = getResendClient();
  console.log("Sending new message email to:", ownerEmail);

  if (!resend) {
    console.error("Resend skipped: missing RESEND_API_KEY");
    return;
  }

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: ownerEmail,
      subject: `Nouveau message - ${caseTitle}`,
      html: buildEmailHtml({
        title: "Nouveau message dans votre dossier Goodissima",
        intro: `${candidateName} a envoye un nouveau message dans le dossier ${caseTitle}.`,
        detail: messageBody.slice(0, 240),
        ctaHref: getCaseUrl(caseId),
      }),
    });
    console.log("Resend new message result:", result);
  } catch (error) {
    console.error("Resend new message error:", error);
    throw error;
  }
}

export async function sendNewDocumentEmail({
  ownerEmail,
  caseId,
  caseTitle,
  candidateName,
  fileName,
}: {
  ownerEmail: string;
  caseId: string;
  caseTitle: string;
  candidateName: string;
  fileName: string;
}) {
  const resend = getResendClient();
  console.log("Sending new document email to:", ownerEmail);

  if (!resend) {
    console.error("Resend skipped: missing RESEND_API_KEY");
    return;
  }

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: ownerEmail,
      subject: `Nouveau document - ${caseTitle}`,
      html: buildEmailHtml({
        title: "Nouveau document dans votre dossier Goodissima",
        intro: `${candidateName} a ajoute un document dans le dossier ${caseTitle}.`,
        detail: fileName,
        ctaHref: getCaseUrl(caseId),
      }),
    });
    console.log("Resend new document result:", result);
  } catch (error) {
    console.error("Resend new document error:", error);
    throw error;
  }
}
