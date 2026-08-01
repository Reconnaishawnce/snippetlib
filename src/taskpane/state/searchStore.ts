/**
 * Search state (§7.5): the MiniSearch index plus query/scope/tag-filter state.
 * Index docs are derived from snippets + tag names; incremental on snippet ops.
 */
import { create } from "zustand";
import type { Snippet, Tag } from "../../models/entities";
import { SnippetSearchIndex, type SearchDoc, type SearchHit } from "../../search/searchIndex";
import { getStorage } from "./storage";

const index = new SnippetSearchIndex();

function toDoc(snippet: Snippet, tagsById: Map<string, Tag>): SearchDoc {
  return {
    id: snippet.id,
    name: snippet.name,
    content: snippet.content,
    tagNames: snippet.tagIds
      .map((id) => tagsById.get(id)?.name)
      .filter((name): name is string => Boolean(name)),
    libraryIds: [...new Set(snippet.memberships.map((m) => m.libraryId))],
  };
}

export interface SearchState {
  query: string;
  /** When false (default), results are scoped to the active library. */
  allLibraries: boolean;
  /** Multi-tag filter, AND semantics (§7.4). Applies to browse and search. */
  filterTagIds: string[];
  hits: SearchHit[];

  /** Rebuild the whole index from storage (load, tag renames/merges). */
  rebuild(): Promise<void>;
  upsertSnippet(snippet: Snippet): Promise<void>;
  removeSnippet(id: string): void;
  setQuery(query: string, activeLibraryId: string | null): void;
  setAllLibraries(allLibraries: boolean, activeLibraryId: string | null): void;
  toggleFilterTag(tagId: string): void;
  clearFilters(): void;
}

export const useSearchStore = create<SearchState>((set, get) => {
  const run = (query: string, allLibraries: boolean, activeLibraryId: string | null): SearchHit[] =>
    index.search(
      query,
      allLibraries || activeLibraryId === null ? {} : { libraryId: activeLibraryId }
    );

  return {
    query: "",
    allLibraries: false,
    filterTagIds: [],
    hits: [],

    async rebuild() {
      const storage = getStorage();
      const [snippets, tags] = await Promise.all([storage.getAllSnippets(), storage.getAllTags()]);
      const tagsById = new Map(tags.map((t) => [t.id, t]));
      index.build(snippets.map((s) => toDoc(s, tagsById)));
    },

    async upsertSnippet(snippet) {
      const tags = await getStorage().getAllTags();
      index.upsert(toDoc(snippet, new Map(tags.map((t) => [t.id, t]))));
    },

    removeSnippet(id) {
      index.remove(id);
    },

    setQuery(query, activeLibraryId) {
      set({ query, hits: run(query, get().allLibraries, activeLibraryId) });
    },

    setAllLibraries(allLibraries, activeLibraryId) {
      set({ allLibraries, hits: run(get().query, allLibraries, activeLibraryId) });
    },

    toggleFilterTag(tagId) {
      const current = get().filterTagIds;
      set({
        filterTagIds: current.includes(tagId)
          ? current.filter((t) => t !== tagId)
          : [...current, tagId],
      });
    },

    clearFilters() {
      set({ filterTagIds: [] });
    },
  };
});
