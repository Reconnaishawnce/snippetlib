import { describe, expect, it } from "vitest";
import { deriveDefaultName, detectPlaceholders } from "../../src/taskpane/state/snippetName";

describe("deriveDefaultName", () => {
  it("takes the first 8 words and adds an ellipsis when truncated", () => {
    expect(
      deriveDefaultName("The camera coverage in the north lobby is insufficient for monitoring")
    ).toBe("The camera coverage in the north lobby is…");
  });

  it("keeps short selections as-is", () => {
    expect(deriveDefaultName("  Door fitment issue  ")).toBe("Door fitment issue");
  });

  it("collapses arbitrary whitespace", () => {
    expect(deriveDefaultName("one\n  two\tthree")).toBe("one two three");
  });
});

describe("detectPlaceholders", () => {
  it("finds bracketed placeholders, deduplicating case-insensitively", () => {
    expect(
      detectPlaceholders("The [Building Name] on [Client] site. Also [building name] again.")
    ).toEqual(["Building Name", "Client"]);
  });

  it("ignores escaped brackets", () => {
    expect(detectPlaceholders("Literal \\[not a placeholder\\] but [Real One]")).toEqual([
      "Real One",
    ]);
  });

  it("ignores empty and over-long tokens and multi-line brackets", () => {
    expect(detectPlaceholders("[]")).toEqual([]);
    expect(detectPlaceholders(`[${"x".repeat(61)}]`)).toEqual([]);
    expect(detectPlaceholders("[line\nbreak]")).toEqual([]);
  });
});
