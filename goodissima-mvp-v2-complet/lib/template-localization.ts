import type { DynamicFormField } from "@/components/DynamicFormRenderer";
import { defaultLocale, type Locale } from "@/lib/i18n-core";
import { DEFAULT_RELATION_TEMPLATE_KEY } from "@/lib/relation-templates";

export const INVESTOR_INTRODUCTION_TEMPLATE_KEY = "INVESTOR_INTRODUCTION";

export type LocalizedText = Partial<Record<Locale, string>> & {
  fallback?: string;
};

export type LocalizedOption = {
  label?: string | LocalizedText;
  value: string;
};

export type LocalizableTemplateLabel = string | LocalizedText;

type LocalizedDefaultField = {
  label: LocalizedText;
  placeholder?: LocalizedText;
};

export const defaultSecureConversationCopy = {
  name: {
    fr: "Conversation sécurisée",
    en: "Secure conversation",
  },
  description: {
    fr: "Parcours par défaut pour initier une conversation sécurisée.",
    en: "Default journey to start a secure conversation.",
  },
  publicEyebrow: {
    fr: "Goodissima — Relation sécurisée",
    en: "Goodissima — Secure relationship",
  },
  contactEyebrow: {
    fr: "Relation sécurisée",
    en: "Secure relationship",
  },
  onboardingTitle: {
    fr: "🔒 Ce propriétaire utilise un lien sécurisé",
    en: "🔒 This owner uses a secure link",
  },
  onboardingText: {
    fr: "Ce lien permet d'éviter les messages inutiles, les faux profils et les contacts hors contexte. Merci de vous présenter clairement : votre demande sera traitée plus rapidement.",
    en: "This link helps avoid irrelevant messages, fake profiles and out-of-context contacts. Please introduce yourself clearly so your request can be handled faster.",
  },
  documentOptionalTitle: {
    fr: "Document optionnel",
    en: "Optional document",
  },
  documentOptionalHelp: {
    fr: "Vous pouvez ajouter un lien vers un document si le propriétaire l'a demandé.",
    en: "You can add a document link if the owner requested it.",
  },
  documentNamePlaceholder: {
    fr: "Nom du document",
    en: "Document name",
  },
  documentUrlPlaceholder: {
    fr: "URL du document",
    en: "Document URL",
  },
  notificationConsentTitle: {
    fr: "Souhaitez-vous recevoir des notifications concernant cette relation sécurisée ?",
    en: "Would you like to receive notifications about this secure relationship?",
  },
  notificationConsentHelp: {
    fr: "Votre email reste un canal technique privé et ne sera pas affiché comme identité relationnelle.",
    en: "Your email remains a private technical channel and will not be shown as your relationship identity.",
  },
  notificationEmailLabel: {
    fr: "Email de notification",
    en: "Notification email",
  },
  notificationEmailHelp: {
    fr: "Canal technique privé utilisé uniquement pour les notifications de cette relation sécurisée.",
    en: "Private technical channel used only for notifications about this secure relationship.",
  },
  notificationEmailPlaceholder: {
    fr: "votre-email@exemple.com",
    en: "your-email@example.com",
  },
  submit: {
    fr: "Envoyer ma demande",
    en: "Send my request",
  },
  submitting: {
    fr: "Envoi en cours...",
    en: "Sending...",
  },
  next: {
    fr: "Suivant",
    en: "Next",
  },
  back: {
    fr: "Retour",
    en: "Back",
  },
  stepProgress: {
    fr: "Étape {current} sur {total}",
    en: "Step {current} of {total}",
  },
  messageSentToast: {
    fr: "Message envoyé",
    en: "Message sent",
  },
  fieldErrorToast: {
    fr: "Vérifiez les champs demandés.",
    en: "Please check the required fields.",
  },
};

const defaultSecureConversationFields: Record<string, LocalizedDefaultField> = {
  fullName: {
    label: { fr: "Nom complet", en: "Full name" },
    placeholder: { fr: "Votre nom", en: "Your name" },
  },
  email: {
    label: { fr: "Email", en: "Email" },
    placeholder: { fr: "Votre email", en: "Your email" },
  },
  message: {
    label: { fr: "Message", en: "Message" },
    placeholder: {
      fr: "Présentez-vous et indiquez votre demande",
      en: "Introduce yourself and describe your request",
    },
  },
};

const investorIntroductionCopy = {
  name: {
    fr: "Introduction investisseur",
    en: "Introduction investisseur",
  },
  description: {
    fr: "Parcours de qualification sécurisé pour investisseurs et partenaires stratégiques.",
    en: "Parcours de qualification sécurisé pour investisseurs et partenaires stratégiques.",
  },
};

const investorIntroductionFields: Record<string, LocalizedDefaultField> = {
  name: {
    label: { fr: "Nom et prénom", en: "Nom et prénom" },
  },
  organization: {
    label: { fr: "Organisation / Fonds d’investissement", en: "Organisation / Fonds d’investissement" },
  },
  role: {
    label: { fr: "Fonction", en: "Fonction" },
  },
  country: {
    label: { fr: "Pays", en: "Pays" },
  },
  interestType: {
    label: { fr: "Nature de votre intérêt", en: "Nature de votre intérêt" },
  },
  message: {
    label: {
      fr: "Présentez votre intérêt pour Goodissima",
      en: "Présentez votre intérêt pour Goodissima",
    },
  },
  notificationOptIn: {
    label: {
      fr: "Je souhaite être informé des mises à jour de cet échange sécurisé.",
      en: "Je souhaite être informé des mises à jour de cet échange sécurisé.",
    },
  },
  notificationEmail: {
    label: { fr: "Adresse email de notification", en: "Adresse email de notification" },
  },
};

const investorIntroductionOptions: Record<string, Record<string, LocalizedText>> = {
  interestType: {
    investment: { fr: "Investissement", en: "Investissement" },
    strategic_partnership: { fr: "Partenariat stratégique", en: "Partenariat stratégique" },
    banking: { fr: "Banque / Finance", en: "Banque / Finance" },
    ai: { fr: "IA", en: "IA" },
    marketplace: { fr: "Marketplace", en: "Marketplace" },
    enterprise: { fr: "Entreprise", en: "Entreprise" },
    media: { fr: "Média", en: "Média" },
    other: { fr: "Autre", en: "Autre" },
  },
};

export function getLocalizedValue(
  value: LocalizableTemplateLabel | null | undefined,
  locale: Locale,
  fallback = "",
) {
  if (!value) return fallback;
  if (typeof value === "string") return value;

  return value[locale] ?? value[defaultLocale] ?? value.fallback ?? fallback;
}

export function localizeDefaultSecureConversationField<T extends DynamicFormField>(field: T, locale: Locale): T {
  const localized = defaultSecureConversationFields[field.key];
  if (!localized) return field;

  return {
    ...field,
    label: getLocalizedValue(localized.label, locale, field.label),
    placeholder: getLocalizedValue(localized.placeholder, locale, field.placeholder ?? "") || field.placeholder,
  };
}

export function localizeDefaultSecureConversationFields<T extends DynamicFormField>(fields: T[], locale: Locale) {
  return fields.map((field) => localizeDefaultSecureConversationField(field, locale));
}

export function localizeInvestorIntroductionField<T extends DynamicFormField>(field: T, locale: Locale): T {
  const localized = investorIntroductionFields[field.key];
  const optionLabels = investorIntroductionOptions[field.key];

  return {
    ...field,
    label: localized ? getLocalizedValue(localized.label, locale, field.label) : field.label,
    placeholder: localized
      ? getLocalizedValue(localized.placeholder, locale, field.placeholder ?? "") || field.placeholder
      : field.placeholder,
    options: optionLabels
      ? field.options.map((option) => ({
          ...option,
          label: getLocalizedValue(optionLabels[option.value], locale, option.label),
        }))
      : field.options,
  };
}

export function localizeTemplateFields<T extends DynamicFormField>(
  templateKey: string | null | undefined,
  fields: T[],
  locale: Locale,
) {
  if (templateKey === DEFAULT_RELATION_TEMPLATE_KEY) return localizeDefaultSecureConversationFields(fields, locale);
  if (templateKey === INVESTOR_INTRODUCTION_TEMPLATE_KEY) {
    return fields.map((field) => localizeInvestorIntroductionField(field, locale));
  }

  return fields;
}

export function localizeTemplateName(templateKey: string | null | undefined, name: string, locale: Locale) {
  if (templateKey === DEFAULT_RELATION_TEMPLATE_KEY) {
    return getLocalizedValue(defaultSecureConversationCopy.name, locale, name);
  }
  if (templateKey === INVESTOR_INTRODUCTION_TEMPLATE_KEY) {
    return getLocalizedValue(investorIntroductionCopy.name, locale, name);
  }
  return name;
}

export function localizeTemplateDescription(
  templateKey: string | null | undefined,
  description: string | null,
  locale: Locale,
) {
  if (templateKey === DEFAULT_RELATION_TEMPLATE_KEY) {
    return getLocalizedValue(defaultSecureConversationCopy.description, locale, description ?? "") || description;
  }
  if (templateKey === INVESTOR_INTRODUCTION_TEMPLATE_KEY) {
    return getLocalizedValue(investorIntroductionCopy.description, locale, description ?? "") || description;
  }
  return description;
}

export function getDefaultSecureConversationCopy(
  key: keyof typeof defaultSecureConversationCopy,
  locale: Locale,
  params?: Record<string, string | number>,
) {
  const value = getLocalizedValue(defaultSecureConversationCopy[key], locale);

  if (!params) return value;

  return Object.entries(params).reduce(
    (result, [paramKey, paramValue]) => result.replaceAll(`{${paramKey}}`, String(paramValue)),
    value,
  );
}
