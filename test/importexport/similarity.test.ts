import { describe, expect, it } from "vitest";
import { SAVE_AS_NEW_THRESHOLD, diceSimilarity } from "../../src/importexport/similarity";

describe("diceSimilarity", () => {
  it("is 1 for identical text and 0 for disjoint text", () => {
    const text = "the camera coverage in the north lobby";
    expect(diceSimilarity(text, text)).toBe(1);
    expect(diceSimilarity("alpha beta gamma delta", "one two three four")).toBe(0);
  });

  it("is high for a small edit and low for a rewrite", () => {
    const original =
      "The camera coverage in the north lobby is insufficient and should be remediated promptly.";
    const smallEdit =
      "The camera coverage in the north lobby is inadequate and should be remediated promptly.";
    const rewrite = "Badge cloning attacks succeeded against the vestibule readers on all floors.";
    expect(diceSimilarity(original, smallEdit)).toBeGreaterThan(SAVE_AS_NEW_THRESHOLD);
    expect(diceSimilarity(original, rewrite)).toBeLessThan(SAVE_AS_NEW_THRESHOLD);
  });

  it("ignores case and extra whitespace", () => {
    expect(diceSimilarity("Alpha  Beta\nGamma", "alpha beta gamma")).toBe(1);
  });

  it("handles single-word and empty inputs", () => {
    expect(diceSimilarity("camera", "camera")).toBe(1);
    expect(diceSimilarity("camera", "door")).toBe(0);
    expect(diceSimilarity("", "")).toBe(1);
    expect(diceSimilarity("", "something")).toBe(0);
  });
});
