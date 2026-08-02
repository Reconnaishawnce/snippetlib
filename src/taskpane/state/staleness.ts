/** Stale-snippet detection (opt-in freshness review). Pure and unit-tested. */
import type { AppPrefs, Snippet } from "../../models/entities";

export interface StaleResult {
  snippet: Snippet;
  /** Human-readable reasons, e.g. "not edited in 200 days", "never used". */
  reasons: string[];
}

type StalePrefs = Pick<AppPrefs, "staleEditedDays" | "staleUnusedDays">;

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(iso: string, now: Date): number {
  return Math.floor((now.getTime() - Date.parse(iso)) / DAY_MS);
}

function later(a: string, b: string | undefined): string {
  return b !== undefined && b > a ? b : a;
}

/**
 * A snippet is stale when it hasn't been EDITED in `staleEditedDays` OR hasn't
 * been USED in `staleUnusedDays`. "Looks fine" (lastReviewedAt) resets both
 * clocks; a snippet never inserted counts as unused since creation.
 */
export function findStaleSnippets(
  snippets: Snippet[],
  prefs: StalePrefs,
  now: Date
): StaleResult[] {
  const results: StaleResult[] = [];
  for (const snippet of snippets) {
    const reasons: string[] = [];
    const editedAt = later(snippet.updatedAt, snippet.lastReviewedAt);
    const editedDays = daysSince(editedAt, now);
    if (editedDays > prefs.staleEditedDays) {
      reasons.push(`not edited in ${editedDays} days`);
    }
    const usedAt = later(snippet.lastUsedAt ?? snippet.createdAt, snippet.lastReviewedAt);
    const usedDays = daysSince(usedAt, now);
    if (usedDays > prefs.staleUnusedDays) {
      reasons.push(
        snippet.lastUsedAt === undefined ? "never used" : `not used in ${usedDays} days`
      );
    }
    if (reasons.length > 0) {
      results.push({ snippet, reasons });
    }
  }
  // Stalest first: by the age of their most recent qualifying activity.
  return results.sort((a, b) => a.snippet.updatedAt.localeCompare(b.snippet.updatedAt));
}
