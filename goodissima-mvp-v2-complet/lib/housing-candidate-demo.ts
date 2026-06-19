import { evaluateMerge } from "../goodissima-intent-engine/dist/src/merge/candidate-evaluator.js";
import type { CiroRecord } from "../goodissima-intent-engine/dist/src/ciro/model.js";
import type { HousingMatchBand, HousingRentalOffer, RankedHousingCandidate } from "./housing-candidate-demo-client";
export type { HousingMatchBand, HousingRentalOffer, RankedHousingCandidate } from "./housing-candidate-demo-client";

type CandidateFixture = {
  id: string;
  displayName: string;
  summary: string;
  trustCredentials: string[];
  practicalSignals: string[];
  ciro: CiroRecord;
};

const sourceCiro: CiroRecord = {
  schemaVersion: "1.0",
  c: { intent: "PROPERTY_RENTAL" },
  i: { trustPolicy: "REAL_ESTATE_RENTAL_POLICY" },
  r: { roles: ["locataire", "proprietaire"] },
  o: { relationship: "PROPERTY_RENTAL" },
  sources: [{ knowledgeId: "goodissima-trust-architecture" }],
};

export const housingRentalOffer: HousingRentalOffer = {
  id: "offre-location-demo-lyon",
  title: "T3 lumineux avec balcon",
  certificationStatus: "CERTIFIÉE",
  landlordDisplayName: "Propriétaire certifié · Habitat Rhône",
  location: "Lyon 7e · Jean Macé",
  rent: "1 180 € charges comprises",
  surface: "67 m²",
  rooms: "3 pièces · 2 chambres",
  availability: "Disponible le 1er septembre",
  requirements: ["Revenus ou garantie vérifiables", "Dossier locatif complet", "Entrée souhaitée sous 45 jours"],
  trustCredentials: ["Identité vérifiée", "Propriété vérifiée", "Annonce certifiée"],
  ciro: sourceCiro,
};

function ciro(overrides: { relationship?: string; roles?: string[]; trust?: string; intent?: string } = {}): CiroRecord {
  return {
    schemaVersion: "1.0",
    c: { intent: overrides.intent ?? "PROPERTY_RENTAL" },
    i: { trustPolicy: overrides.trust ?? "REAL_ESTATE_RENTAL_POLICY" },
    r: { roles: overrides.roles ?? ["locataire", "proprietaire"] },
    o: { relationship: overrides.relationship ?? "PROPERTY_RENTAL" },
    sources: [{ knowledgeId: "goodissima-trust-architecture" }],
  };
}

const credentials = ["Identité vérifiée", "Dossier locatif certifié", "Consentement au matching"];
const candidates: CandidateFixture[] = [
  { id: "cand-01", displayName: "Camille R. · Profil A01", summary: "Cheffe de projet, recherche un T3 proche des transports pour une installation durable.", trustCredentials: [...credentials, "Revenus vérifiés"], practicalSignals: ["Budget compatible", "Entrée au 1er septembre", "Dossier complet"], ciro: ciro() },
  { id: "cand-02", displayName: "Nora B. · Profil A02", summary: "Enseignante en mobilité, souhaite deux chambres et un quartier central.", trustCredentials: [...credentials, "Garantie vérifiée"], practicalSignals: ["Surface recherchée compatible", "Garantie validée", "Calendrier compatible"], ciro: ciro() },
  { id: "cand-03", displayName: "Julien M. · Profil A03", summary: "Couple avec un enfant, dossier stable et recherche longue durée.", trustCredentials: [...credentials, "Revenus vérifiés"], practicalSignals: ["Deux chambres nécessaires", "Projet longue durée", "Dossier complet"], ciro: ciro() },
  { id: "cand-04", displayName: "Sarah L. · Profil B04", summary: "Architecte indépendante avec garant certifié, très intéressée par le secteur.", trustCredentials: [...credentials, "Garantie vérifiée"], practicalSignals: ["Quartier prioritaire", "Budget compatible"], ciro: ciro({ trust: "GUARANTOR_REVIEW_POLICY" }) },
  { id: "cand-05", displayName: "Mehdi K. · Profil B05", summary: "Ingénieur en période d'essai, recherche une installation rapide.", trustCredentials: [...credentials, "Contrat vérifié"], practicalSignals: ["Entrée rapide", "Budget compatible"], ciro: ciro({ trust: "EMPLOYMENT_TRANSITION_RENTAL_POLICY" }) },
  { id: "cand-06", displayName: "Élodie P. · Profil B06", summary: "Locataire certifiée, composition du foyer encore à confirmer.", trustCredentials: credentials, practicalSignals: ["Dossier disponible", "Zone compatible"], ciro: ciro({ roles: ["locataire"] }) },
  { id: "cand-07", displayName: "Thomas G. · Profil B07", summary: "Mutation professionnelle à Lyon, recherche un T3 pour septembre.", trustCredentials: [...credentials, "Employeur vérifié"], practicalSignals: ["Calendrier compatible", "Revenus vérifiés"], ciro: ciro({ intent: "HOUSING" }) },
  { id: "cand-08", displayName: "Inès D. · Profil B08", summary: "Doctorante avec caution institutionnelle, recherche deux chambres.", trustCredentials: [...credentials, "Caution vérifiée"], practicalSignals: ["Configuration compatible", "Garantie disponible"], ciro: ciro({ trust: "ACADEMIC_GUARANTEE_POLICY" }) },
  { id: "cand-09", displayName: "Anaïs V. · Profil C09", summary: "Freelance avec revenus certifiés, date d'entrée flexible.", trustCredentials: [...credentials, "Revenus vérifiés"], practicalSignals: ["Budget compatible", "Flexibilité d'entrée"], ciro: ciro({ roles: ["locataire"], trust: "INDEPENDENT_INCOME_POLICY" }) },
  { id: "cand-10", displayName: "Louis F. · Profil C10", summary: "Jeune actif avec garant, hésite entre location classique et colocation.", trustCredentials: [...credentials, "Garantie vérifiée"], practicalSignals: ["Secteur compatible", "Garant disponible"], ciro: ciro({ roles: ["locataire"], intent: "HOUSING" }) },
  { id: "cand-11", displayName: "Maya C. · Profil C11", summary: "Consultante en mission longue, politique documentaire distincte.", trustCredentials: [...credentials, "Mission vérifiée"], practicalSignals: ["Durée de mission compatible", "Budget à confirmer"], ciro: ciro({ trust: "CORPORATE_MOBILITY_POLICY", intent: "HOUSING" }) },
  { id: "cand-12", displayName: "Romain S. · Profil C12", summary: "Parent séparé recherchant un logement proche des écoles.", trustCredentials: credentials, practicalSignals: ["Deux chambres souhaitées", "Zone élargie acceptable"], ciro: ciro({ roles: ["locataire"], trust: "FAMILY_REVIEW_POLICY" }) },
  { id: "cand-13", displayName: "Leïla H. · Profil C13", summary: "Entrepreneuse, dossier certifié mais cadre de garantie différent.", trustCredentials: [...credentials, "Entreprise vérifiée"], practicalSignals: ["Budget compatible", "Garantie à préciser"], ciro: ciro({ trust: "ENTREPRENEUR_RENTAL_POLICY", intent: "HOUSING" }) },
  { id: "cand-14", displayName: "Arthur N. · Profil C14", summary: "Salarié en télétravail, recherche plus largement dans la métropole.", trustCredentials: credentials, practicalSignals: ["Surface compatible", "Localisation à confirmer"], ciro: ciro({ roles: ["occupant"], intent: "HOUSING" }) },
  { id: "cand-15", displayName: "Zoé T. · Profil D15", summary: "Projet de colocation encore incomplet malgré une identité certifiée.", trustCredentials: credentials, practicalSignals: ["Budget individuel compatible"], ciro: ciro({ roles: ["occupant"], trust: "SHARED_HOUSING_POLICY", intent: "HOUSING" }) },
  { id: "cand-16", displayName: "Paul E. · Profil D16", summary: "Recherche temporaire avec justificatifs à compléter.", trustCredentials: credentials, practicalSignals: ["Date d'entrée compatible"], ciro: ciro({ roles: ["occupant"], trust: "TEMPORARY_HOUSING_POLICY", intent: "TEMPORARY_HOUSING" }) },
  { id: "cand-17", displayName: "Clara J. · Profil D17", summary: "Dossier certifié pour résidence étudiante, peu aligné avec cette offre.", trustCredentials: credentials, practicalSignals: ["Quartier compatible"], ciro: ciro({ roles: ["étudiant"], trust: "STUDENT_RESIDENCE_POLICY", intent: "STUDENT_HOUSING" }) },
  { id: "cand-18", displayName: "Hugo A. · Profil D18", summary: "Recherche un bail mobilité avec cadre documentaire spécifique.", trustCredentials: credentials, practicalSignals: ["Surface acceptable"], ciro: ciro({ roles: ["occupant temporaire"], trust: "MOBILITY_LEASE_POLICY", intent: "MOBILITY_HOUSING" }) },
  { id: "cand-19", displayName: "Profil masqué E19", summary: "Intent professionnel sans relation locative compatible.", trustCredentials: credentials, practicalSignals: [], ciro: ciro({ relationship: "EMPLOYMENT", roles: ["candidat", "recruteur"], trust: "EMPLOYMENT_POLICY", intent: "EMPLOYMENT" }) },
  { id: "cand-20", displayName: "Profil masqué E20", summary: "Intent d'emploi certifié, hors périmètre de l'offre de location.", trustCredentials: credentials, practicalSignals: [], ciro: ciro({ relationship: "EMPLOYMENT", roles: ["candidat", "recruteur"], trust: "EMPLOYMENT_POLICY", intent: "EMPLOYMENT" }) },
];

const bandByStatus: Record<string, { band: HousingMatchBand; label: string }> = {
  EXACT_MATCH: { band: "EXCELLENT", label: "Excellent" },
  STRONG_MATCH: { band: "STRONG", label: "Fort" },
  RELATED_OPPORTUNITY: { band: "OPPORTUNITY", label: "Opportunité" },
  WEAK_SIGNAL: { band: "WEAK", label: "Faible" },
  NO_MATCH: { band: "NO_MATCH", label: "Hors correspondance" },
};

const dimensionLabels = {
  relationshipScore: "Relation locative compatible",
  roleScore: "Rôles locataire-propriétaire compatibles",
  trustScore: "Politique de confiance compatible",
  familyScore: "Intent logement compatible",
} as const;

export function rankHousingCandidates(): RankedHousingCandidate[] {
  return evaluateMerge(housingRentalOffer.ciro, candidates.map((candidate) => candidate.ciro)).map((result) => {
    const candidate = candidates[result.candidateIndex];
    const scoreBreakdown = {
      relationshipScore: result.relationshipScore,
      roleScore: result.roleScore,
      trustScore: result.trustScore,
      familyScore: result.familyScore,
      totalScore: result.totalScore,
    };
    const dimensions = Object.entries(scoreBreakdown).filter(([key]) => key !== "totalScore") as Array<[keyof typeof dimensionLabels, number]>;
    const matched = dimensions.filter(([, score]) => score > 0).map(([key]) => dimensionLabels[key]);
    const missing = dimensions.filter(([, score]) => score === 0).map(([key]) => dimensionLabels[key].replace(" compatible", " à vérifier ou non compatible"));
    const presentation = bandByStatus[result.status];
    return {
      ...candidate,
      certificationStatus: "CERTIFIÉ",
      matchScore: Math.round((result.totalScore / 4) * 100),
      matchStatus: result.status,
      band: presentation.band,
      bandLabel: presentation.label,
      explanations: [...matched, ...candidate.practicalSignals],
      weakCriteria: missing,
      scoreBreakdown,
    };
  });
}

export const housingDemoScoringContract = {
  engine: "evaluateMerge",
  maximumScore: 4,
  statusBands: bandByStatus,
} as const;
