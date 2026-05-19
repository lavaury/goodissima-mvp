import { Text } from "@react-email/components";
import { EmailLayout } from "@/emails/components/EmailLayout";

export function NewMessageEmail({
  caseTitle,
  candidateName,
  messagePreview,
  ctaHref,
}: {
  caseTitle: string;
  candidateName: string;
  messagePreview: string;
  ctaHref: string;
}) {
  return (
    <EmailLayout
      preview={`Nouveau message de ${candidateName}`}
      title="Nouveau message dans votre dossier Goodissima"
      ctaHref={ctaHref}
      ctaLabel="Voir le dossier"
    >
      <Text style={paragraph}>
        {candidateName} a envoye un nouveau message dans le dossier <strong>{caseTitle}</strong>.
      </Text>
      <Text style={quote}>{messagePreview}</Text>
    </EmailLayout>
  );
}

const paragraph = {
  margin: "0 0 16px",
};

const quote = {
  margin: "0",
  borderLeft: "3px solid #cbd5e1",
  paddingLeft: "12px",
  color: "#475569",
};
