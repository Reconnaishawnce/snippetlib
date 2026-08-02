import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";
import { IndexedDbProvider } from "../../src/storage/IndexedDbProvider";

let providers: IndexedDbProvider[] = [];

function makeProvider(): IndexedDbProvider {
  const provider = new IndexedDbProvider({
    databaseName: `test-${Math.random().toString(36).slice(2)}`,
    appVersion: "test",
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  providers.push(provider);
  return provider;
}

afterEach(() => {
  for (const provider of providers) {
    provider.close();
  }
  providers = [];
});

describe("libraries", () => {
  it("round-trips create/read/update/delete", async () => {
    const storage = makeProvider();
    const library = await storage.createLibrary({ name: "Risk Assessments", description: "RA" });
    expect(library.id).toBeTruthy();
    expect(await storage.getLibrary(library.id)).toEqual(library);

    const renamed = await storage.updateLibrary({ ...library, name: "Assessments" });
    expect(renamed.name).toBe("Assessments");
    expect((await storage.getLibrary(library.id))?.name).toBe("Assessments");
    expect(Date.parse(renamed.updatedAt)).toBeGreaterThanOrEqual(Date.parse(library.updatedAt));

    await storage.deleteLibrary(library.id);
    expect(await storage.getLibrary(library.id)).toBeUndefined();
    expect(await storage.getAllLibraries()).toEqual([]);
  });

  it("deleting a library removes folders and memberships, snippets go to the backlog", async () => {
    const storage = makeProvider();
    const kept = await storage.createLibrary({ name: "Keep" });
    const doomed = await storage.createLibrary({ name: "Doomed" });
    const folder = await storage.createFolder({
      libraryId: doomed.id,
      parentId: null,
      name: "Findings",
      sortOrder: 0,
    });

    const shared = await storage.createSnippet({
      name: "Shared",
      content: "x",
      tagIds: [],
      memberships: [
        { libraryId: kept.id, folderId: null },
        { libraryId: doomed.id, folderId: folder.id },
      ],
    });
    const orphaned = await storage.createSnippet({
      name: "Orphaned",
      content: "y",
      tagIds: [],
      memberships: [{ libraryId: doomed.id, folderId: null }],
    });

    await storage.deleteLibrary(doomed.id);

    expect(await storage.getFoldersByLibrary(doomed.id)).toEqual([]);
    expect((await storage.getSnippet(shared.id))?.memberships).toEqual([
      { libraryId: kept.id, folderId: null },
    ]);
    // Never silently deleted: zero-membership snippets land in the backlog (§7.1).
    const backlog = await storage.getUnassignedSnippets();
    expect(backlog.map((s) => s.id)).toEqual([orphaned.id]);
  });
});

describe("folders", () => {
  it("round-trips and queries by library", async () => {
    const storage = makeProvider();
    const library = await storage.createLibrary({ name: "L" });
    const root = await storage.createFolder({
      libraryId: library.id,
      parentId: null,
      name: "Findings",
      sortOrder: 0,
    });
    const child = await storage.createFolder({
      libraryId: library.id,
      parentId: root.id,
      name: "Physical",
      sortOrder: 1,
    });

    expect(await storage.getFolder(child.id)).toEqual(child);
    const inLibrary = await storage.getFoldersByLibrary(library.id);
    expect(inLibrary.map((f) => f.id).sort()).toEqual([root.id, child.id].sort());

    const renamed = await storage.updateFolder({ ...child, name: "Physical Security" });
    expect((await storage.getFolder(child.id))?.name).toBe("Physical Security");
    expect(renamed.updatedAt).toBeTruthy();
  });

  it("deleting a folder moves child folders and snippet memberships to its parent", async () => {
    const storage = makeProvider();
    const library = await storage.createLibrary({ name: "L" });
    const grandparent = await storage.createFolder({
      libraryId: library.id,
      parentId: null,
      name: "Findings",
      sortOrder: 0,
    });
    const parent = await storage.createFolder({
      libraryId: library.id,
      parentId: grandparent.id,
      name: "Vulnerabilities",
      sortOrder: 0,
    });
    const child = await storage.createFolder({
      libraryId: library.id,
      parentId: parent.id,
      name: "Physical",
      sortOrder: 0,
    });
    const snippet = await storage.createSnippet({
      name: "Door fitment",
      content: "x",
      tagIds: [],
      memberships: [{ libraryId: library.id, folderId: parent.id }],
    });

    await storage.deleteFolder(parent.id);

    expect(await storage.getFolder(parent.id)).toBeUndefined();
    expect((await storage.getFolder(child.id))?.parentId).toBe(grandparent.id);
    expect((await storage.getSnippet(snippet.id))?.memberships).toEqual([
      { libraryId: library.id, folderId: grandparent.id },
    ]);
  });
});

describe("snippets", () => {
  it("round-trips create/read/update/delete", async () => {
    const storage = makeProvider();
    const library = await storage.createLibrary({ name: "L" });
    const snippet = await storage.createSnippet({
      name: "Camera coverage",
      content: "The [Building Name] has insufficient camera coverage.",
      tagIds: [],
      memberships: [{ libraryId: library.id, folderId: null }],
    });
    expect(snippet.history).toEqual([]);
    expect(await storage.getSnippet(snippet.id)).toEqual(snippet);

    const updated = await storage.updateSnippet({ ...snippet, content: "Updated content." });
    expect((await storage.getSnippet(snippet.id))?.content).toBe("Updated content.");
    expect(updated.updatedAt).toBeTruthy();

    await storage.deleteSnippet(snippet.id);
    expect(await storage.getSnippet(snippet.id)).toBeUndefined();
    expect(await storage.getAllSnippets()).toEqual([]);
  });

  it("queries by library membership and keeps the index in sync on update", async () => {
    const storage = makeProvider();
    const a = await storage.createLibrary({ name: "A" });
    const b = await storage.createLibrary({ name: "B" });
    const snippet = await storage.createSnippet({
      name: "S",
      content: "x",
      tagIds: [],
      memberships: [{ libraryId: a.id, folderId: null }],
    });

    expect((await storage.getSnippetsByLibrary(a.id)).map((s) => s.id)).toEqual([snippet.id]);
    expect(await storage.getSnippetsByLibrary(b.id)).toEqual([]);

    await storage.updateSnippet({
      ...snippet,
      memberships: [{ libraryId: b.id, folderId: null }],
    });
    expect(await storage.getSnippetsByLibrary(a.id)).toEqual([]);
    expect((await storage.getSnippetsByLibrary(b.id)).map((s) => s.id)).toEqual([snippet.id]);
  });

  it("maintains tag usage counts across create/update/delete", async () => {
    const storage = makeProvider();
    const physical = await storage.createTag("physical");
    const cctv = await storage.createTag("cctv");

    const snippet = await storage.createSnippet({
      name: "S",
      content: "x",
      tagIds: [physical.id],
      memberships: [],
    });
    expect((await storage.getTag(physical.id))?.usageCount).toBe(1);
    expect((await storage.getTag(cctv.id))?.usageCount).toBe(0);

    await storage.updateSnippet({ ...snippet, tagIds: [cctv.id] });
    expect((await storage.getTag(physical.id))?.usageCount).toBe(0);
    expect((await storage.getTag(cctv.id))?.usageCount).toBe(1);

    await storage.deleteSnippet(snippet.id);
    expect((await storage.getTag(cctv.id))?.usageCount).toBe(0);
  });
});

describe("tags", () => {
  it("round-trips and enforces case-insensitive name uniqueness", async () => {
    const storage = makeProvider();
    const tag = await storage.createTag("Physical");
    expect(await storage.getTag(tag.id)).toEqual(tag);
    expect((await storage.getTagByName("  pHySiCaL "))?.id).toBe(tag.id);

    await expect(storage.createTag("PHYSICAL")).rejects.toThrow();
    expect(await storage.getAllTags()).toHaveLength(1);

    const reused = await storage.getOrCreateTag("physical");
    expect(reused.id).toBe(tag.id);
    const fresh = await storage.getOrCreateTag("network");
    expect(fresh.id).not.toBe(tag.id);
    expect(await storage.getAllTags()).toHaveLength(2);
  });

  it("rejects empty names and renames via updateTag", async () => {
    const storage = makeProvider();
    await expect(storage.createTag("   ")).rejects.toThrow();
    const tag = await storage.createTag("locks");
    const renamed = await storage.updateTag({ ...tag, name: "door locks" });
    expect((await storage.getTagByName("Door Locks"))?.id).toBe(renamed.id);
  });

  it("deleting a tag removes it from snippets", async () => {
    const storage = makeProvider();
    const tag = await storage.createTag("physical");
    const other = await storage.createTag("cctv");
    const snippet = await storage.createSnippet({
      name: "S",
      content: "x",
      tagIds: [tag.id, other.id],
      memberships: [],
    });

    await storage.deleteTag(tag.id);
    expect(await storage.getTag(tag.id)).toBeUndefined();
    expect((await storage.getSnippet(snippet.id))?.tagIds).toEqual([other.id]);
  });
});

describe("prefs", () => {
  it("returns defaults, applies patches, and counts changes since export", async () => {
    const storage = makeProvider();
    expect(await storage.getPrefs()).toEqual({
      activeLibraryId: null,
      suppressNewTagConfirm: false,
      lastExportAt: null,
      changesSinceExport: 0,
      enableDocDragDrop: true,
    });

    const updated = await storage.updatePrefs({ suppressNewTagConfirm: true });
    expect(updated.suppressNewTagConfirm).toBe(true);
    expect((await storage.getPrefs()).suppressNewTagConfirm).toBe(true);

    const snippet = await storage.createSnippet({
      name: "S",
      content: "x",
      tagIds: [],
      memberships: [],
    });
    await storage.updateSnippet({ ...snippet, content: "y" });
    await storage.deleteSnippet(snippet.id);
    expect((await storage.getPrefs()).changesSinceExport).toBe(3);
  });
});

describe("exportAll", () => {
  it("exports every entity in the versioned bundle format", async () => {
    const storage = makeProvider();
    const library = await storage.createLibrary({ name: "L" });
    const folder = await storage.createFolder({
      libraryId: library.id,
      parentId: null,
      name: "F",
      sortOrder: 0,
    });
    const tag = await storage.createTag("physical");
    const snippet = await storage.createSnippet({
      name: "S",
      content: "x",
      tagIds: [tag.id],
      memberships: [{ libraryId: library.id, folderId: folder.id }],
    });

    const bundle = await storage.exportAll();
    expect(bundle.formatVersion).toBe(1);
    expect(bundle.appVersion).toBe("test");
    expect(Date.parse(bundle.exportedAt)).not.toBeNaN();
    expect(bundle.libraries).toEqual([library]);
    expect(bundle.folders).toEqual([folder]);
    expect(bundle.snippets.map((s) => s.id)).toEqual([snippet.id]);
    // Internal index fields must never leak out of the storage layer.
    expect(Object.keys(bundle.snippets[0]!)).not.toContain("membershipLibraryIds");
    expect(bundle.tags.map((t) => t.usageCount)).toEqual([1]);
    expect(Object.keys(bundle.tags[0]!)).not.toContain("nameLower");
  });

  it("importing an empty bundle is a no-op", async () => {
    const storage = makeProvider();
    const bundle = await storage.exportAll();
    expect(await storage.importBundle(bundle, "keep-both")).toEqual({
      snippetsAdded: 0,
      snippetsUpdated: 0,
      snippetsCopied: 0,
      tagsAdded: 0,
      librariesAdded: 0,
      foldersAdded: 0,
    });
  });
});
