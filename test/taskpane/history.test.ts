import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { IndexedDbProvider } from "../../src/storage/IndexedDbProvider";
import { setStorageProvider } from "../../src/taskpane/state/storage";
import { useLibraryStore } from "../../src/taskpane/state/libraryStore";
import { useSnippetStore } from "../../src/taskpane/state/snippetStore";

beforeEach(async () => {
  setStorageProvider(
    new IndexedDbProvider({
      databaseName: `history-test-${Math.random().toString(36).slice(2)}`,
      appVersion: "test",
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    })
  );
  useLibraryStore.setState({
    initialized: false,
    libraries: [],
    scope: { kind: "all" },
    folders: [],
    selectedFolderId: null,
  });
  useSnippetStore.setState({ snippets: [], loadedScope: null });
  await useLibraryStore.getState().init();
});

async function seed() {
  return useSnippetStore.getState().saveNew({
    name: "v1 name",
    content: "v1 content",
    tagIds: [],
    memberships: [],
  });
}

describe("revision history (§7.9)", () => {
  it("update pushes the previous name/content, capped at 3, newest first", async () => {
    let snippet = await seed();
    for (const v of ["v2", "v3", "v4", "v5"]) {
      snippet = await useSnippetStore.getState().updateWithHistory(snippet, {
        name: `${v} name`,
        content: `${v} content`,
        tagIds: snippet.tagIds,
        memberships: snippet.memberships,
      });
    }
    expect(snippet.name).toBe("v5 name");
    expect(snippet.history).toHaveLength(3);
    expect(snippet.history.map((r) => r.name)).toEqual(["v4 name", "v3 name", "v2 name"]);
  });

  it("restore swaps in the revision and pushes the current state", async () => {
    let snippet = await seed();
    snippet = await useSnippetStore.getState().updateWithHistory(snippet, {
      name: "v2 name",
      content: "v2 content",
      tagIds: [],
      memberships: [],
    });

    const restored = await useSnippetStore.getState().restoreRevision(snippet, 0);
    expect(restored.name).toBe("v1 name");
    expect(restored.content).toBe("v1 content");
    expect(restored.history[0]!.name).toBe("v2 name");
  });

  it("save-as-new starts with empty history and keeps the original intact", async () => {
    const original = await seed();
    const fresh = await useSnippetStore.getState().saveAsNew({
      name: "different",
      content: "totally different content",
      tagIds: original.tagIds,
      memberships: original.memberships,
    });
    expect(fresh.id).not.toBe(original.id);
    expect(fresh.history).toEqual([]);
    const { getStorage } = await import("../../src/taskpane/state/storage");
    expect((await getStorage().getSnippet(original.id))?.name).toBe("v1 name");
  });
});
