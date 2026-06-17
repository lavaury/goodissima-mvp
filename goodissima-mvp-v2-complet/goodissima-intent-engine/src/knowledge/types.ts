export interface KnowledgeManifestEntry {
  id: string;
  path: string;
  title?: string;
}

export interface KnowledgeManifest {
  version: "1.0";
  root: string;
  entries: KnowledgeManifestEntry[];
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  path: string;
  content: string;
}

export interface KnowledgeSearchResult {
  knowledgeId: string;
  title: string;
  locator: string;
  excerpt: string;
}

export interface KnowledgeAccessLayer {
  list(): Promise<KnowledgeDocument[]>;
  get(id: string): Promise<KnowledgeDocument | undefined>;
  search(query: string): Promise<KnowledgeSearchResult[]>;
}
