import { describe, expect, it } from "vitest";
import {
  documentPlaceholderValuesSchema,
  exportBundleSchema,
  queueStateSchema,
  snippetSchema,
} from "../../src/models/schemas";

const validSnippet = {
  id: "s1",
  name: "Camera coverage",
  content: "The [Building Name] lacks coverage.",
  tagIds: ["t1"],
  memberships: [{ libraryId: "l1", folderId: null }],
  history: [],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("snippetSchema", () => {
  it("accepts a valid snippet", () => {
    expect(snippetSchema.parse(validSnippet)).toEqual(validSnippet);
  });

  it("rejects more than 3 history revisions", () => {
    const revision = { content: "c", name: "n", savedAt: "2026-08-01T00:00:00.000Z" };
    const result = snippetSchema.safeParse({
      ...validSnippet,
      history: [revision, revision, revision, revision],
    });
    expect(result.success).toBe(false);
  });

  it("rejects malformed timestamps", () => {
    expect(snippetSchema.safeParse({ ...validSnippet, createdAt: "yesterday" }).success).toBe(
      false
    );
  });
});

describe("exportBundleSchema", () => {
  const bundle = {
    formatVersion: 1,
    appVersion: "0.1.0",
    exportedAt: "2026-08-01T00:00:00.000Z",
    libraries: [],
    folders: [],
    snippets: [validSnippet],
    tags: [],
  };

  it("accepts a valid bundle", () => {
    expect(exportBundleSchema.parse(bundle)).toEqual(bundle);
  });

  it("rejects unknown format versions — the formatVersion contract is real (§7.8)", () => {
    expect(exportBundleSchema.safeParse({ ...bundle, formatVersion: 2 }).success).toBe(false);
  });

  it("rejects non-object garbage", () => {
    expect(exportBundleSchema.safeParse("garbage").success).toBe(false);
    expect(exportBundleSchema.safeParse(null).success).toBe(false);
  });
});

describe("document-scoped schemas", () => {
  it("validates placeholder values as a string record", () => {
    expect(documentPlaceholderValuesSchema.parse({ "building name": "HQ Tower" })).toEqual({
      "building name": "HQ Tower",
    });
    expect(documentPlaceholderValuesSchema.safeParse({ k: 42 }).success).toBe(false);
  });

  it("validates queue state", () => {
    const queue = {
      sections: [
        {
          id: "sec1",
          name: "High",
          sortOrder: 0,
          items: [{ id: "i1", snippetId: "s1", sortOrder: 0, inserted: false }],
        },
      ],
    };
    expect(queueStateSchema.parse(queue)).toEqual(queue);
    expect(queueStateSchema.safeParse({ sections: [{ id: "x" }] }).success).toBe(false);
  });
});
