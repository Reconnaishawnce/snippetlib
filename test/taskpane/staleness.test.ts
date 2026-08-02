import { describe, expect, it } from "vitest";
import type { Snippet } from "../../src/models/entities";
import { findStaleSnippets } from "../../src/taskpane/state/staleness";

const NOW = new Date("2026-08-02T00:00:00.000Z");
const PREFS = { staleEditedDays: 180, staleUnusedDays: 90 };

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function snip(partial: Partial<Snippet> & { name: string }): Snippet {
  return {
    id: partial.name,
    content: "",
    tagIds: [],
    memberships: [],
    history: [],
    createdAt: daysAgo(30),
    updatedAt: daysAgo(30),
    ...partial,
  };
}

describe("findStaleSnippets", () => {
  it("flags snippets not edited in staleEditedDays", () => {
    const stale = findStaleSnippets(
      [snip({ name: "old", updatedAt: daysAgo(200), lastUsedAt: daysAgo(1) })],
      PREFS,
      NOW
    );
    expect(stale).toHaveLength(1);
    expect(stale[0]?.reasons).toEqual(["not edited in 200 days"]);
  });

  it("flags snippets not used in staleUnusedDays — 'never used' counts from creation", () => {
    const stale = findStaleSnippets(
      [snip({ name: "unused", createdAt: daysAgo(100), updatedAt: daysAgo(10) })],
      PREFS,
      NOW
    );
    expect(stale[0]?.reasons).toEqual(["never used"]);
  });

  it("keeps fresh snippets off the list", () => {
    const fresh = snip({ name: "fresh", updatedAt: daysAgo(5), lastUsedAt: daysAgo(5) });
    expect(findStaleSnippets([fresh], PREFS, NOW)).toHaveLength(0);
  });

  it("'Looks fine' (lastReviewedAt) resets both clocks", () => {
    const reviewed = snip({
      name: "reviewed",
      updatedAt: daysAgo(300),
      createdAt: daysAgo(300),
      lastReviewedAt: daysAgo(3),
    });
    expect(findStaleSnippets([reviewed], PREFS, NOW)).toHaveLength(0);
  });

  it("reports both reasons when both clocks expired", () => {
    const stale = findStaleSnippets(
      [snip({ name: "both", createdAt: daysAgo(400), updatedAt: daysAgo(400) })],
      PREFS,
      NOW
    );
    expect(stale[0]?.reasons).toEqual(["not edited in 400 days", "never used"]);
  });
});
