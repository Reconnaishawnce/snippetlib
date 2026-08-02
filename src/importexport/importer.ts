/**
 * Import parsing and preview planning (§7.8) — pure. Applying an import is the
 * StorageProvider's importBundle (the only layer that touches the database).
 */
import type { ExportBundle } from "../models/entities";
import { exportBundleSchema } from "../models/schemas";

export type ParseResult = { ok: true; bundle: ExportBundle } | { ok: false; error: string };

/** Validate untrusted JSON into a bundle — readable errors, never a stack trace. */
export function parseBundle(json: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: "That file isn't valid JSON. Choose a ReportSnips export file." };
  }
  const result = exportBundleSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first && first.path.length > 0 ? ` (at ${first.path.join(".")})` : "";
    const detail = first ? `${first.message}${where}` : "unrecognized structure";
    return {
      ok: false,
      error: `That file doesn't look like a ReportSnips export: ${detail}. It may be from a newer version.`,
    };
  }
  return { ok: true, bundle: result.data };
}

export interface ImportPreview {
  newSnippets: number;
  /** Snippets whose id already exists locally — the conflict set. */
  conflicts: number;
  newTags: number;
  newLibraries: number;
}

export interface ExistingSummary {
  snippetIds: Set<string>;
  tagNamesLower: Set<string>;
  libraryNamesLower: Set<string>;
}

export function planImport(bundle: ExportBundle, existing: ExistingSummary): ImportPreview {
  let newSnippets = 0;
  let conflicts = 0;
  for (const snippet of bundle.snippets) {
    if (existing.snippetIds.has(snippet.id)) {
      conflicts += 1;
    } else {
      newSnippets += 1;
    }
  }
  const newTags = bundle.tags.filter(
    (t) => !existing.tagNamesLower.has(t.name.toLowerCase())
  ).length;
  const newLibraries = bundle.libraries.filter(
    (l) => !existing.libraryNamesLower.has(l.name.toLowerCase())
  ).length;
  return { newSnippets, conflicts, newTags, newLibraries };
}
