/**
 * Library + folder state (§7.1, §7.2). All persistence goes through the
 * StorageProvider — never Dexie directly.
 */
import { create } from "zustand";
import type { Folder, Library } from "../../models/entities";
import { getStorage } from "./storage";
import { useSnippetStore } from "./snippetStore";
import { useSearchStore } from "./searchStore";
import { useTagStore } from "./tagStore";

/** The switcher's pseudo-entries alongside real library ids (§7.1). */
export type LibraryScope =
  { kind: "library"; libraryId: string } | { kind: "all" } | { kind: "backlog" };

export interface LibraryState {
  initialized: boolean;
  libraries: Library[];
  scope: LibraryScope;
  /** Folders of the scoped library (empty for all/backlog scopes). */
  folders: Folder[];
  /** Selected folder within the scoped library; null = library root. */
  selectedFolderId: string | null;

  init(): Promise<void>;
  selectScope(scope: LibraryScope): Promise<void>;
  selectFolder(folderId: string | null): void;

  createLibrary(name: string, description?: string): Promise<Library>;
  renameLibrary(id: string, name: string): Promise<void>;
  deleteLibrary(id: string): Promise<void>;

  createFolder(parentId: string | null, name: string): Promise<Folder>;
  renameFolder(id: string, name: string): Promise<void>;
  deleteFolder(id: string): Promise<void>;
  moveFolder(id: string, newParentId: string | null): Promise<void>;
}

async function loadFoldersForScope(scope: LibraryScope): Promise<Folder[]> {
  if (scope.kind !== "library") {
    return [];
  }
  return getStorage().getFoldersByLibrary(scope.libraryId);
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  initialized: false,
  libraries: [],
  scope: { kind: "all" },
  folders: [],
  selectedFolderId: null,

  async init() {
    const storage = getStorage();
    await storage.init();
    let libraries = await storage.getAllLibraries();
    if (libraries.length === 0) {
      // First run: seed one library so the save flow never dead-ends (§7.1).
      const seeded = await storage.createLibrary({ name: "My Snippets" });
      libraries = [seeded];
      await storage.updatePrefs({ activeLibraryId: seeded.id });
    }
    const prefs = await storage.getPrefs();
    const active = libraries.find((l) => l.id === prefs.activeLibraryId);
    const scope: LibraryScope = active
      ? { kind: "library", libraryId: active.id }
      : { kind: "all" };
    set({
      initialized: true,
      libraries,
      scope,
      folders: await loadFoldersForScope(scope),
      selectedFolderId: null,
    });
    await useSnippetStore.getState().loadForScope(scope);
    await useTagStore.getState().load();
    await useSearchStore.getState().rebuild();
  },

  async selectScope(scope) {
    set({ scope, folders: await loadFoldersForScope(scope), selectedFolderId: null });
    await getStorage().updatePrefs({
      activeLibraryId: scope.kind === "library" ? scope.libraryId : null,
    });
    await useSnippetStore.getState().loadForScope(scope);
  },

  selectFolder(folderId) {
    set({ selectedFolderId: folderId });
  },

  async createLibrary(name, description) {
    const library = await getStorage().createLibrary({ name, description });
    set({ libraries: [...get().libraries, library] });
    await get().selectScope({ kind: "library", libraryId: library.id });
    return library;
  },

  async renameLibrary(id, name) {
    const library = get().libraries.find((l) => l.id === id);
    if (!library) {
      return;
    }
    const updated = await getStorage().updateLibrary({ ...library, name });
    set({ libraries: get().libraries.map((l) => (l.id === id ? updated : l)) });
  },

  async deleteLibrary(id) {
    await getStorage().deleteLibrary(id);
    const libraries = get().libraries.filter((l) => l.id !== id);
    set({ libraries });
    const { scope } = get();
    if (scope.kind === "library" && scope.libraryId === id) {
      await get().selectScope({ kind: "all" });
    } else {
      await useSnippetStore.getState().loadForScope(scope);
    }
  },

  async createFolder(parentId, name) {
    const { scope, folders } = get();
    if (scope.kind !== "library") {
      throw new Error("Folders can only be created inside a library.");
    }
    const siblings = folders.filter((f) => f.parentId === parentId);
    const folder = await getStorage().createFolder({
      libraryId: scope.libraryId,
      parentId,
      name,
      sortOrder: siblings.length,
    });
    set({ folders: [...folders, folder] });
    return folder;
  },

  async renameFolder(id, name) {
    const folder = get().folders.find((f) => f.id === id);
    if (!folder) {
      return;
    }
    const updated = await getStorage().updateFolder({ ...folder, name });
    set({ folders: get().folders.map((f) => (f.id === id ? updated : f)) });
  },

  async deleteFolder(id) {
    const { scope, selectedFolderId, folders } = get();
    const deleted = folders.find((f) => f.id === id);
    await getStorage().deleteFolder(id);
    set({
      folders: await loadFoldersForScope(scope),
      // Contents moved to the parent; follow the selection there too.
      selectedFolderId: selectedFolderId === id ? (deleted?.parentId ?? null) : selectedFolderId,
    });
    await useSnippetStore.getState().loadForScope(scope);
  },

  async moveFolder(id, newParentId) {
    const folder = get().folders.find((f) => f.id === id);
    if (!folder || folder.parentId === newParentId) {
      return;
    }
    const siblings = get().folders.filter((f) => f.parentId === newParentId && f.id !== id);
    const updated = await getStorage().updateFolder({
      ...folder,
      parentId: newParentId,
      sortOrder: siblings.length,
    });
    set({ folders: get().folders.map((f) => (f.id === id ? updated : f)) });
  },
}));
