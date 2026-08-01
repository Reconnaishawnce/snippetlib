import { describe, expect, it } from "vitest";
import { SnippetSearchIndex, type SearchDoc } from "../../src/search/searchIndex";

function doc(
  id: string,
  name: string,
  content: string,
  tagNames: string[] = [],
  libraryIds: string[] = ["lib1"]
): SearchDoc {
  return { id, name, content, tagNames, libraryIds };
}

describe("SnippetSearchIndex", () => {
  it("matches name, tag, and content with name boosted highest", () => {
    const index = new SnippetSearchIndex();
    index.build([
      doc("by-name", "Camera coverage", "irrelevant body"),
      doc("by-tag", "Something else", "irrelevant body", ["camera"]),
      doc("by-content", "Unrelated title", "the camera in the lobby"),
      doc("no-match", "Door fitment", "hinges and locks"),
    ]);
    const hits = index.search("camera");
    expect(hits.map((h) => h.id)).toContain("by-name");
    expect(hits.map((h) => h.id)).toContain("by-tag");
    expect(hits.map((h) => h.id)).toContain("by-content");
    expect(hits.map((h) => h.id)).not.toContain("no-match");
    expect(hits[0]!.id).toBe("by-name"); // boost 3 > 2 > 1
  });

  it("supports prefix and fuzzy matching", () => {
    const index = new SnippetSearchIndex();
    index.build([doc("a", "Surveillance findings", "perimeter fencing assessment")]);
    expect(index.search("surveil").map((h) => h.id)).toEqual(["a"]); // prefix
    expect(index.search("surveilance").map((h) => h.id)).toEqual(["a"]); // fuzzy typo
  });

  it("ANDs multiple query terms", () => {
    const index = new SnippetSearchIndex();
    index.build([
      doc("both", "Camera coverage", "north lobby"),
      doc("one", "Camera placement", "south stairwell"),
    ]);
    expect(index.search("camera lobby").map((h) => h.id)).toEqual(["both"]);
  });

  it("filters by library membership", () => {
    const index = new SnippetSearchIndex();
    index.build([
      doc("in-a", "Camera one", "", [], ["libA"]),
      doc("in-b", "Camera two", "", [], ["libB"]),
      doc("in-both", "Camera three", "", [], ["libA", "libB"]),
    ]);
    expect(
      index
        .search("camera", { libraryId: "libA" })
        .map((h) => h.id)
        .sort()
    ).toEqual(["in-a", "in-both"]);
    expect(index.search("camera").map((h) => h.id)).toHaveLength(3);
  });

  it("updates incrementally: upsert changes results, remove drops them", () => {
    const index = new SnippetSearchIndex();
    index.build([doc("s1", "Old name", "old content")]);
    expect(index.search("old").map((h) => h.id)).toEqual(["s1"]);

    index.upsert(doc("s1", "New name", "fresh content"));
    expect(index.search("old")).toEqual([]);
    expect(index.search("fresh").map((h) => h.id)).toEqual(["s1"]);

    index.upsert(doc("s2", "Another fresh doc", ""));
    expect(index.search("fresh")).toHaveLength(2);

    index.remove("s1");
    expect(index.search("fresh").map((h) => h.id)).toEqual(["s2"]);
    expect(index.size).toBe(1);
  });

  it("returns nothing for empty queries", () => {
    const index = new SnippetSearchIndex();
    index.build([doc("a", "Camera", "")]);
    expect(index.search("")).toEqual([]);
    expect(index.search("   ")).toEqual([]);
  });

  it("stays instant over 200 snippets (M3 exit criterion)", () => {
    const index = new SnippetSearchIndex();
    const docs: SearchDoc[] = [];
    for (let i = 0; i < 200; i++) {
      docs.push(
        doc(
          `s${i}`,
          `Finding ${i}: ${i % 3 === 0 ? "camera coverage" : i % 3 === 1 ? "door fitment" : "badge cloning"} issue`,
          `Detailed narrative for finding number ${i} covering ${
            i % 2 === 0 ? "perimeter and lobby surveillance" : "access control vestibules"
          } with remediation guidance.`,
          i % 4 === 0 ? ["physical", "cctv"] : ["access-control"],
          [`lib${i % 5}`]
        )
      );
    }
    index.build(docs);
    const started = performance.now();
    const hits = index.search("camera coverage");
    const elapsed = performance.now() - started;
    expect(hits.length).toBeGreaterThan(0);
    // Generous bound: "instant" in UI terms; typical runs are <5ms.
    expect(elapsed).toBeLessThan(100);
  });
});
