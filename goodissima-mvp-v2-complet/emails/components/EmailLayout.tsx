import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

const LOGO_URL = "https://goodissima.app/logo-goodissima.png";

export function EmailLayout({
  preview,
  title,
  children,
  ctaHref,
  ctaLabel,
}: {
  preview: string;
  title: string;
  children: ReactNode;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Img src={LOGO_URL} width="220" alt="Goodissima" style={logo} />
          <Heading style={heading}>{title}</Heading>
          <Section style={content}>{children}</Section>
          <Button href={ctaHref} style={button}>
            {ctaLabel}
          </Button>
          <Hr style={hr} />
          <Text style={footer}>
            Cet email a été envoyé par Goodissima dans le cadre d’une relation sécurisée. Vous
            recevez cet email car vous participez à un échange sécurisé Goodissima.
          </Text>
          <Text style={footer}>
            This email was sent by Goodissima as part of a secure relationship. You are receiving
            this email because you are participating in a secure Goodissima exchange.
          </Text>
          <Text style={footerLink}>
            goodissima.app
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  margin: "0",
  backgroundColor: "#f8fafc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "32px 20px",
  maxWidth: "560px",
};

const logo = {
  margin: "0 0 24px",
  height: "auto",
};

const heading = {
  margin: "0 0 16px",
  color: "#0f172a",
  fontSize: "24px",
  lineHeight: "32px",
  fontWeight: "700",
};

const content = {
  color: "#334155",
  fontSize: "15px",
  lineHeight: "24px",
};

const button = {
  display: "inline-block",
  marginTop: "24px",
  borderRadius: "12px",
  backgroundColor: "#0f172a",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "600",
  padding: "12px 18px",
  textDecoration: "none",
};

const hr = {
  margin: "32px 0 16px",
  borderColor: "#e2e8f0",
};

const footer = {
  margin: "0 0 10px",
  color: "#64748b",
  fontSize: "12px",
  lineHeight: "18px",
};

const footerLink = {
  margin: "0",
  color: "#0f766e",
  fontSize: "12px",
  fontWeight: "700",
  lineHeight: "18px",
};
