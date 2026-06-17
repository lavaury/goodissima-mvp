import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateCiro } from "../ciro/validator.js";
import type { DemoCiroFixture, DemoMergeScenario, FrenchPresentationCatalog } from "./types.js";

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function loadFrenchPresentationCatalog(filePath: string): Promise<FrenchPresentationCatalog> {
  const value = await readJson(filePath);
  if (!isRecord(value) || value.version !== "1.0" || value.locale !== "fr" || !isRecord(value.labels) || !isRecord(value.text) || !isRecord(value.reasons)) {
    throw new Error("Invalid French presentation catalog.");
  }
  for (const key of ["EXACT_MATCH", "STRONG_MATCH", "RELATED_OPPORTUNITY", "WEAK_SIGNAL", "NO_MATCH"]) {
    if (typeof value.labels[key] !== "string" || !value.labels[key]) throw new Error(`Missing presentation label: ${key}.`);
  }
  return value as unknown as FrenchPresentationCatalog;
}

export async function loadDemoCiroFixture(filePath: string): Promise<DemoCiroFixture> {
  const value = await readJson(filePath);
  if (!isRecord(value) || typeof value.presentationId !== "string") throw new Error(`Invalid demo CIRO fixture: ${filePath}.`);
  const validation = validateCiro(value.ciro);
  if (!validation.valid) throw new Error(`Invalid demo CIRO fixture ${filePath}: ${validation.issues[0].message}`);
  return { presentationId: value.presentationId, ciro: validation.value };
}

export async function loadDemoMergeScenario(filePath: string): Promise<DemoMergeScenario> {
  const value = await readJson(filePath);
  if (!isRecord(value) || value.version !== "1.0" || typeof value.requester !== "string" || typeof value.requesterLabel !== "string" || !Array.isArray(value.candidates) || !value.candidates.every((item) => typeof item === "string")) {
    throw new Error("Invalid demo merge scenario.");
  }
  const directory = path.dirname(filePath);
  return {
    version: "1.0",
    requesterLabel: value.requesterLabel,
    requester: await loadDemoCiroFixture(path.resolve(directory, value.requester)),
    candidates: await Promise.all(value.candidates.map((candidate) => loadDemoCiroFixture(path.resolve(directory, candidate)))),
  };
}
