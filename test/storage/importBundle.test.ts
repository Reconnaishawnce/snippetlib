import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";
import { IndexedDbProvider } from "../../src/storage/IndexedDbProvider";
import { buildExportBundle } from "../../src/importexport/exporter";

let providers: IndexedDbProvider[] = [];

function makeProvider(): IndexedDbProvider {
  const provider = new IndexedDbProvider({
    databaseName: `import-test-${Math.random().toString(36).slice(2)}`,
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

/** Machine A: a library with nested folders, tags, and two snippets. */
async function seedMachineA() {
  const a = makeProvider();
  const library = await a.createLibrary({ name: "Risk" });
  const findings = await a.createFolder({
    libraryId: library.id,
    parentId: null,
    name: "Findings",
    sortOrder: 0,
  });
  const physical = await a.createFolder({
    libraryId: library.id,
    parentId: findings.id,
    name: "Physical",
    sortOrder: 0,
  });
  const tag = await a.createTag("physical");
  const one = await a.createSnippet({
    name: "Door fitment",
    content: "The [Building Name] door allows shimming.",
    tagIds: [tag.id],
    memberships: [{ libraryId: library.id, folderId: physical.id }],
  });
  const two = await a.createSnippet({
    name: "Camera coverage",
    content: "Lobby coverage insufficient.",
    tagIds: [tag.id],
    memberships: [{ libraryId: library.id, folderId: null }],
  });
  return { a, library, physical, tag, one, two };
}

describe("importBundle (machine A → machine B)", () => {
  it("imports everything fresh: libraries, folder paths, tags, snippets", async () => {
    const { a } = await seedMachineA();
    const bundle = await a.exportAll();

    const b = makeProvider();
    const result = await b.importBundle(bundle, "keep-both");
    expect(result).toMatchObject({
      snippetsAdded: 2,
      snippetsUpdated: 0,
      snippetsCopied: 0,
      tagsAdded: 1,
      librariesAdded: 1,
      foldersAdded: 2,
    });

    const libraries = await b.getAllLibraries();
    expect(libraries.map((l) => l.name)).toEqual(["Risk"]);
    const folders = await b.getFoldersByLibrary(libraries[0]!.id);
    expect(folders.map((f) => f.name).sort()).toEqual(["Findings", "Physical"]);
    const physical = folders.find((f) => f.name === "Physical")!;
    expect(folders.find((f) => f.id === physical.parentId)?.name).toBe("Findings");

    const snippets = await b.getAllSnippets();
    expect(snippets).toHaveLength(2);
    const door = snippets.find((s) => s.name === "Door fitment")!;
    expect(door.memberships[0]!.folderId).toBe(physical.id);
    const tag = (await b.getAllTags())[0]!;
    expect(tag.name).toBe("physical");
    expect(tag.usageCount).toBe(2);
    expect(door.tagIds).toEqual([tag.id]);
  });

  it("re-importing is conflict-free under keep-mine and duplicates under keep-both", async () => {
    const { a, one } = await seedMachineA();
    const bundle = await a.exportAll();

    const kept = await a.importBundle(bundle, "keep-mine");
    expect(kept).toMatchObject({ snippetsAdded: 0, snippetsUpdated: 0, snippetsCopied: 0 });
    expect(await a.getAllSnippets()).toHaveLength(2);

    const copied = await a.importBundle(bundle, "keep-both");
    expect(copied).toMatchObject({
      snippetsCopied: 2,
      librariesAdded: 0,
      foldersAdded: 0,
      tagsAdded: 0,
    });
    const all = await a.getAllSnippets();
    expect(all).toHaveLength(4);
    const copies = all.filter((s) => s.name.endsWith(" (imported)"));
    expect(copies).toHaveLength(2);
    expect(copies.every((s) => s.id !== one.id)).toBe(true);
  });

  it("take-theirs overwrites content and history for id matches", async () => {
    const { a, one } = await seedMachineA();
    const bundle = await a.exportAll();
    // Local edit after the export.
    await a.updateSnippet({ ...one, content: "locally changed" });

    const result = await a.importBundle(bundle, "take-theirs");
    expect(result).toMatchObject({ snippetsUpdated: 2, snippetsAdded: 0 });
    expect((await a.getSnippet(one.id))?.content).toBe("The [Building Name] door allows shimming.");
  });

  it("selection bundles reconstruct only what they reference", async () => {
    const { a, one } = await seedMachineA();
    const full = await a.exportAll();
    const bundle = buildExportBundle(
      {
        libraries: full.libraries,
        folders: full.folders,
        snippets: full.snippets,
        tags: full.tags,
      },
      { snippetIds: [one.id] },
      "test",
      "2026-08-02T10:00:00.000Z"
    );

    const b = makeProvider();
    const result = await b.importBundle(bundle, "keep-both");
    expect(result).toMatchObject({ snippetsAdded: 1, foldersAdded: 2, librariesAdded: 1 });
    expect((await b.getAllSnippets()).map((s) => s.name)).toEqual(["Door fitment"]);
  });
});
