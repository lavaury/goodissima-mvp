import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import type {
  KnowledgeAccessLayer,
  KnowledgeDocument,
  KnowledgeManifest,
  KnowledgeManifestEntry,
  KnowledgeSearchResult,
} from "./types.js";

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function titleFromContent(content: string, fallback: string): string {
  const heading = content
    .split(/\r?\n/u)
    .find((line) => /^#\s+\S/u.test(line));
  return heading ? heading.replace(/^#\s+/u, "").trim() : fallback;
}

export class FileSystemKnowledgeAccessLayer implements KnowledgeAccessLayer {
  private constructor(
    private readonly root: string,
    private readonly entries: readonly KnowledgeManifestEntry[],
  ) {}

  static async fromManifest(manifestPath: string): Promise<FileSystemKnowledgeAccessLayer> {
    const absoluteManifestPath = path.resolve(manifestPath);
    const raw = await readFile(absoluteManifestPath, "utf8");
    const manifest = JSON.parse(raw) as KnowledgeManifest;

    if (
      manifest.version !== "1.0" ||
      typeof manifest.root !== "string" ||
      !manifest.root ||
      !Array.isArray(manifest.entries)
    ) {
      throw new Error("Unsupported or invalid knowledge manifest.");
    }

    const ids = new Set<string>();
    for (const entry of manifest.entries) {
      if (!entry.id || !entry.path || ids.has(entry.id)) {
        throw new Error("Knowledge entries require unique ids and non-empty paths.");
      }
      ids.add(entry.id);
    }

    const manifestDirectory = path.dirname(absoluteManifestPath);
    return new FileSystemKnowledgeAccessLayer(
      await realpath(path.resolve(manifestDirectory, manifest.root)),
      manifest.entries,
    );
  }

  async list(): Promise<KnowledgeDocument[]> {
    return Promise.all(this.entries.map((entry) => this.readEntry(entry)));
  }

  async get(id: string): Promise<KnowledgeDocument | undefined> {
    const entry = this.entries.find((candidate) => candidate.id === id);
    return entry ? this.readEntry(entry) : undefined;
  }

  async search(query: string): Promise<KnowledgeSearchResult[]> {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return [];

    const documents = await this.list();
    const results: KnowledgeSearchResult[] = [];

    for (const document of documents) {
      const lines = document.content.split(/\r?\n/u);
      lines.forEach((line, index) => {
        if (line.toLocaleLowerCase().includes(normalizedQuery)) {
          results.push({
            knowledgeId: document.id,
            title: document.title,
            locator: `line:${index + 1}`,
            excerpt: line.trim(),
          });
        }
      });
    }

    return results;
  }

  private async readEntry(entry: KnowledgeManifestEntry): Promise<KnowledgeDocument> {
    const unresolvedPath = path.resolve(this.root, entry.path);
    const resolvedPath = await realpath(unresolvedPath);
    if (!isInside(this.root, resolvedPath)) {
      throw new Error(`Knowledge path escapes the configured root: ${entry.id}`);
    }

    const content = await readFile(resolvedPath, "utf8");
    return {
      id: entry.id,
      title: entry.title ?? titleFromContent(content, entry.id),
      path: resolvedPath,
      content,
    };
  }
}
