import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { IndexedDbProvider } from "../../src/storage/IndexedDbProvider";
import { setStorageProvider, getStorage } from "../../src/taskpane/state/storage";
import { useSnippetStore } from "../../src/taskpane/state/snippetStore";
import { useTagStore } from "../../src/taskpane/state/tagStore";

beforeEach(() => {
  setStorageProvider(
    new IndexedDbProvider({
      databaseName: `tag-test-${Math.random().toString(36).slice(2)}`,
      appVersion: "test",
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    })
  );
  useTagStore.setState({ tags: [] });
  useSnippetStore.setState({ snippets: [], loadedScope: null });
});

describe("tagStore", () => {
  it("getOrCreate loads state and dedupes case-insensitively", async () => {
    const a = await useTagStore.getState().getOrCreate("Physical");
    const b = await useTagStore.getState().getOrCreate("physical");
    expect(b.id).toBe(a.id);
    expect(useTagStore.getState().tags).toHaveLength(1);
    expect(useTagStore.getState().exists("PHYSICAL")).toBe(true);
  });

  it("rename without collision updates the name", async () => {
    const tag = await useTagStore.getState().getOrCreate("locks");
    const renamed = await useTagStore.getState().rename(tag.id, "door locks");
    expect(renamed.name).toBe("door locks");
    expect(useTagStore.getState().tags.map((t) => t.name)).toEqual(["door locks"]);
  });

  it("rename onto an existing name merges the tags", async () => {
    const storage = getStorage();
    const physical = await useTagStore.getState().getOrCreate("physical");
    const phys = await useTagStore.getState().getOrCreate("phys");
    const snippet = await storage.createSnippet({
      name: "S",
      content: "x",
      tagIds: [phys.id],
      memberships: [],
    });

    const survivor = await useTagStore.getState().rename(phys.id, "Physical");
    expect(survivor.id).toBe(physical.id);
    expect(useTagStore.getState().tags).toHaveLength(1);
    expect((await storage.getSnippet(snippet.id))?.tagIds).toEqual([physical.id]);
    expect((await storage.getTag(physical.id))?.usageCount).toBe(1);
  });

  it("merge combines snippets that carried both tags without duplicates", async () => {
    const storage = getStorage();
    const a = await useTagStore.getState().getOrCreate("a");
    const b = await useTagStore.getState().getOrCreate("b");
    const both = await storage.createSnippet({
      name: "Both",
      content: "x",
      tagIds: [a.id, b.id],
      memberships: [],
    });
    const onlyA = await storage.createSnippet({
      name: "OnlyA",
      content: "y",
      tagIds: [a.id],
      memberships: [],
    });

    await useTagStore.getState().merge(a.id, b.id);
    expect((await storage.getSnippet(both.id))?.tagIds).toEqual([b.id]);
    expect((await storage.getSnippet(onlyA.id))?.tagIds).toEqual([b.id]);
    expect(await storage.getTag(a.id)).toBeUndefined();
    expect((await storage.getTag(b.id))?.usageCount).toBe(2);
  });

  it("remove strips the tag from snippets", async () => {
    const storage = getStorage();
    const tag = await useTagStore.getState().getOrCreate("temp");
    const snippet = await storage.createSnippet({
      name: "S",
      content: "x",
      tagIds: [tag.id],
      memberships: [],
    });
    await useTagStore.getState().remove(tag.id);
    expect(useTagStore.getState().tags).toEqual([]);
    expect((await storage.getSnippet(snippet.id))?.tagIds).toEqual([]);
  });
});
