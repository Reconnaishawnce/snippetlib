/**
 * Snippet state for the browse view and save/edit flows (§7.3). All persistence
 * goes through the StorageProvider.
 */
import { create } from "zustand";
import type { Snippet, SnippetMembership } from "../../models/entities";
import { getStorage } from "./storage";
import { useSearchStore } from "./searchStore";
// Circular with tagStore at module level only — both stores touch each other
// strictly inside actions, never during module initialization.
import { useTagStore } from "./tagStore";
import type { LibraryScope } from "./libraryStore";

export interface SnippetDraft {
  name: string;
  content: string;
  tagIds: string[];
  memberships: SnippetMembership[];
}

export interface SnippetState {
  /** Snippets for the current scope (library / all / backlog). */
  snippets: Snippet[];
  loadedScope: LibraryScope | null;

  loadForScope(scope: LibraryScope): Promise<void>;
  reload(): Promise<void>;
  saveNew(draft: SnippetDraft): Promise<Snippet>;
  saveEdit(snippet: Snippet): Promise<Snippet>;
  remove(id: string): Promise<void>;
}

async function fetchForScope(scope: LibraryScope): Promise<Snippet[]> {
  const storage = getStorage();
  switch (scope.kind) {
    case "library":
      return storage.getSnippetsByLibrary(scope.libraryId);
    case "all":
      return storage.getAllSnippets();
    case "backlog":
      return storage.getUnassignedSnippets();
  }
}

export const useSnippetStore = create<SnippetState>((set, get) => ({
  snippets: [],
  loadedScope: null,

  async loadForScope(scope) {
    set({ snippets: await fetchForScope(scope), loadedScope: scope });
  },

  async reload() {
    const scope = get().loadedScope;
    if (scope) {
      set({ snippets: await fetchForScope(scope) });
    }
  },

  async saveNew(draft) {
    const snippet = await getStorage().createSnippet(draft);
    await get().reload();
    await useSearchStore.getState().upsertSnippet(snippet);
    await useTagStore.getState().load(); // usage counts changed
    return snippet;
  },

  async saveEdit(snippet) {
    const updated = await getStorage().updateSnippet(snippet);
    await get().reload();
    await useSearchStore.getState().upsertSnippet(updated);
    await useTagStore.getState().load(); // usage counts changed
    return updated;
  },

  async remove(id) {
    await getStorage().deleteSnippet(id);
    await get().reload();
    useSearchStore.getState().removeSnippet(id);
    await useTagStore.getState().load(); // usage counts changed
  },
}));
