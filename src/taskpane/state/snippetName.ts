/** Default snippet name: the first 8 words of the selection (§7.3). */
export function deriveDefaultName(content: string, wordCount = 8): string {
  const words = content.trim().split(/\s+/).filter(Boolean);
  const name = words.slice(0, wordCount).join(" ");
  return words.length > wordCount ? `${name}…` : name;
}

/** Placeholder detection for the informative save-form hint (§7.3 / §7.6). */
const PLACEHOLDER_PATTERN = /\[([^[\]\n]{1,60})\]/g;

export function detectPlaceholders(content: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const match of content.matchAll(PLACEHOLDER_PATTERN)) {
    // Skip the \[escaped\] form (§7.6) — not a placeholder.
    const start = match.index ?? 0;
    if (start > 0 && content[start - 1] === "\\") {
      continue;
    }
    const display = (match[1] ?? "").trim();
    const key = display.replace(/\s+/g, " ").toLowerCase();
    if (display && !seen.has(key)) {
      seen.add(key);
      names.push(display);
    }
  }
  return names;
}
