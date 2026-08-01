import { describe, expect, it } from "vitest";
import type { Folder, Snippet } from "../../src/models/entities";
import {
  buildFolderTree,
  folderDepth,
  folderPath,
  isSelfOrDescendant,
  recursiveSnippetCounts,
} from "../../src/taskpane/state/folderTreeUtils";

const stamp = { createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" };

function folder(id: string, parentId: string | null, name = id, sortOrder = 0): Folder {
  return { id, libraryId: "lib", parentId, name, sortOrder, ...stamp };
}

function snippet(id: string, folderId: string | null): Snippet {
  return {
    id,
    name: id,
    content: "",
    tagIds: [],
    memberships: [{ libraryId: "lib", folderId }],
    history: [],
    ...stamp,
  };
}

const folders = [
  folder("findings", null, "Findings", 0),
  folder("appendix", null, "Appendix", 1),
  folder("vulns", "findings", "Vulnerabilities"),
  folder("physical", "vulns", "Physical"),
];

describe("buildFolderTree", () => {
  it("nests children and sorts siblings by sortOrder then name", () => {
    const tree = buildFolderTree(folders);
    expect(tree.map((n) => n.folder.id)).toEqual(["findings", "appendix"]);
    expect(tree[0]!.children[0]!.folder.id).toBe("vulns");
    expect(tree[0]!.children[0]!.children[0]!.folder.id).toBe("physical");
  });
});

describe("isSelfOrDescendant", () => {
  it("detects self, descendants, and unrelated folders", () => {
    expect(isSelfOrDescendant(folders, "findings", "findings")).toBe(true);
    expect(isSelfOrDescendant(folders, "findings", "physical")).toBe(true);
    expect(isSelfOrDescendant(folders, "physical", "findings")).toBe(false);
    expect(isSelfOrDescendant(folders, "findings", "appendix")).toBe(false);
    expect(isSelfOrDescendant(folders, "findings", null)).toBe(false);
  });
});

describe("folderDepth", () => {
  it("counts levels from the root", () => {
    expect(folderDepth(folders, null)).toBe(0);
    expect(folderDepth(folders, "findings")).toBe(1);
    expect(folderDepth(folders, "physical")).toBe(3);
  });
});

describe("recursiveSnippetCounts", () => {
  it("counts snippets in a folder and all its ancestors", () => {
    const counts = recursiveSnippetCounts(
      folders,
      [snippet("a", "physical"), snippet("b", "vulns"), snippet("c", null)],
      "lib"
    );
    expect(counts.get("physical")).toBe(1);
    expect(counts.get("vulns")).toBe(2);
    expect(counts.get("findings")).toBe(2);
    expect(counts.get("appendix")).toBeUndefined();
  });

  it("ignores memberships from other libraries", () => {
    const other: Snippet = {
      ...snippet("x", "physical"),
      memberships: [{ libraryId: "other", folderId: "physical" }],
    };
    const counts = recursiveSnippetCounts(folders, [other], "lib");
    expect(counts.size).toBe(0);
  });
});

describe("folderPath", () => {
  it("returns names from root to the folder", () => {
    expect(folderPath(folders, "physical")).toEqual(["Findings", "Vulnerabilities", "Physical"]);
    expect(folderPath(folders, null)).toEqual([]);
  });
});
