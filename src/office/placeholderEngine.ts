/**
 * Placeholder engine (§7.6) — pure and browser-agnostic. Parses `[Placeholder
 * Name]` tokens, normalizes keys, resolves values, and honors the
 * `\[escaped\]` escape hatch. No Office.js, no DOM.
 */

/** Matches `[token]` where the token is 1-60 chars, no brackets or newlines. */
const PLACEHOLDER_PATTERN = /\[([^[\]\n]{1,60})\]/g;

export interface ParsedPlaceholder {
  /** Verbatim token text including brackets, e.g. "[Building Name]". */
  raw: string;
  /** Display name preserving the author's casing, e.g. "Building Name". */
  display: string;
  /** Normalized key: trimmed, spaces collapsed, lower-cased (§7.6). */
  key: string;
  start: number;
  end: number;
}

export function normalizeKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function isEscaped(content: string, tokenStart: number): boolean {
  return tokenStart > 0 && content[tokenStart - 1] === "\\";
}

/**
 * All placeholder occurrences in order. `\[escaped\]` tokens are skipped;
 * empty/whitespace-only tokens are not placeholders.
 */
export function parsePlaceholders(content: string): ParsedPlaceholder[] {
  const result: ParsedPlaceholder[] = [];
  for (const match of content.matchAll(PLACEHOLDER_PATTERN)) {
    const start = match.index ?? 0;
    if (isEscaped(content, start)) {
      continue;
    }
    const display = (match[1] ?? "").trim().replace(/\s+/g, " ");
    if (!display) {
      continue;
    }
    result.push({
      raw: match[0] ?? "",
      display,
      key: normalizeKey(display),
      start,
      end: start + (match[0]?.length ?? 0),
    });
  }
  return result;
}

/** Unique placeholders by key, keeping the first-seen display casing (§7.6). */
export function uniquePlaceholders(content: string): ParsedPlaceholder[] {
  const seen = new Set<string>();
  const unique: ParsedPlaceholder[] = [];
  for (const placeholder of parsePlaceholders(content)) {
    if (!seen.has(placeholder.key)) {
      seen.add(placeholder.key);
      unique.push(placeholder);
    }
  }
  return unique;
}

export interface ResolveResult {
  /** Content with known values substituted and escapes stripped. */
  text: string;
  /** Placeholders that had no value (kept as literal tokens), first-seen order. */
  unresolved: ParsedPlaceholder[];
}

/**
 * Insert-time resolution (§7.6): substitute values by normalized key, keep
 * unknown tokens verbatim, and unescape `\[x\]` → `[x]`.
 */
export function resolveContent(content: string, values: Record<string, string>): ResolveResult {
  const placeholders = parsePlaceholders(content);
  const unresolvedByKey = new Map<string, ParsedPlaceholder>();
  let text = "";
  let cursor = 0;
  for (const placeholder of placeholders) {
    text += content.slice(cursor, placeholder.start);
    const value = values[placeholder.key];
    if (value !== undefined) {
      text += value;
    } else {
      text += placeholder.raw;
      if (!unresolvedByKey.has(placeholder.key)) {
        unresolvedByKey.set(placeholder.key, placeholder);
      }
    }
    cursor = placeholder.end;
  }
  text += content.slice(cursor);
  // Escape hatch (§7.6): `\[not a placeholder\]` inserts as `[not a placeholder]`.
  // Handle the documented fully-escaped pair first, then a lone escaped `\[`.
  text = text.replace(/\\\[([^[\]\n]{0,60}?)\\\]/g, "[$1]");
  text = text.replace(/\\\[/g, "[");
  return { text, unresolved: [...unresolvedByKey.values()] };
}
