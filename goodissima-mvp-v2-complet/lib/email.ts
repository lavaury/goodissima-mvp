import { Resend } from "resend";

type EmailLink = {
  label: string;
  href: string;
};

type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

type TransactionalEmailInput = {
  ownerEmail: string;
  caseId: string;
  caseTitle: string;
  candidateName: string;
};

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
const EMAIL_FROM = process.env.EMAIL_FROM ?? "Goodissima <onboarding@resend.dev>";
const LOGO_URL = "https://goodissima.app/logo-goodissima.png";
const TRUST_FOOTER_FR =
  "Cet email a été envoyé par Goodissima dans le cadre d’une relation sécurisée. Vous recevez cet email car vous participez à un échange sécurisé Goodissima.";
const TRUST_FOOTER_EN =
  "This email was sent by Goodissima as part of a secure relationship. You are receiving this email because you are participating in a secure Goodissima exchange.";

let resendClient: Resend | null = null;

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] Resend skipped: missing RESEND_API_KEY");
    return null;
  }

  resendClient ??= new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

function absoluteUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  return `${APP_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

function conversationUrl(caseId: string) {
  return absoluteUrl(`/cases/${encodeURIComponent(caseId)}?refresh=1#conversation`);
}

function relationUrl(caseId: string) {
  return absoluteUrl(`/cases/${encodeURIComponent(caseId)}?refresh=1#relation`);
}

function secureUrl(candidateAccessToken: string) {
  return absoluteUrl(`/secure/${encodeURIComponent(candidateAccessToken)}`);
}

function dashboardUrl() {
  return absoluteUrl("/dashboard");
}

function sameEmail(left: string | null | undefined, right: string | null | undefined) {
  return Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(value: string, maxLength = 260) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function buildPlainText({
  title,
  previewText,
  intro,
  details,
  links,
}: {
  title: string;
  previewText: string;
  intro: string;
  details: Array<{ label: string; value: string | null | undefined }>;
  links: EmailLink[];
}) {
  const detailLines = details
    .filter((item) => item.value)
    .map((item) => `${item.label}: ${item.value}`);
  const linkLines = links.map((link) => `${link.label}: ${link.href}`);

  return [
    title,
    previewText,
    intro,
    ...detailLines,
    ...linkLines,
    TRUST_FOOTER_FR,
    TRUST_FOOTER_EN,
    "goodissima.app",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildGoodissimaEmail({
  title,
  previewText,
  eyebrow,
  intro,
  details,
  primaryCta,
  links,
}: {
  title: string;
  previewText: string;
  eyebrow: string;
  intro: string;
  details: Array<{ label: string; value: string | null | undefined }>;
  primaryCta: EmailLink;
  links: EmailLink[];
}) {
  const detailRows = details
    .filter((item) => item.value)
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;color:#64748b;font-size:13px;line-height:18px;width:130px;vertical-align:top;">${escapeHtml(item.label)}</td>
          <td style="padding:10px 0;color:#0f172a;font-size:14px;line-height:20px;font-weight:600;vertical-align:top;">${escapeHtml(item.value ?? "")}</td>
        </tr>`,
    )
    .join("");

  const secondaryLinks = links
    .filter((link) => link.href !== primaryCta.href || link.label !== primaryCta.label)
    .map(
      (link) => `
        <a href="${escapeHtml(link.href)}" style="display:block;margin:10px 0 0;color:#0f766e;font-size:13px;font-weight:600;text-decoration:none;">${escapeHtml(link.label)}</a>`,
    )
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#334155;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;overflow:hidden;mso-hide:all;">${escapeHtml(previewText)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;margin:0;padding:0;">
      <tr>
        <td align="center" style="padding:28px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:26px 28px 18px;background:#ffffff;">
                <img src="${escapeHtml(LOGO_URL)}" width="180" alt="Goodissima" style="display:block;height:auto;border:0;margin:0 0 22px;" />
                <p style="margin:0 0 10px;color:#0f766e;font-size:12px;line-height:16px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">${escapeHtml(eyebrow)}</p>
                <h1 style="margin:0;color:#0f172a;font-size:26px;line-height:32px;font-weight:800;">${escapeHtml(title)}</h1>
                <p style="margin:14px 0 0;color:#475569;font-size:15px;line-height:24px;">${escapeHtml(intro)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 8px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">
                  ${detailRows}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 28px;">
                <a href="${escapeHtml(primaryCta.href)}" style="display:inline-block;border-radius:8px;background:#0f172a;color:#ffffff;font-size:14px;line-height:18px;font-weight:700;padding:13px 18px;text-decoration:none;">${escapeHtml(primaryCta.label)}</a>
                <div style="margin-top:16px;">${secondaryLinks}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px;background:#f1f5f9;">
                <p style="margin:0 0 10px;color:#475569;font-size:12px;line-height:18px;">${escapeHtml(TRUST_FOOTER_FR)}</p>
                <p style="margin:0 0 12px;color:#64748b;font-size:12px;line-height:18px;">${escapeHtml(TRUST_FOOTER_EN)}</p>
                <a href="https://goodissima.app" style="color:#0f766e;font-size:12px;font-weight:700;text-decoration:none;">goodissima.app</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendTransactionalEmail({
  to,
  subject,
  title,
  previewText,
  eyebrow,
  intro,
  details,
  primaryCta,
  links,
}: {
  to: string;
  subject: string;
  title: string;
  previewText: string;
  eyebrow: string;
  intro: string;
  details: Array<{ label: string; value: string | null | undefined }>;
  primaryCta: EmailLink;
  links: EmailLink[];
}) {
  return sendEmail({
    to,
    subject,
    html: buildGoodissimaEmail({ title, previewText, eyebrow, intro, details, primaryCta, links }),
    text: buildPlainText({ title, previewText, intro, details, links: [primaryCta, ...links] }),
  });
}

export async function sendEmail({ to, subject, html, text }: SendEmailInput) {
  const resend = getResendClient();
  const recipients = Array.isArray(to) ? to : [to];

  if (!resend) return { ok: false, skipped: true };

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: recipients,
      subject,
      html,
      text,
    });

    if (result.error) {
      console.error("[email] Resend rejected email", {
        subject,
        recipientCount: recipients.length,
        error: result.error.message,
      });
      return { ok: false, error: result.error };
    }

    console.info("[email] Email sent", { subject, recipientCount: recipients.length, id: result.data?.id });
    return { ok: true, id: result.data?.id };
  } catch (error) {
    console.error("[email] Resend send failed", {
      subject,
      recipientCount: recipients.length,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return { ok: false, error };
  }
}

export async function sendNewMessageEmail({
  ownerEmail,
  candidateEmail,
  caseId,
  caseTitle,
  candidateName,
  messageBody,
}: TransactionalEmailInput & {
  candidateEmail?: string;
  messageBody: string;
}) {
  if (sameEmail(ownerEmail, candidateEmail)) {
    console.info("[owner-email] Skipped candidate message email: sender and recipient match", {
      caseId,
    });
    return { ok: false, skipped: true };
  }

  const primaryCta = { label: "Accéder à la conversation sécurisée", href: conversationUrl(caseId) };

  console.info("[owner-email] Sending candidate message email", {
    caseId,
  });

  return sendTransactionalEmail({
    to: ownerEmail,
    subject: `Nouveau message concernant ${caseTitle}`,
    title: "Nouveau message candidat",
    previewText: `Nouveau message concernant ${caseTitle}`,
    eyebrow: "Conversation Goodissima",
    intro: `Nouveau message concernant : ${caseTitle}`,
    details: [
      { label: "Relation", value: caseTitle },
      { label: "Candidat", value: candidateName },
      { label: "Action", value: "Message recu" },
      { label: "Message", value: truncate(messageBody) },
    ],
    primaryCta,
    links: [
      { label: "Consulter votre dossier sécurisé", href: dashboardUrl() },
      primaryCta,
      { label: "Ouvrir la relation sécurisée", href: relationUrl(caseId) },
    ],
  });
}

export async function sendOwnerMessageToCandidateEmail({
  candidateEmail,
  ownerEmail,
  caseTitle,
  candidateName,
  candidateAccessToken,
  messageBody,
}: {
  candidateEmail: string;
  ownerEmail: string;
  caseTitle: string;
  candidateName: string;
  candidateAccessToken: string;
  messageBody: string;
}) {
  if (sameEmail(candidateEmail, ownerEmail)) {
    console.info("[candidate-email] Skipped owner message email: sender and recipient match", {
    });
    return { ok: false, skipped: true };
  }

  const candidateUrl = secureUrl(candidateAccessToken);
  const primaryCta = { label: "Accéder à la conversation sécurisée", href: candidateUrl };

  console.info("[candidate-email] Sending owner message email", {
    caseTitle,
  });

  return sendTransactionalEmail({
    to: candidateEmail,
    subject: `Nouveau message concernant ${caseTitle}`,
    title: "Nouveau message du proprietaire",
    previewText: `Nouveau message concernant ${caseTitle}`,
    eyebrow: "Conversation Goodissima",
    intro: `Nouveau message concernant : ${caseTitle}`,
    details: [
      { label: "Relation", value: caseTitle },
      { label: "Candidat", value: candidateName },
      { label: "Action", value: "Message du proprietaire" },
      { label: "Message", value: truncate(messageBody) },
    ],
    primaryCta,
    links: [
      { label: "Accéder à la conversation sécurisée", href: candidateUrl },
      { label: "Ouvrir la relation sécurisée", href: candidateUrl },
    ],
  });
}

export async function sendNewDocumentEmail({
  ownerEmail,
  candidateEmail,
  caseId,
  caseTitle,
  candidateName,
  fileName,
}: TransactionalEmailInput & {
  candidateEmail?: string;
  fileName: string;
}) {
  if (sameEmail(ownerEmail, candidateEmail)) {
    console.info("[owner-email] Skipped candidate document email: sender and recipient match", {
      caseId,
    });
    return { ok: false, skipped: true };
  }

  const primaryCta = { label: "Ouvrir la relation sécurisée", href: relationUrl(caseId) };

  console.info("[owner-email] Sending candidate document email", {
    caseId,
  });

  return sendTransactionalEmail({
    to: ownerEmail,
    subject: `Nouveau document concernant ${caseTitle}`,
    title: "Nouveau document recu",
    previewText: `Nouveau document reçu concernant ${caseTitle}`,
    eyebrow: "Document Goodissima",
    intro: `Un document a ete ajoute concernant : ${caseTitle}`,
    details: [
      { label: "Relation", value: caseTitle },
      { label: "Candidat", value: candidateName },
      { label: "Action", value: "Document recu" },
      { label: "Document", value: fileName },
    ],
    primaryCta,
    links: [
      { label: "Consulter votre dossier sécurisé", href: dashboardUrl() },
      { label: "Accéder à la conversation sécurisée", href: conversationUrl(caseId) },
      primaryCta,
    ],
  });
}

export async function sendNewRelationCaseEmail({
  ownerEmail,
  candidateEmail,
  caseId,
  caseTitle,
  candidateName,
  messageBody,
}: TransactionalEmailInput & {
  candidateEmail?: string;
  messageBody?: string;
}) {
  if (sameEmail(ownerEmail, candidateEmail)) {
    console.info("[owner-email] Skipped new relation case email: sender and recipient match", {
      caseId,
    });
    return { ok: false, skipped: true };
  }

  const primaryCta = { label: "Ouvrir le nouveau dossier", href: relationUrl(caseId) };

  console.info("[owner-email] Sending new relation case email", {
    caseId,
  });

  return sendTransactionalEmail({
    to: ownerEmail,
    subject: `Nouveau dossier candidat - ${caseTitle}`,
    title: "Nouveau dossier candidat",
    previewText: `Nouveau dossier candidat concernant ${caseTitle}`,
    eyebrow: "Dossier Goodissima",
    intro: `Un nouveau dossier candidat a ete cree concernant : ${caseTitle}`,
    details: [
      { label: "Relation", value: caseTitle },
      { label: "Candidat", value: candidateName },
      { label: "Action", value: "Nouveau dossier" },
      { label: "Message", value: messageBody ? truncate(messageBody) : null },
    ],
    primaryCta,
    links: [
      { label: "Consulter votre dossier securise", href: dashboardUrl() },
      { label: "Acceder a la conversation securisee", href: conversationUrl(caseId) },
      primaryCta,
    ],
  });
}

export async function sendRelationActionCompletedEmail({
  ownerEmail,
  candidateEmail,
  caseId,
  caseTitle,
  candidateName,
  actionTitle,
  actionType,
}: TransactionalEmailInput & {
  candidateEmail?: string;
  actionTitle: string;
  actionType: string;
}) {
  if (sameEmail(ownerEmail, candidateEmail)) {
    console.info("[owner-email] Skipped completed action email: sender and recipient match", {
      caseId,
    });
    return { ok: false, skipped: true };
  }

  const primaryCta = { label: "Verifier le dossier", href: relationUrl(caseId) };

  console.info("[owner-email] Sending completed action email", {
    caseId,
    actionType,
  });

  return sendTransactionalEmail({
    to: ownerEmail,
    subject: `Action completee - ${caseTitle}`,
    title: "Action completee par le candidat",
    previewText: `Action completee concernant ${caseTitle}`,
    eyebrow: "Validation Goodissima",
    intro: `Une action a ete completee concernant : ${caseTitle}`,
    details: [
      { label: "Relation", value: caseTitle },
      { label: "Candidat", value: candidateName },
      { label: "Action", value: actionTitle },
      { label: "Type", value: actionType },
    ],
    primaryCta,
    links: [
      { label: "Consulter votre dossier securise", href: dashboardUrl() },
      { label: "Acceder a la conversation securisee", href: conversationUrl(caseId) },
      primaryCta,
    ],
  });
}

export async function sendNewRelationActionEmail({
  candidateEmail,
  ownerEmail,
  caseId,
  caseTitle,
  candidateName,
  candidateAccessToken,
  actionTitle,
  actionType,
}: Omit<TransactionalEmailInput, "ownerEmail"> & {
  candidateEmail: string;
  ownerEmail?: string;
  candidateAccessToken?: string;
  actionTitle: string;
  actionType: string;
}) {
  if (sameEmail(candidateEmail, ownerEmail)) {
    console.info("[action-email] Skipped action email: sender and recipient match", {
      caseId,
    });
    return { ok: false, skipped: true };
  }

  const candidateUrl = candidateAccessToken ? secureUrl(candidateAccessToken) : relationUrl(caseId);
  const primaryCta = { label: "Consulter votre dossier sécurisé", href: candidateUrl };

  console.info("[action-email] Sending relation action email", {
    caseId,
    actionType,
  });

  return sendTransactionalEmail({
    to: candidateEmail,
    subject: `Nouvelle action concernant ${caseTitle}`,
    title: "Nouvelle action relationnelle",
    previewText: `Nouvelle demande relationnelle concernant ${caseTitle}`,
    eyebrow: "Action Goodissima",
    intro: `Une nouvelle action vous attend concernant : ${caseTitle}`,
    details: [
      { label: "Relation", value: caseTitle },
      { label: "Candidat", value: candidateName },
      { label: "Action", value: actionTitle },
      { label: "Type", value: actionType },
    ],
    primaryCta,
    links: [
      { label: "Consulter votre dossier sécurisé", href: dashboardUrl() },
      { label: "Accéder à la conversation sécurisée", href: candidateUrl },
      primaryCta,
    ],
  });
}

export async function sendRelationStatusEmail({
  candidateEmail,
  ownerEmail,
  caseId,
  caseTitle,
  candidateName,
  candidateAccessToken,
  statusLabel,
}: {
  candidateEmail: string;
  ownerEmail: string;
  caseId: string;
  caseTitle: string;
  candidateName: string;
  candidateAccessToken: string;
  statusLabel: string;
}) {
  if (sameEmail(candidateEmail, ownerEmail)) {
    console.info("[candidate-email] Skipped status email: sender and recipient match", {
      caseId,
    });
    return { ok: false, skipped: true };
  }

  const candidateUrl = secureUrl(candidateAccessToken);
  const primaryCta = { label: "Ouvrir la relation sécurisée", href: candidateUrl };

  console.info("[candidate-email] Sending relation status email", {
    caseId,
    status: statusLabel,
  });

  return sendTransactionalEmail({
    to: candidateEmail,
    subject: `Mise a jour concernant ${caseTitle}`,
    title: "Statut de votre relation mis a jour",
    previewText: `Mise à jour concernant ${caseTitle}`,
    eyebrow: "Relation Goodissima",
    intro: `Le proprietaire a mis a jour votre dossier concernant : ${caseTitle}`,
    details: [
      { label: "Relation", value: caseTitle },
      { label: "Candidat", value: candidateName },
      { label: "Action", value: statusLabel },
    ],
    primaryCta,
    links: [
      { label: "Accéder à la conversation sécurisée", href: candidateUrl },
      { label: "Ouvrir la relation sécurisée", href: candidateUrl },
    ],
  });
}

export async function sendSecureLinkCreatedEmail({
  ownerEmail,
  linkTitle,
  publicUrl,
}: {
  ownerEmail: string;
  linkTitle: string;
  publicUrl: string;
}) {
  const primaryCta = { label: "Ouvrir la relation sécurisée", href: publicUrl };

  return sendTransactionalEmail({
    to: ownerEmail,
    subject: `Lien securise cree - ${linkTitle}`,
    title: "Lien securise cree",
    previewText: `Lien sécurisé créé concernant ${linkTitle}`,
    eyebrow: "Lien Goodissima",
    intro: `Votre lien securise est pret pour : ${linkTitle}`,
    details: [
      { label: "Relation", value: linkTitle },
      { label: "Candidat", value: "En attente de contact" },
      { label: "Action", value: "Lien securise cree" },
      { label: "Lien", value: publicUrl },
    ],
    primaryCta,
    links: [
      { label: "Consulter votre dossier sécurisé", href: dashboardUrl() },
      { label: "Accéder à la conversation sécurisée", href: publicUrl },
      primaryCta,
    ],
  });
}

export async function sendTestEmail(to: string) {
  const primaryCta = { label: "Consulter votre dossier sécurisé", href: dashboardUrl() };

  return sendTransactionalEmail({
    to,
    subject: "Email test Goodissima",
    title: "Email test Goodissima",
    previewText: "Email test Goodissima",
    eyebrow: "Test Resend",
    intro: "Resend est connecte au service email centralise de Goodissima.",
    details: [
      { label: "Relation", value: "Appartement T3 Agen Centre" },
      { label: "Candidat", value: "Candidat test" },
      { label: "Action", value: "Verification email transactionnel" },
    ],
    primaryCta,
    links: [
      primaryCta,
      { label: "Accéder à la conversation sécurisée", href: absoluteUrl("/dashboard") },
      { label: "Ouvrir la relation sécurisée", href: absoluteUrl("/dashboard") },
    ],
  });
}
