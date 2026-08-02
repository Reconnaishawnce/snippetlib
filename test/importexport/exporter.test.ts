import { describe, expect, it } from "vitest";
import type { Folder, Library, Snippet, Tag } from "../../src/models/entities";
import { buildExportBundle, exportFileName } from "../../src/importexport/exporter";

const stamp = { createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" };

const libraries: Library[] = [
  { id: "libA", name: "Risk", ...stamp },
  { id: "libB", name: "Compliance", ...stamp },
];
const folders: Folder[] = [
  { id: "f1", libraryId: "libA", parentId: null, name: "Findings", sortOrder: 0, ...stamp },
  { id: "f2", libraryId: "libA", parentId: "f1", name: "Physical", sortOrder: 0, ...stamp },
  { id: "f3", libraryId: "libB", parentId: null, name: "Policies", sortOrder: 0, ...stamp },
];
const tags: Tag[] = [
  { id: "t1", name: "physical", usageCount: 1, ...stamp },
  { id: "t2", name: "unused", usageCount: 0, ...stamp },
];
const snippets: Snippet[] = [
  {
    id: "s1",
    name: "In subfolder",
    content: "x",
    tagIds: ["t1"],
    memberships: [{ libraryId: "libA", folderId: "f2" }],
    history: [{ name: "old", content: "y", savedAt: stamp.createdAt }],
    ...stamp,
  },
  {
    id: "s2",
    name: "In other library",
    content: "z",
    tagIds: [],
    memberships: [{ libraryId: "libB", folderId: null }],
    history: [],
    ...stamp,
  },
];
const source = { libraries, folders, snippets, tags };

describe("buildExportBundle", () => {
  it("full export includes everything referenced, with history", () => {
    const bundle = buildExportBundle(source, {}, "0.1.0", "2026-08-02T10:00:00.000Z");
    expect(bundle.formatVersion).toBe(1);
    expect(bundle.snippets).toHaveLength(2);
    expect(bundle.snippets[0]!.history).toHaveLength(1);
    // Reference closure: unused tag stays home.
    expect(bundle.tags.map((t) => t.id)).toEqual(["t1"]);
    expect(bundle.libraries.map((l) => l.id).sort()).toEqual(["libA", "libB"]);
  });

  it("library selection narrows snippets and pulls full folder chains", () => {
    const bundle = buildExportBundle(
      source,
      { libraryIds: ["libA"] },
      "0.1.0",
      "2026-08-02T10:00:00.000Z"
    );
    expect(bundle.snippets.map((s) => s.id)).toEqual(["s1"]);
    // f2's ancestor f1 must come along so the path can be rebuilt.
    expect(bundle.folders.map((f) => f.id).sort()).toEqual(["f1", "f2"]);
    expect(bundle.libraries.map((l) => l.id)).toEqual(["libA"]);
    expect(bundle.tags.map((t) => t.id)).toEqual(["t1"]);
  });

  it("explicit snippet selection wins", () => {
    const bundle = buildExportBundle(
      source,
      { snippetIds: ["s2"], libraryIds: ["libA"] },
      "0.1.0",
      "2026-08-02T10:00:00.000Z"
    );
    expect(bundle.snippets.map((s) => s.id)).toEqual(["s2"]);
    expect(bundle.folders).toEqual([]);
    expect(bundle.libraries.map((l) => l.id)).toEqual(["libB"]);
  });
});

describe("exportFileName", () => {
  it("stamps the date", () => {
    expect(exportFileName("2026-08-02T10:00:00.000Z")).toBe("reportsnips-export-20260802.json");
  });
});
