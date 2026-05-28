import { Text } from "@react-email/components";
import { EmailLayout } from "@/emails/components/EmailLayout";

export function NewDocumentEmail({
  caseTitle,
  candidateName,
  fileName,
  ctaHref,
}: {
  caseTitle: string;
  candidateName: string;
  fileName: string;
  ctaHref: string;
}) {
  return (
    <EmailLayout
      preview={`Nouveau document de ${candidateName}`}
      title="Nouveau document dans votre dossier Goodissima"
      ctaHref={ctaHref}
      ctaLabel="Voir le document dans le dossier"
    >
      <Text style={paragraph}>
        {candidateName} a ajoute un document dans le dossier <strong>{caseTitle}</strong>.
      </Text>
      <Text style={fileNameStyle}>{fileName}</Text>
    </EmailLayout>
  );
}

const paragraph = {
  margin: "0 0 16px",
};

const fileNameStyle = {
  margin: "0",
  color: "#475569",
  fontWeight: "600",
};
