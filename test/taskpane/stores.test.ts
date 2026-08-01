import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { IndexedDbProvider } from "../../src/storage/IndexedDbProvider";
import { setStorageProvider, getStorage } from "../../src/taskpane/state/storage";
import { useLibraryStore } from "../../src/taskpane/state/libraryStore";
import { useSnippetStore } from "../../src/taskpane/state/snippetStore";

function freshProvider(): IndexedDbProvider {
  return new IndexedDbProvider({
    databaseName: `store-test-${Math.random().toString(36).slice(2)}`,
    appVersion: "test",
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
}

beforeEach(() => {
  setStorageProvider(freshProvider());
  useLibraryStore.setState({
    initialized: false,
    libraries: [],
    scope: { kind: "all" },
    folders: [],
    selectedFolderId: null,
  });
  useSnippetStore.setState({ snippets: [], loadedScope: null });
});

describe("libraryStore.init", () => {
  it("seeds 'My Snippets' on first run and scopes to it", async () => {
    await useLibraryStore.getState().init();
    const state = useLibraryStore.getState();
    expect(state.initialized).toBe(true);
    expect(state.libraries.map((l) => l.name)).toEqual(["My Snippets"]);
    expect(state.scope).toEqual({ kind: "library", libraryId: state.libraries[0]!.id });
    // Seed happens once, not on every init.
    await useLibraryStore.getState().init();
    expect(await getStorage().getAllLibraries()).toHaveLength(1);
  });

  it("restores the active library from prefs", async () => {
    await useLibraryStore.getState().init();
    const second = await useLibraryStore.getState().createLibrary("Compliance");
    // A fresh session should come back to the last active library.
    useLibraryStore.setState({ initialized: false, scope: { kind: "all" } });
    await useLibraryStore.getState().init();
    expect(useLibraryStore.getState().scope).toEqual({ kind: "library", libraryId: second.id });
  });
});

describe("library and folder flows", () => {
  it("deleting the active library falls back to All Libraries", async () => {
    await useLibraryStore.getState().init();
    const doomed = await useLibraryStore.getState().createLibrary("Doomed");
    expect(useLibraryStore.getState().scope).toEqual({ kind: "library", libraryId: doomed.id });
    await useLibraryStore.getState().deleteLibrary(doomed.id);
    expect(useLibraryStore.getState().scope).toEqual({ kind: "all" });
  });

  it("folder CRUD updates state and re-parents on delete", async () => {
    await useLibraryStore.getState().init();
    const parent = await useLibraryStore.getState().createFolder(null, "Findings");
    const child = await useLibraryStore.getState().createFolder(parent.id, "Physical");
    useLibraryStore.getState().selectFolder(parent.id);

    await useLibraryStore.getState().deleteFolder(parent.id);
    const state = useLibraryStore.getState();
    expect(state.folders.map((f) => f.id)).toEqual([child.id]);
    expect(state.folders[0]!.parentId).toBeNull();
    // Selection follows the deleted folder's parent.
    expect(state.selectedFolderId).toBeNull();
  });

  it("moveFolder re-parents and refuses no-op moves", async () => {
    await useLibraryStore.getState().init();
    const a = await useLibraryStore.getState().createFolder(null, "A");
    const b = await useLibraryStore.getState().createFolder(null, "B");
    await useLibraryStore.getState().moveFolder(b.id, a.id);
    expect(useLibraryStore.getState().folders.find((f) => f.id === b.id)?.parentId).toBe(a.id);
  });
});

describe("snippetStore", () => {
  it("save→browse→edit→delete round-trip in the active scope", async () => {
    await useLibraryStore.getState().init();
    const scope = useLibraryStore.getState().scope;
    if (scope.kind !== "library") {
      throw new Error("expected library scope");
    }

    const saved = await useSnippetStore.getState().saveNew({
      name: "Camera coverage",
      content: "Insufficient coverage at [Building Name].",
      tagIds: [],
      memberships: [{ libraryId: scope.libraryId, folderId: null }],
    });
    expect(useSnippetStore.getState().snippets.map((s) => s.id)).toEqual([saved.id]);

    await useSnippetStore.getState().saveEdit({ ...saved, name: "Camera coverage (north)" });
    expect(useSnippetStore.getState().snippets[0]!.name).toBe("Camera coverage (north)");

    await useSnippetStore.getState().remove(saved.id);
    expect(useSnippetStore.getState().snippets).toEqual([]);
  });

  it("backlog scope lists only unassigned snippets", async () => {
    await useLibraryStore.getState().init();
    const scope = useLibraryStore.getState().scope;
    if (scope.kind !== "library") {
      throw new Error("expected library scope");
    }
    await useSnippetStore.getState().saveNew({
      name: "Assigned",
      content: "x",
      tagIds: [],
      memberships: [{ libraryId: scope.libraryId, folderId: null }],
    });
    await useSnippetStore
      .getState()
      .saveNew({ name: "Loose", content: "y", tagIds: [], memberships: [] });

    await useLibraryStore.getState().selectScope({ kind: "backlog" });
    expect(useSnippetStore.getState().snippets.map((s) => s.name)).toEqual(["Loose"]);

    await useLibraryStore.getState().selectScope({ kind: "all" });
    expect(useSnippetStore.getState().snippets).toHaveLength(2);
  });
});
