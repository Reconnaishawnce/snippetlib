import { describe, expect, it } from "vitest";
import type { Snippet } from "../../src/models/entities";
import { buildInsertParts, buildInsertText, planInsert } from "../../src/taskpane/state/insertFlow";

const stamp = { createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" };

function snippet(id: string, content: string): Snippet {
  return { id, name: id, content, tagIds: [], memberships: [], history: [], ...stamp };
}

describe("planInsert", () => {
  it("collects missing placeholders across snippets, first-seen order, deduped", () => {
    const plan = planInsert(
      [snippet("a", "[Client] at [Building Name]"), snippet("b", "[building name] and [Date]")],
      { client: "Acme" }
    );
    expect(plan.missing.map((p) => p.display)).toEqual(["Building Name", "Date"]);
  });

  it("is empty when every placeholder has a value", () => {
    expect(planInsert([snippet("a", "[X]")], { x: "1" }).missing).toEqual([]);
  });
});

describe("buildInsertText", () => {
  it("resolves each snippet and joins in list order", () => {
    const text = buildInsertText(
      [snippet("a", "First: [Client]."), snippet("b", "Second: [Client] at [Site].")],
      { client: "Acme" }
    );
    expect(text).toBe("First: Acme.\nSecond: Acme at [Site].");
  });
});

describe("buildInsertParts", () => {
  const rich = snippet("Rich", "Bold statement.");
  const richWithXml = { ...rich, contentOoxml: "<pkg>rich</pkg>" };
  const placeholderRich = {
    ...snippet("Ph", "Visit [Site Name] today."),
    contentOoxml: "<pkg>ph</pkg>",
  };
  const plain = snippet("Plain", "Just text.");

  it("uses OOXML only when enabled, present, and placeholder-free", () => {
    expect(buildInsertParts([richWithXml], {}, true)).toEqual([{ ooxml: "<pkg>rich</pkg>" }]);
    expect(buildInsertParts([richWithXml], {}, false)).toEqual([{ text: "Bold statement." }]);
    expect(buildInsertParts([plain], {}, true)).toEqual([{ text: "Just text." }]);
  });

  it("placeholder snippets always take the resolved plain-text path", () => {
    const parts = buildInsertParts([placeholderRich], { "site name": "HQ" }, true);
    expect(parts).toEqual([{ text: "Visit HQ today." }]);
  });

  it("merges adjacent text parts with a newline, preserving order around OOXML", () => {
    const parts = buildInsertParts([plain, placeholderRich, richWithXml, plain], {}, true);
    expect(parts).toEqual([
      { text: "Just text.\nVisit [Site Name] today." },
      { ooxml: "<pkg>rich</pkg>" },
      { text: "Just text." },
    ]);
  });
});
