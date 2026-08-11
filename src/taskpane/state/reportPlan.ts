/**
 * Report generation planning (report builder v1). Pure: given the queue, the
 * snippet library, and the document's placeholder values, produce what each
 * {{Section}} marker should be replaced with. The Word calls live in
 * documentIO; this module never touches Office.
 */
import type { QueueState, SectionLayout, Snippet } from "../../models/entities";
import {
  resolveContent,
  uniquePlaceholders,
  type ParsedPlaceholder,
} from "../../office/placeholderEngine";
import { displaySections } from "./queueOps";

export interface ReportRow {
  itemId: string;
  snippetId: string;
  /** Snippet name — the left column in table layout. */
  name: string;
  /** Placeholder-resolved content (unknown tokens stay literal, §7.6). */
  text: string;
}

export interface ReportSectionPlan {
  sectionId: string;
  name: string;
  /** The literal text searched for in the document, e.g. "{{HIGH Vulnerabilities}}". */
  marker: string;
  layout: SectionLayout;
  rows: ReportRow[];
  /** Items whose snippet has been deleted from the library — skipped, but reported. */
  missingSnippets: number;
}

export interface ReportPlan {
  /** Sections with at least one resolvable snippet, in queue order. */
  sections: ReportSectionPlan[];
  /** Placeholders with no stored value across the whole report, first-seen order. */
  missing: ParsedPlaceholder[];
  /** Every queue item id that would be written (for mark-inserted). */
  itemIds: string[];
  /** Every snippet id that would be written (for usage recording). */
  snippetIds: string[];
}

export const DEFAULT_SECTION_LAYOUT: SectionLayout = "table";

/** The marker text a section looks for in the document. */
export function sectionMarker(name: string): string {
  return `{{${name.trim()}}}`;
}

/**
 * Builds the full report plan. Call once with current values to learn
 * `missing`, then again with the dialog-augmented values to get final rows.
 */
export function buildReportPlan(
  queue: QueueState,
  snippetsById: Map<string, Snippet>,
  values: Record<string, string>
): ReportPlan {
  const sections: ReportSectionPlan[] = [];
  const missing: ParsedPlaceholder[] = [];
  const seenMissing = new Set<string>();
  const itemIds: string[] = [];
  const snippetIds: string[] = [];

  for (const section of displaySections(queue)) {
    const rows: ReportRow[] = [];
    let missingSnippets = 0;
    for (const item of [...section.items].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const snippet = snippetsById.get(item.snippetId);
      if (!snippet) {
        missingSnippets += 1;
        continue;
      }
      for (const placeholder of uniquePlaceholders(snippet.content)) {
        if (values[placeholder.key] === undefined && !seenMissing.has(placeholder.key)) {
          seenMissing.add(placeholder.key);
          missing.push(placeholder);
        }
      }
      rows.push({
        itemId: item.id,
        snippetId: snippet.id,
        name: snippet.name,
        text: resolveContent(snippet.content, values).text,
      });
      itemIds.push(item.id);
      snippetIds.push(snippet.id);
    }
    if (rows.length > 0) {
      sections.push({
        sectionId: section.id,
        name: section.name,
        marker: sectionMarker(section.name),
        layout: section.layout ?? DEFAULT_SECTION_LAYOUT,
        rows,
        missingSnippets,
      });
    }
  }
  return { sections, missing, itemIds, snippetIds };
}
