/**
 * Pure highlighting helpers for search results (§7.5). Output is plain data —
 * the UI renders segments as React text nodes, never as HTML.
 */

export interface Segment {
  text: string;
  hit: boolean;
}

function isWordChar(ch: string): boolean {
  return /[\p{L}\p{N}]/u.test(ch);
}

/**
 * Splits `text` into segments, marking prefix matches of any of `terms`
 * (case-insensitive, at word starts — mirrors MiniSearch's prefix matching).
 */
export function highlightSegments(text: string, terms: string[]): Segment[] {
  const cleanTerms = terms.map((t) => t.toLowerCase()).filter((t) => t.length > 0);
  if (cleanTerms.length === 0 || !text) {
    return text ? [{ text, hit: false }] : [];
  }
  const lower = text.toLowerCase();
  const segments: Segment[] = [];
  let cursor = 0;
  let index = 0;
  while (index < lower.length) {
    const atWordStart = index === 0 || !isWordChar(lower[index - 1]!);
    let matched = 0;
    if (atWordStart) {
      for (const term of cleanTerms) {
        if (lower.startsWith(term, index) && term.length > matched) {
          matched = term.length;
        }
      }
    }
    if (matched > 0) {
      if (index > cursor) {
        segments.push({ text: text.slice(cursor, index), hit: false });
      }
      segments.push({ text: text.slice(index, index + matched), hit: true });
      cursor = index + matched;
      index = cursor;
    } else {
      index += 1;
    }
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), hit: false });
  }
  return segments;
}

/**
 * A window of `maxLength` characters around the first term match, ellipsized
 * on the sides that were cut. Falls back to the content head when nothing matches.
 */
export function makeExcerpt(content: string, terms: string[], maxLength = 160): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  const lower = normalized.toLowerCase();
  let firstMatch = -1;
  for (const term of terms.map((t) => t.toLowerCase()).filter(Boolean)) {
    const at = lower.indexOf(term);
    if (at !== -1 && (firstMatch === -1 || at < firstMatch)) {
      firstMatch = at;
    }
  }
  if (firstMatch === -1) {
    return `${normalized.slice(0, maxLength - 1)}…`;
  }
  const start = Math.max(0, firstMatch - Math.floor(maxLength / 3));
  const end = Math.min(normalized.length, start + maxLength);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < normalized.length ? "…" : "";
  return `${prefix}${normalized.slice(start, end).trim()}${suffix}`;
}
