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

/** One insert unit: resolved text, or verbatim OOXML for rich snippets. */
export type PlannedPart = { text: string } | { ooxml: string };

/**
 * The parts to insert, in order (rich-text feature). A snippet inserts as
 * OOXML only when the feature is on, it has captured OOXML, AND it contains
 * no placeholders — tokens can split across formatting runs inside XML, so
 * placeholder snippets always take the resolved plain-text path. Adjacent
 * text parts merge with a newline (matching classic multi-insert).
 */
export function buildInsertParts(
  snippets: Snippet[],
  values: Record<string, string>,
  richEnabled: boolean
): PlannedPart[] {
  const parts: PlannedPart[] = [];
  for (const snippet of snippets) {
    const rich =
      richEnabled &&
      snippet.contentOoxml !== undefined &&
      uniquePlaceholders(snippet.content).length === 0;
    if (rich && snippet.contentOoxml) {
      parts.push({ ooxml: snippet.contentOoxml });
      continue;
    }
    const text = resolveContent(snippet.content, values).text;
    const last = parts[parts.length - 1];
    if (last && "text" in last) {
      last.text += `\n${text}`;
    } else {
      parts.push({ text });
    }
  }
  return parts;
}
