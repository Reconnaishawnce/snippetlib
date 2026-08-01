/**
 * Insert-time placeholder resolution (§7.6). Pure planning logic; the actual
 * Word call goes through documentIO.insertText.
 */
import type { Snippet } from "../../models/entities";
import {
  resolveContent,
  uniquePlaceholders,
  type ParsedPlaceholder,
} from "../../office/placeholderEngine";

export interface InsertPlan {
  /** Placeholders with no stored value, first-seen order across all snippets. */
  missing: ParsedPlaceholder[];
}

/** Placeholders that would need prompting before inserting these snippets. */
export function planInsert(snippets: Snippet[], values: Record<string, string>): InsertPlan {
  const missing: ParsedPlaceholder[] = [];
  const seen = new Set<string>();
  for (const snippet of snippets) {
    for (const placeholder of uniquePlaceholders(snippet.content)) {
      if (values[placeholder.key] === undefined && !seen.has(placeholder.key)) {
        seen.add(placeholder.key);
        missing.push(placeholder);
      }
    }
  }
  return { missing };
}

/**
 * The final text for insertion: each snippet resolved with the (possibly
 * just-augmented) values, joined in list order. Unknown placeholders stay as
 * literal tokens for manual handling (§7.6).
 */
export function buildInsertText(snippets: Snippet[], values: Record<string, string>): string {
  return snippets.map((snippet) => resolveContent(snippet.content, values).text).join("\n");
}
