/**
 * MiniSearch wrapper (§7.5) — pure and browser-agnostic. The index holds
 * lightweight docs (never full Snippet objects); callers map ids back to data.
 */
import MiniSearch, { type SearchResult } from "minisearch";

export interface SearchDoc {
  id: string;
  name: string;
  content: string;
  tagNames: string[];
  libraryIds: string[];
}

export interface SearchHit {
  id: string;
  score: number;
  /** The processed query terms that matched — feed these to the highlighter. */
  terms: string[];
}

export interface SearchOptions {
  /** Restrict hits to snippets that are members of this library. */
  libraryId?: string;
}

function createMini(): MiniSearch<SearchDoc> {
  return new MiniSearch<SearchDoc>({
    fields: ["name", "tagNames", "content"],
    extractField: (doc, fieldName) => {
      const value = doc[fieldName as keyof SearchDoc];
      return Array.isArray(value) ? value.join(" ") : String(value ?? "");
    },
    searchOptions: {
      boost: { name: 3, tagNames: 2, content: 1 },
      prefix: true,
      fuzzy: 0.2,
      combineWith: "AND",
    },
  });
}

export class SnippetSearchIndex {
  private mini = createMini();
  /** id → library memberships, kept here because MiniSearch mangles stored arrays. */
  private libraryIdsById = new Map<string, string[]>();

  /** Full rebuild — used on load; incremental updates afterwards. */
  build(docs: SearchDoc[]): void {
    this.mini = createMini();
    this.libraryIdsById = new Map(docs.map((d) => [d.id, d.libraryIds]));
    this.mini.addAll(docs);
  }

  upsert(doc: SearchDoc): void {
    if (this.libraryIdsById.has(doc.id)) {
      this.mini.discard(doc.id);
    }
    this.mini.add(doc);
    this.libraryIdsById.set(doc.id, doc.libraryIds);
  }

  remove(id: string): void {
    if (this.libraryIdsById.has(id)) {
      this.mini.discard(id);
      this.libraryIdsById.delete(id);
    }
  }

  get size(): number {
    return this.libraryIdsById.size;
  }

  search(query: string, options: SearchOptions = {}): SearchHit[] {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }
    let results: SearchResult[] = this.mini.search(trimmed);
    if (options.libraryId !== undefined) {
      const libraryId = options.libraryId;
      results = results.filter((r) =>
        (this.libraryIdsById.get(String(r.id)) ?? []).includes(libraryId)
      );
    }
    return results.map((r) => ({ id: String(r.id), score: r.score, terms: r.terms }));
  }
}
