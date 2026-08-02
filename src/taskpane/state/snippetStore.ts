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

export const HISTORY_LIMIT = 3;

export interface SnippetState {
  /** Snippets for the current scope (library / all / backlog). */
  snippets: Snippet[];
  loadedScope: LibraryScope | null;

  loadForScope(scope: LibraryScope): Promise<void>;
  reload(): Promise<void>;
  saveNew(draft: SnippetDraft): Promise<Snippet>;
  saveEdit(snippet: Snippet): Promise<Snippet>;
  /** Update, pushing the previous name/content onto history (cap 3, §7.9). */
  updateWithHistory(previous: Snippet, changes: SnippetDraft): Promise<Snippet>;
  /** New snippet from an edit — same tags/memberships, empty history (§7.9). */
  saveAsNew(changes: SnippetDraft): Promise<Snippet>;
  /** Restore a revision; the current state is pushed onto history first (§7.9). */
  restoreRevision(snippet: Snippet, revisionIndex: number): Promise<Snippet>;
  remove(id: string): Promise<void>;
  /** Bump usage stats after an insert (frecency sorting; not an edit). */
  recordUsage(ids: string[]): Promise<void>;
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

  async updateWithHistory(previous, changes) {
    const revision = {
      name: previous.name,
      content: previous.content,
      savedAt: new Date().toISOString(),
    };
    return get().saveEdit({
      ...previous,
      ...changes,
      history: [revision, ...previous.history].slice(0, HISTORY_LIMIT),
    });
  },

  async saveAsNew(changes) {
    return get().saveNew(changes);
  },

  async restoreRevision(snippet, revisionIndex) {
    const revision = snippet.history[revisionIndex];
    if (!revision) {
      throw new Error("That revision no longer exists.");
    }
    const current = {
      name: snippet.name,
      content: snippet.content,
      savedAt: new Date().toISOString(),
    };
    const history = snippet.history.filter((_, i) => i !== revisionIndex);
    return get().saveEdit({
      ...snippet,
      name: revision.name,
      content: revision.content,
      history: [current, ...history].slice(0, HISTORY_LIMIT),
    });
  },

  async remove(id) {
    await getStorage().deleteSnippet(id);
    await get().reload();
    useSearchStore.getState().removeSnippet(id);
    await useTagStore.getState().load(); // usage counts changed
  },

  async recordUsage(ids) {
    await getStorage().recordSnippetUsage(ids);
    await get().reload(); // usage-based sorts see fresh counts
  },
}));
