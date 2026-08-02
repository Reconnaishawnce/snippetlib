/** Browse-list sorting (frecency). Pure and unit-tested. */
import type { BrowseSort, Snippet } from "../../models/entities";

export const BROWSE_SORT_LABELS: Record<BrowseSort, string> = {
  name: "Name (A–Z)",
  recent: "Recently used",
  "most-used": "Most used",
  newest: "Newest",
};

/** Returns a new array sorted per `sort`; never-used snippets rank last, name breaks ties. */
export function sortSnippets(snippets: Snippet[], sort: BrowseSort): Snippet[] {
  const byName = (a: Snippet, b: Snippet) => a.name.localeCompare(b.name);
  const list = [...snippets];
  switch (sort) {
    case "recent":
      return list.sort(
        (a, b) => (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "") || byName(a, b)
      );
    case "most-used":
      return list.sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0) || byName(a, b));
    case "newest":
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || byName(a, b));
    default:
      return list.sort(byName);
  }
}
