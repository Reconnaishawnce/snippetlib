import { describe, expect, it } from "vitest";
import type { QueueState, Snippet } from "../../src/models/entities";
import { buildReportPlan, sectionMarker } from "../../src/taskpane/state/reportPlan";

function snip(id: string, name: string, content: string): Snippet {
  return {
    id,
    name,
    content,
    tagIds: [],
    memberships: [],
    history: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const SNIPPETS = new Map(
  [
    snip("s1", "Broken door", "The [Building Name] rear door does not latch."),
    snip("s2", "No cameras", "No CCTV coverage at the loading dock."),
    snip("s3", "Lighting", "Perimeter lighting is inadequate."),
  ].map((s) => [s.id, s])
);

const QUEUE: QueueState = {
  sections: [
    {
      id: "sec-high",
      name: "HIGH Vulnerabilities",
      sortOrder: 0,
      items: [
        { id: "i2", snippetId: "s2", sortOrder: 1, inserted: false },
        { id: "i1", snippetId: "s1", sortOrder: 0, inserted: false },
        { id: "i-gone", snippetId: "deleted", sortOrder: 2, inserted: false },
      ],
    },
    {
      id: "sec-low",
      name: "LOW Vulnerabilities",
      sortOrder: 1,
      layout: "paragraphs",
      items: [{ id: "i3", snippetId: "s3", sortOrder: 0, inserted: true }],
    },
    { id: "sec-empty", name: "Empty", sortOrder: 2, items: [] },
  ],
};

describe("sectionMarker", () => {
  it("wraps the trimmed name in double braces", () => {
    expect(sectionMarker("  HIGH Vulnerabilities ")).toBe("{{HIGH Vulnerabilities}}");
  });
});

describe("buildReportPlan", () => {
  it("plans sections in order with rows sorted, layouts defaulted, empties dropped", () => {
    const plan = buildReportPlan(QUEUE, SNIPPETS, {});
    expect(plan.sections.map((s) => s.name)).toEqual([
      "HIGH Vulnerabilities",
      "LOW Vulnerabilities",
    ]);
    const high = plan.sections[0]!;
    expect(high.marker).toBe("{{HIGH Vulnerabilities}}");
    expect(high.layout).toBe("table"); // default
    expect(high.rows.map((r) => r.name)).toEqual(["Broken door", "No cameras"]);
    expect(high.missingSnippets).toBe(1);
    expect(plan.sections[1]!.layout).toBe("paragraphs");
  });

  it("collects unfilled placeholders across the whole report, first-seen order", () => {
    const plan = buildReportPlan(QUEUE, SNIPPETS, {});
    expect(plan.missing.map((m) => m.display)).toEqual(["Building Name"]);
    const filled = buildReportPlan(QUEUE, SNIPPETS, { "building name": "HQ Tower" });
    expect(filled.missing).toEqual([]);
    expect(filled.sections[0]!.rows[0]!.text).toContain("HQ Tower");
  });

  it("keeps unknown tokens literal and lists every written item and snippet id", () => {
    const plan = buildReportPlan(QUEUE, SNIPPETS, {});
    expect(plan.sections[0]!.rows[0]!.text).toContain("[Building Name]");
    expect(plan.itemIds).toEqual(["i1", "i2", "i3"]);
    expect(plan.snippetIds).toEqual(["s1", "s2", "s3"]);
  });
});
