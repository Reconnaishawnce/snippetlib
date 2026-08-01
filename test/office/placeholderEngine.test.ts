import { describe, expect, it } from "vitest";
import {
  normalizeKey,
  parsePlaceholders,
  resolveContent,
  uniquePlaceholders,
} from "../../src/office/placeholderEngine";

describe("normalizeKey", () => {
  it("trims, collapses spaces, and lower-cases", () => {
    expect(normalizeKey("  Building   Name ")).toBe("building name");
    expect(normalizeKey("CLIENT")).toBe("client");
  });
});

describe("parsePlaceholders", () => {
  it("finds tokens with positions and display casing", () => {
    const parsed = parsePlaceholders("Report for [Client] at [Building Name].");
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      raw: "[Client]",
      display: "Client",
      key: "client",
      start: 11,
    });
    expect(parsed[1]).toMatchObject({ display: "Building Name", key: "building name" });
  });

  it("skips escaped tokens", () => {
    expect(parsePlaceholders("Literal \\[not one\\] but [Real]").map((p) => p.display)).toEqual([
      "Real",
    ]);
  });

  it("ignores empty, whitespace-only, over-long, and multi-line tokens", () => {
    expect(parsePlaceholders("[]")).toEqual([]);
    expect(parsePlaceholders("[   ]")).toEqual([]);
    expect(parsePlaceholders(`[${"x".repeat(61)}]`)).toEqual([]);
    expect(parsePlaceholders("[line\nbreak]")).toEqual([]);
  });

  it("does not treat nested or unbalanced brackets as placeholders", () => {
    // "[outer [inner]" — inner bracket restarts the token; only [inner] matches.
    expect(parsePlaceholders("[outer [inner]").map((p) => p.display)).toEqual(["inner"]);
    expect(parsePlaceholders("no brackets here")).toEqual([]);
    expect(parsePlaceholders("dangling [open")).toEqual([]);
  });

  it("handles unicode names", () => {
    const parsed = parsePlaceholders("Site: [Bâtiment Über 3] ✓");
    expect(parsed[0]?.display).toBe("Bâtiment Über 3");
    expect(parsed[0]?.key).toBe("bâtiment über 3");
  });
});

describe("uniquePlaceholders", () => {
  it("dedupes case-insensitively, keeping first-seen display", () => {
    const unique = uniquePlaceholders("[Building Name] then [building name] then [Client]");
    expect(unique.map((p) => p.display)).toEqual(["Building Name", "Client"]);
  });
});

describe("resolveContent", () => {
  it("substitutes known values by normalized key", () => {
    const result = resolveContent("The [Building Name] for [client].", {
      "building name": "HQ Tower",
      client: "Acme",
    });
    expect(result.text).toBe("The HQ Tower for Acme.");
    expect(result.unresolved).toEqual([]);
  });

  it("keeps unknown tokens verbatim and reports them once", () => {
    const result = resolveContent("[Client] visited [Client] at [Site].", { site: "HQ" });
    expect(result.text).toBe("[Client] visited [Client] at HQ.");
    expect(result.unresolved.map((p) => p.display)).toEqual(["Client"]);
  });

  it("substitutes empty-string values (explicit blanks are valid)", () => {
    expect(resolveContent("A[Gap]B", { gap: "" }).text).toBe("AB");
  });

  it("strips escapes on insert without resolving them", () => {
    const result = resolveContent("Keep \\[this\\] literal; fill [Slot].", { slot: "X" });
    expect(result.text).toBe("Keep [this] literal; fill X.");
    expect(result.unresolved).toEqual([]);
  });

  it("handles values that themselves look like placeholders without re-resolving", () => {
    const result = resolveContent("[A] and [B]", { a: "[B]", b: "bee" });
    expect(result.text).toBe("[B] and bee");
  });

  it("round-trips content with no placeholders", () => {
    expect(resolveContent("plain text 100% [—] unchanged", {}).text).toBe(
      "plain text 100% [—] unchanged"
    );
  });
});
