export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export const CIRO_SCHEMA_VERSION = "1.0" as const;

export interface CiroSourceReference {
  knowledgeId: string;
  locator?: string;
}

export interface CiroRecord {
  schemaVersion: typeof CIRO_SCHEMA_VERSION;
  c: JsonValue;
  i: JsonValue;
  r: JsonValue;
  o: JsonValue;
  sources: CiroSourceReference[];
}
