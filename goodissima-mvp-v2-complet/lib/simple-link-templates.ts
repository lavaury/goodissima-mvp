import type { SimpleFieldRule } from "./simple-field-rules";

export type SimpleLinkTemplateCategory =
  | "Logement" | "Famille & quotidien" | "Services à domicile" | "Véhicules"
  | "Travaux & devis" | "Emploi & recrutement" | "Documents & démarches"
  | "Professionnels & fournisseurs" | "Gouvernance légère"
  | "Communication & échange" | "Relations & mise en contact";

export type SimpleLinkTemplateField = {
  label: string;
  type: "TEXT" | "TEXTAREA" | "EMAIL" | "PHONE" | "NUMBER" | "DATE" | "SELECT" | "MULTISELECT" | "FILE" | "CHECKBOX";
  required: boolean;
  options?: string[];
  validationRules?: SimpleFieldRule;
};

export type SimpleLinkTemplate = {
  id: string;
  category: SimpleLinkTemplateCategory;
  title: string;
  description: string;
  welcomeMessage: string;
  tags: string[];
  fields: SimpleLinkTemplateField[];
  optionalRules?: string[];
  helpText?: string;
  matchingRecommended?: boolean;
};

const f = (
  label: string,
  type: SimpleLinkTemplateField["type"] = "TEXT",
  required = false,
  options?: string[],
  validationRules?: SimpleFieldRule,
): SimpleLinkTemplateField => ({ label, type, required, options, validationRules });
const contact = (name = "Nom complet") => [f(name, "TEXT", true), f("Email", "EMAIL", true), f("Téléphone", "PHONE")];
const yesNo = ["Oui", "Non"];
const template = (
  id: string, category: SimpleLinkTemplateCategory, title: string, description: string,
  fields: SimpleLinkTemplateField[], tags: string[] = [], helpText?: string,
): SimpleLinkTemplate => ({
  id, category, title, description,
  welcomeMessage: `Merci de compléter ce formulaire pour ${description.charAt(0).toLowerCase()}${description.slice(1)}.`,
  fields, tags, optionalRules: [], helpText,
});

export const simpleLinkTemplateCategories: SimpleLinkTemplateCategory[] = [
  "Logement", "Famille & quotidien", "Services à domicile", "Véhicules", "Travaux & devis",
  "Emploi & recrutement", "Documents & démarches", "Professionnels & fournisseurs", "Gouvernance légère",
  "Communication & échange", "Relations & mise en contact",
];

export const simpleLinkTemplates: SimpleLinkTemplate[] = [
  {
    ...template(
      "secure-conversation",
      "Communication & échange",
      "Conversation sécurisée",
      "Ouvrir un échange sécurisé avec une personne, sans formulaire complexe.",
      [
        f("Nom complet", "TEXT", true),
        f("Email", "EMAIL", true),
        f("Message", "TEXTAREA", true),
        f("Document joint", "FILE"),
      ],
      ["conversation", "message", "échange", "document"],
      "Utilisez ce modèle si vous voulez simplement recevoir un message et éventuellement un document.",
    ),
    welcomeMessage: "Bonjour, vous pouvez utiliser ce lien pour m’écrire dans un espace sécurisé.",
  },
  {
    ...template(
      "relationship-search",
      "Relations & mise en contact",
      "Je cherche une relation",
      "Décrire une recherche de relation ou de mise en contact à examiner humainement.",
      [
        f("Nom complet", "TEXT", true),
        f("Email", "EMAIL", true),
        f("Type de relation recherchée", "SELECT", true, [
          "Échange professionnel", "Partenaire de projet", "Recommandation", "Prestataire",
          "Mentor / conseil", "Contact personnel", "Autre",
        ]),
        f("Domaine ou sujet", "TEXT", true),
        f("Ville ou zone géographique"),
        f("Rayon souhaité en km", "NUMBER", false, undefined, { operator: "GTE", mode: "INDICATIVE", value: "0" }),
        f("Ce que vous recherchez", "TEXTAREA", true),
        f("Ce que vous pouvez proposer en retour", "TEXTAREA"),
        f("Niveau d’urgence", "SELECT", false, ["Faible", "Normal", "Élevé"]),
        f("Document ou présentation", "FILE"),
      ],
      ["relation", "mise en contact", "recommandation", "partenaire", "contact"],
      "Utilisez ce modèle pour exprimer une recherche de contact ou de mise en relation. Goodissima ne contacte personne automatiquement.",
    ),
    welcomeMessage: "Présentez brièvement la relation ou la mise en contact que vous recherchez. Votre demande sera examinée humainement.",
    matchingRecommended: true,
  },
  {
    ...template("rent-apartment", "Logement", "Recherche appartement à louer", "préciser une recherche de logement locatif", [
      ...contact(), f("Ville recherchée", "TEXT", true), f("Quartiers souhaités", "TEXTAREA"),
      f("Budget maximum", "NUMBER", true, undefined, { operator: "LTE", mode: "INDICATIVE", value: "1000" }),
      f("Surface minimale", "NUMBER"), f("Nombre de pièces", "NUMBER"), f("Date d’emménagement souhaitée", "DATE"),
      f("Dossier complet disponible", "SELECT", false, yesNo), f("Message libre", "TEXTAREA"),
    ], ["location", "appartement", "budget"]),
    matchingRecommended: true,
  },
  template("roommate-search", "Logement", "Recherche colocation", "présenter une recherche de colocation", [
    ...contact(), f("Ville recherchée", "TEXT", true), f("Budget maximum", "NUMBER", true), f("Date d’arrivée souhaitée", "DATE"),
    f("Durée souhaitée"), f("Situation", "SELECT", false, ["Étudiant", "Salarié", "Indépendant", "Autre"]),
    f("Animaux", "SELECT", false, yesNo), f("Présentation personnelle", "TEXTAREA"),
  ], ["colocation", "logement"]),
  template("offer-apartment", "Logement", "Proposer un appartement à louer", "décrire un appartement disponible", [
    ...contact("Nom du contact"), f("Ville / secteur", "TEXT", true), f("Surface", "NUMBER"), f("Nombre de pièces", "NUMBER"),
    f("Loyer", "NUMBER", true), f("Charges", "NUMBER"), f("Disponibilité", "DATE"), f("Meublé", "SELECT", false, yesNo),
    f("Photos", "FILE"), f("Description du logement", "TEXTAREA", true),
  ], ["propriétaire", "location"]),
  template("garage-search", "Logement", "Recherche garage ou stationnement", "préciser une recherche de stationnement", [
    ...contact(), f("Ville ou secteur recherché", "TEXT", true),
    f("Type de garage", "SELECT", false, ["Box fermé", "Parking couvert", "Parking extérieur", "Cave", "Autre"]),
    f("Budget maximum", "NUMBER"), f("Rayon souhaité en km", "NUMBER"), f("Date souhaitée", "DATE"), f("Message libre", "TEXTAREA"),
  ], ["garage", "parking"]),

  template("baby-sitter-search", "Famille & quotidien", "Recherche baby-sitter", "organiser une recherche de garde d’enfants", [
    ...contact("Nom du parent"), f("Ville / quartier", "TEXT", true), f("Nombre d’enfants", "NUMBER", true), f("Âge des enfants"),
    f("Jours souhaités", "TEXTAREA"), f("Horaires souhaités"), f("Expérience souhaitée"), f("Permis ou véhicule", "SELECT", false, yesNo),
    f("Message libre", "TEXTAREA"),
  ], ["enfants", "garde", "baby-sitter"]),
  template("family-event", "Famille & quotidien", "Organiser un événement familial", "collecter les réponses des invités", [
    f("Nom", "TEXT", true), f("Email", "EMAIL", true), f("Présence", "SELECT", true, ["Oui", "Non", "Peut-être"]),
    f("Nombre de personnes", "NUMBER"), f("Allergies alimentaires", "TEXTAREA"), f("Besoin d’hébergement", "SELECT", false, yesNo), f("Message", "TEXTAREA"),
  ], ["événement", "invitation"]),
  template("availability", "Famille & quotidien", "Collecter des disponibilités", "recueillir simplement des créneaux", [
    f("Nom", "TEXT", true), f("Email", "EMAIL", true), f("Dates disponibles", "TEXTAREA", true),
    f("Créneaux horaires préférés", "TEXTAREA"), f("Préférence principale"), f("Commentaire", "TEXTAREA"),
  ], ["planning", "dates"]),
  template("activity-registration", "Famille & quotidien", "Inscription à une activité", "enregistrer une inscription à une activité", [
    f("Nom du participant", "TEXT", true), f("Email", "EMAIL", true), f("Téléphone", "PHONE"), f("Âge", "NUMBER"),
    f("Niveau", "SELECT", false, ["Débutant", "Intermédiaire", "Avancé"]), f("Créneau souhaité"),
    f("Autorisation parentale", "CHECKBOX"), f("Commentaire", "TEXTAREA"),
  ], ["activité", "inscription"]),

  template("cleaning-help", "Services à domicile", "Recherche aide ménagère", "décrire un besoin d’aide ménagère", [
    ...contact("Nom"), f("Ville / quartier", "TEXT", true), f("Surface du logement", "NUMBER"), f("Fréquence souhaitée"),
    f("Durée par intervention"), f("Jours préférés"), f("Budget horaire", "NUMBER"), f("Produits fournis", "SELECT", false, yesNo), f("Message", "TEXTAREA"),
  ], ["ménage", "domicile"]),
  template("gardener-search", "Services à domicile", "Recherche jardinier", "décrire des travaux de jardinage", [
    ...contact("Nom"), f("Ville / secteur", "TEXT", true), f("Type de jardin"), f("Surface approximative", "NUMBER"),
    f("Mission", "MULTISELECT", false, ["Tonte", "Taille", "Entretien", "Nettoyage", "Plantation", "Autre"]),
    f("Fréquence"), f("Budget", "NUMBER"), f("Photos", "FILE"), f("Message", "TEXTAREA"),
  ], ["jardin", "entretien"]),
  template("pet-sitter-search", "Services à domicile", "Recherche pet-sitter", "organiser la garde d’un animal", [
    ...contact("Nom"), f("Ville", "TEXT", true), f("Animal concerné", "TEXT", true), f("Dates souhaitées", "TEXTAREA", true),
    f("Mode de garde", "SELECT", false, ["Visite", "Garde à domicile"]), f("Besoins particuliers", "TEXTAREA"), f("Message", "TEXTAREA"),
  ], ["animal", "garde"]),

  template("sell-car", "Véhicules", "Vendre une voiture", "présenter un véhicule à vendre", [
    ...contact("Nom du vendeur"), f("Marque", "TEXT", true), f("Modèle", "TEXT", true), f("Année", "NUMBER"), f("Kilométrage", "NUMBER"),
    f("Énergie", "SELECT", false, ["Essence", "Diesel", "Hybride", "Électrique", "Autre"]),
    f("Boîte", "SELECT", false, ["Manuelle", "Automatique"]), f("Prix demandé", "NUMBER", true),
    f("Contrôle technique", "SELECT", false, yesNo), f("Photos", "FILE"), f("Description", "TEXTAREA"),
  ], ["voiture", "vente"]),
  template("used-car-search", "Véhicules", "Recherche voiture d’occasion", "préciser les critères d’un véhicule recherché", [
    ...contact("Nom"), f("Budget maximum", "NUMBER", true), f("Type de véhicule", "SELECT", false, ["Citadine", "Berline", "SUV", "Utilitaire", "Autre"]),
    f("Marque souhaitée"), f("Kilométrage maximum", "NUMBER"), f("Année minimale", "NUMBER"), f("Énergie souhaitée"),
    f("Localisation"), f("Rayon de recherche en km", "NUMBER"), f("Message", "TEXTAREA"),
  ], ["voiture", "occasion"]),
  template("borrow-vehicle", "Véhicules", "Louer ou prêter un véhicule", "décrire un besoin ponctuel de véhicule", [
    ...contact("Nom"), f("Type de véhicule recherché", "TEXT", true), f("Dates souhaitées", "TEXTAREA", true),
    f("Kilométrage estimé", "NUMBER"), f("Ville de départ"), f("Budget", "NUMBER"), f("Message", "TEXTAREA"),
  ], ["location", "prêt"]),

  template("works-quote", "Travaux & devis", "Demande de devis travaux", "obtenir des propositions pour des travaux", [
    ...contact("Nom"), f("Type de travaux", "TEXT", true), f("Adresse ou secteur", "TEXT", true), f("Surface concernée", "NUMBER"),
    f("Délai souhaité"), f("Budget estimé", "NUMBER"), f("Photos", "FILE"), f("Description du besoin", "TEXTAREA", true),
  ], ["devis", "travaux"]),
  template("craftsperson-search", "Travaux & devis", "Recherche artisan", "trouver un artisan pour une intervention", [
    ...contact("Nom"), f("Métier recherché", "SELECT", true, ["Plombier", "Électricien", "Peintre", "Menuisier", "Maçon", "Autre"]),
    f("Ville", "TEXT", true), f("Urgence", "SELECT", false, ["Faible", "Moyenne", "Forte"]), f("Date souhaitée", "DATE"),
    f("Description", "TEXTAREA", true), f("Photos", "FILE"),
  ], ["artisan", "intervention"]),
  template("plan-intervention", "Travaux & devis", "Signalement d’intervention à planifier", "préparer une intervention technique", [
    ...contact("Nom"), f("Lieu d’intervention", "TEXT", true), f("Type d’intervention", "TEXT", true),
    f("Niveau d’urgence", "SELECT", false, ["Faible", "Moyen", "Fort"]), f("Disponibilités", "TEXTAREA"), f("Commentaire", "TEXTAREA"),
  ], ["maintenance", "planning"]),

  template("simple-application", "Emploi & recrutement", "Candidature simple", "recevoir une candidature concise", [
    ...contact(), f("Poste visé", "TEXT", true), f("Expérience", "TEXTAREA"), f("Disponibilité"), f("CV", "FILE", true), f("Message de motivation", "TEXTAREA"),
  ], ["emploi", "CV"]),
  template("freelance-provider", "Emploi & recrutement", "Recherche prestataire freelance", "présenter une mission freelance", [
    f("Nom de l’entreprise", "TEXT", true), f("Contact", "TEXT", true), f("Email", "EMAIL", true), f("Besoin", "TEXTAREA", true),
    f("Compétences recherchées", "TEXTAREA"), f("Délai"), f("Budget", "NUMBER"), f("Mode de travail", "SELECT", false, ["Sur site", "Hybride", "À distance"]),
    f("Portfolio ou document", "FILE"), f("Message", "TEXTAREA"),
  ], ["freelance", "prestataire"]),
  template("occasional-help", "Emploi & recrutement", "Recrutement baby-sitter / aide ponctuelle", "recevoir des candidatures pour une aide ponctuelle", [
    ...contact("Nom"), f("Expérience", "TEXTAREA"), f("Disponibilités", "TEXTAREA"), f("Zone géographique"),
    f("Tarif horaire", "NUMBER"), f("Références", "FILE"), f("Message", "TEXTAREA"),
  ], ["recrutement", "aide"]),

  template("admin-documents", "Documents & démarches", "Collecte de documents administratifs", "collecter une pièce administrative en sécurité", [
    f("Nom", "TEXT", true), f("Email", "EMAIL", true), f("Type de document", "TEXT", true), f("Pièce jointe", "FILE", true),
    f("Commentaire", "TEXTAREA"), f("Confirmation d’exactitude", "CHECKBOX", true),
  ], ["document", "administratif"]),
  template("tenant-file", "Documents & démarches", "Dossier locataire", "constituer un dossier locataire", [
    ...contact(), f("Situation professionnelle", "TEXT", true), f("Revenus mensuels", "NUMBER"), f("Garant", "SELECT", false, yesNo),
    f("Pièce d’identité", "FILE"), f("Justificatif de revenus", "FILE"), f("Justificatif de domicile", "FILE"), f("Message", "TEXTAREA"),
  ], ["location", "documents"]),
  template("additional-document", "Documents & démarches", "Demande de pièce complémentaire", "recevoir une pièce complémentaire", [
    f("Nom", "TEXT", true), f("Email", "EMAIL", true), f("Pièce demandée", "TEXT", true), f("Motif", "TEXTAREA"),
    f("Date limite souhaitée", "DATE"), f("Fichier", "FILE"), f("Commentaire", "TEXTAREA"),
  ], ["pièce", "démarche"]),

  template("supplier-search", "Professionnels & fournisseurs", "Recherche fournisseur", "décrire un besoin fournisseur", [
    f("Nom de l’entreprise", "TEXT", true), f("Contact", "TEXT", true), f("Email", "EMAIL", true), f("Type de produit ou service", "TEXT", true),
    f("Quantité estimée", "NUMBER"), f("Délai souhaité"), f("Budget", "NUMBER"), f("Zone géographique"),
    f("Document technique", "FILE"), f("Message", "TEXTAREA"),
  ], ["fournisseur", "achat"]),
  template("business-meeting", "Professionnels & fournisseurs", "Demande de rendez-vous professionnel", "préparer une prise de rendez-vous", [
    ...contact("Nom"), f("Organisation"), f("Objet du rendez-vous", "TEXTAREA", true), f("Créneaux disponibles", "TEXTAREA", true),
    f("Mode souhaité", "SELECT", false, ["Visio", "Téléphone", "Présentiel"]), f("Message", "TEXTAREA"),
  ], ["rendez-vous", "professionnel"]),
  template("customer-support", "Professionnels & fournisseurs", "Support client simple", "recueillir une demande de support", [
    ...contact("Nom"), f("Sujet", "TEXT", true), f("Priorité", "SELECT", false, ["Faible", "Normale", "Urgente"]),
    f("Description du problème", "TEXTAREA", true), f("Capture ou document", "FILE"),
  ], ["support", "client"]),

  template("follow-up-meeting", "Gouvernance légère", "Préparer une réunion de suivi", "collecter des éléments avant une réunion", [
    f("Nom", "TEXT", true), f("Email", "EMAIL", true), f("Sujet de la réunion", "TEXT", true), f("Points à traiter", "TEXTAREA", true),
    f("Documents à examiner", "FILE"), f("Questions à trancher", "TEXTAREA"), f("Date souhaitée", "DATE"), f("Commentaire", "TEXTAREA"),
  ], ["réunion", "suivi"]),
  template("security-review", "Gouvernance légère", "Préparer une revue de sécurité", "rassembler les informations d’une revue légère", [
    f("Nom", "TEXT", true), f("Email", "EMAIL", true), f("Objet de la revue", "TEXT", true), f("Documents attendus", "TEXTAREA"),
    f("Accès à vérifier", "TEXTAREA"), f("Risques identifiés", "TEXTAREA"), f("Questions à trancher", "TEXTAREA"),
    f("Responsable pressenti"), f("Commentaire", "TEXTAREA"),
  ], ["sécurité", "revue"]),
  template("document-receipt", "Gouvernance légère", "Déclaration de réception de document", "tracer humainement la réception d’un document", [
    f("Nom", "TEXT", true), f("Email", "EMAIL", true), f("Document concerné", "TEXT", true), f("Date de réception", "DATE", true),
    f("État du document", "SELECT", true, ["Reçu complet", "Reçu incomplet", "Illisible", "À vérifier"]),
    f("Commentaire", "TEXTAREA"), f("Fichier", "FILE"),
  ], ["réception", "document"]),
  template("approval-request", "Gouvernance légère", "Demande d’avis ou de validation", "recueillir un avis sans créer de parcours gouverné", [
    f("Nom", "TEXT", true), f("Email", "EMAIL", true), f("Sujet à valider", "TEXT", true), f("Contexte", "TEXTAREA", true),
    f("Options possibles", "TEXTAREA"), f("Date limite souhaitée", "DATE"), f("Document support", "FILE"), f("Avis ou commentaire", "TEXTAREA"),
  ], ["avis", "validation"]),
];
