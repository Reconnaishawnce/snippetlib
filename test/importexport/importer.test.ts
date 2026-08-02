import { describe, expect, it } from "vitest";
import { parseBundle, planImport } from "../../src/importexport/importer";

const validBundle = {
  formatVersion: 1,
  appVersion: "0.1.0",
  exportedAt: "2026-08-02T10:00:00.000Z",
  libraries: [
    {
      id: "lib1",
      name: "Risk",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
  ],
  folders: [],
  snippets: [
    {
      id: "s1",
      name: "One",
      content: "body",
      tagIds: ["t1"],
      memberships: [{ libraryId: "lib1", folderId: null }],
      history: [],
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
  ],
  tags: [
    {
      id: "t1",
      name: "physical",
      usageCount: 1,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
  ],
};

describe("parseBundle", () => {
  it("accepts a valid bundle", () => {
    const result = parseBundle(JSON.stringify(validBundle));
    expect(result.ok).toBe(true);
  });

  it("rejects non-JSON with a readable message", () => {
    const result = parseBundle("not json {");
    expect(result).toEqual({
      ok: false,
      error: "That file isn't valid JSON. Choose a ReportSnips export file.",
    });
  });

  it("rejects wrong shapes and future format versions readably", () => {
    const wrongShape = parseBundle(JSON.stringify({ hello: "world" }));
    expect(wrongShape.ok).toBe(false);
    if (!wrongShape.ok) {
      expect(wrongShape.error).toContain("doesn't look like a ReportSnips export");
      expect(wrongShape.error).not.toMatch(/at Object|stack/i);
    }
    const future = parseBundle(JSON.stringify({ ...validBundle, formatVersion: 99 }));
    expect(future.ok).toBe(false);
  });
});

describe("planImport", () => {
  it("counts new vs conflicting snippets and new tags/libraries", () => {
    const preview = planImport(validBundle as never, {
      snippetIds: new Set(["s1"]),
      tagNamesLower: new Set(["physical"]),
      libraryNamesLower: new Set(),
    });
    expect(preview).toEqual({ newSnippets: 0, conflicts: 1, newTags: 0, newLibraries: 1 });

    const fresh = planImport(validBundle as never, {
      snippetIds: new Set(),
      tagNamesLower: new Set(),
      libraryNamesLower: new Set(["risk"]),
    });
    expect(fresh).toEqual({ newSnippets: 1, conflicts: 0, newTags: 1, newLibraries: 0 });
  });
});
