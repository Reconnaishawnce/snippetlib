import { describe, expect, it } from "vitest";
import type { Snippet } from "../../src/models/entities";
import { sortSnippets } from "../../src/taskpane/state/sortSnippets";

function snip(partial: Partial<Snippet> & { name: string }): Snippet {
  return {
    id: partial.name,
    content: "",
    tagIds: [],
    memberships: [],
    history: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

const a = snip({ name: "Alpha", createdAt: "2026-01-03T00:00:00.000Z" });
const b = snip({
  name: "Bravo",
  useCount: 5,
  lastUsedAt: "2026-02-01T00:00:00.000Z",
  createdAt: "2026-01-02T00:00:00.000Z",
});
const c = snip({
  name: "Charlie",
  useCount: 2,
  lastUsedAt: "2026-03-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
});

describe("sortSnippets", () => {
  it("sorts by name by default", () => {
    expect(sortSnippets([c, b, a], "name").map((s) => s.name)).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
    ]);
  });

  it("recent: latest lastUsedAt first, never-used last", () => {
    expect(sortSnippets([a, b, c], "recent").map((s) => s.name)).toEqual([
      "Charlie",
      "Bravo",
      "Alpha",
    ]);
  });

  it("most-used: highest useCount first, never-used last, name tiebreak", () => {
    expect(sortSnippets([a, b, c], "most-used").map((s) => s.name)).toEqual([
      "Bravo",
      "Charlie",
      "Alpha",
    ]);
  });

  it("newest: latest createdAt first", () => {
    expect(sortSnippets([b, c, a], "newest").map((s) => s.name)).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [c, a, b];
    sortSnippets(input, "name");
    expect(input.map((s) => s.name)).toEqual(["Charlie", "Alpha", "Bravo"]);
  });
});
