import { describe, expect, it } from "vitest";
import { highlightSegments, makeExcerpt } from "../../src/search/highlight";

describe("highlightSegments", () => {
  it("marks case-insensitive prefix matches at word starts", () => {
    const segments = highlightSegments("Camera coverage for the camcorder", ["cam"]);
    expect(segments).toEqual([
      { text: "Cam", hit: true },
      { text: "era coverage for the ", hit: false },
      { text: "cam", hit: true },
      { text: "corder", hit: false },
    ]);
  });

  it("does not mark mid-word occurrences", () => {
    const segments = highlightSegments("decamp", ["cam"]);
    expect(segments).toEqual([{ text: "decamp", hit: false }]);
  });

  it("prefers the longest matching term", () => {
    const segments = highlightSegments("camera", ["cam", "camera"]);
    expect(segments).toEqual([{ text: "camera", hit: true }]);
  });

  it("handles empty inputs", () => {
    expect(highlightSegments("", ["x"])).toEqual([]);
    expect(highlightSegments("text", [])).toEqual([{ text: "text", hit: false }]);
  });
});

describe("makeExcerpt", () => {
  const long = `${"padding words ".repeat(30)}the camera evidence appears here ${"trailing words ".repeat(30)}`;

  it("windows around the first match with ellipses", () => {
    const excerpt = makeExcerpt(long, ["camera"], 80);
    expect(excerpt).toContain("camera");
    expect(excerpt.startsWith("…")).toBe(true);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(84);
  });

  it("returns short content unchanged and collapses whitespace", () => {
    expect(makeExcerpt("short  \n content", ["x"])).toBe("short content");
  });

  it("falls back to the head when nothing matches", () => {
    const excerpt = makeExcerpt(long, ["zebra"], 50);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt.startsWith("padding")).toBe(true);
  });
});
