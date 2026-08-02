import { GovernedMemoryReadError } from "@/lib/governed-memory/read/service";
import { GovernedMemoryHttpAuthError } from "./auth";
import type { GovernedMemoryHttpErrorCode } from "./contracts";
import { GovernedMemoryHttpValidationError } from "./query-parsers";

export type GovernedMemoryHttpErrorMapping = { status: number; code: GovernedMemoryHttpErrorCode; message: string };
export function mapGovernedMemoryHttpError(error: unknown): GovernedMemoryHttpErrorMapping {
  if (error instanceof GovernedMemoryHttpAuthError) return { status: 401, code: "UNAUTHENTICATED", message: "Authentification requise." };
  if (error instanceof GovernedMemoryHttpValidationError) return { status: 400, code: "INVALID_REQUEST", message: "La requête est invalide." };
  if (error instanceof GovernedMemoryReadError) {
    if (["INVALID_INPUT", "INVALID_DATE_RANGE", "UNSUPPORTED_KNOWLEDGE_MODE", "PAGE_LIMIT_EXCEEDED"].includes(error.code)) return { status: 400, code: "INVALID_REQUEST", message: "La requête est invalide." };
    if (error.code === "INCONSISTENT_MEMORY_GRAPH") return { status: 409, code: "INCONSISTENT_MEMORY_GRAPH", message: "La mémoire ne peut pas être reconstruite de façon cohérente." };
    if (error.code === "NOT_FOUND" || error.code === "FORBIDDEN") return { status: 404, code: "NOT_FOUND", message: "La ressource demandée est introuvable." };
  }
  return { status: 500, code: "INTERNAL_ERROR", message: "La lecture de la mémoire est momentanément indisponible." };
}
