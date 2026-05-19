import { Resend } from "resend";
import { NewDocumentEmail } from "@/emails/NewDocumentEmail";
import { NewMessageEmail } from "@/emails/NewMessageEmail";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://goodissima-mvp.vercel.app";
const FROM_EMAIL = "Goodissima <onboarding@resend.dev>";

function getResendClient() {
  const hasApiKey = Boolean(process.env.RESEND_API_KEY);
  console.log("RESEND_API_KEY present:", hasApiKey);

  if (!hasApiKey) return null;

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
      react: (
        <NewMessageEmail
          caseTitle={caseTitle}
          candidateName={candidateName}
          messagePreview={messageBody.slice(0, 240)}
          ctaHref={getCaseUrl(caseId)}
        />
      ),
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
      react: (
        <NewDocumentEmail
          caseTitle={caseTitle}
          candidateName={candidateName}
          fileName={fileName}
          ctaHref={getCaseUrl(caseId)}
        />
      ),
    });
    console.log("Resend new document result:", result);
  } catch (error) {
    console.error("Resend new document error:", error);
    throw error;
  }
}
