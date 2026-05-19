import { Resend } from "resend";
import { NewDocumentEmail } from "@/emails/NewDocumentEmail";
import { NewMessageEmail } from "@/emails/NewMessageEmail";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://goodissima-mvp.vercel.app";
const FROM_EMAIL = "Goodissima <onboarding@resend.dev>";

function getResendClient() {
  if (!process.env.RESEND_API_KEY) return null;

  return new Resend(process.env.RESEND_API_KEY);
}

function getCaseUrl(caseId: string) {
  return `${APP_URL}/cases/${encodeURIComponent(caseId)}?refresh=1`;
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
  if (!resend) return;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ownerEmail,
    subject: `Nouveau message - ${caseTitle}`,
    react: NewMessageEmail({
      caseTitle,
      candidateName,
      messagePreview: messageBody.slice(0, 240),
      ctaHref: getCaseUrl(caseId),
    }),
  });
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
  if (!resend) return;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ownerEmail,
    subject: `Nouveau document - ${caseTitle}`,
    react: NewDocumentEmail({
      caseTitle,
      candidateName,
      fileName,
      ctaHref: getCaseUrl(caseId),
    }),
  });
}
