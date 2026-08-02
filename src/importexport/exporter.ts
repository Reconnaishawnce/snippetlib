/**
 * Export bundles (§7.8) — pure. Takes the full data set plus a selection and
 * returns the versioned bundle with only the entities the selection needs.
 */
import type { ExportBundle, Folder, Library, Snippet, Tag } from "../models/entities";
import { EXPORT_FORMAT_VERSION } from "../models/entities";

export interface ExportSource {
  libraries: Library[];
  folders: Folder[];
  snippets: Snippet[];
  tags: Tag[];
}

export interface ExportSelection {
  /** Restrict to these libraries' snippets (memberships elsewhere are kept on the snippet). */
  libraryIds?: string[];
  /** Explicit snippet selection — takes precedence over libraryIds. */
  snippetIds?: string[];
}

/** Ancestor chain of a folder (self included) — needed to rebuild paths. */
function folderChain(folders: Map<string, Folder>, folderId: string): Folder[] {
  const chain: Folder[] = [];
  let current: string | null = folderId;
  const seen = new Set<string>();
  while (current !== null) {
    const folder = folders.get(current);
    if (!folder || seen.has(current)) {
      break;
    }
    seen.add(current);
    chain.push(folder);
    current = folder.parentId;
  }
  return chain;
}

export function buildExportBundle(
  source: ExportSource,
  selection: ExportSelection,
  appVersion: string,
  exportedAt: string
): ExportBundle {
  let snippets: Snippet[];
  if (selection.snippetIds) {
    const wanted = new Set(selection.snippetIds);
    snippets = source.snippets.filter((s) => wanted.has(s.id));
  } else if (selection.libraryIds) {
    const wanted = new Set(selection.libraryIds);
    snippets = source.snippets.filter((s) => s.memberships.some((m) => wanted.has(m.libraryId)));
  } else {
    snippets = [...source.snippets];
  }

  // Reference closure: only the tags, libraries, and folder chains the
  // selected snippets actually use (§7.8).
  const tagIds = new Set(snippets.flatMap((s) => s.tagIds));
  const libraryIds = new Set(snippets.flatMap((s) => s.memberships.map((m) => m.libraryId)));
  const foldersById = new Map(source.folders.map((f) => [f.id, f]));
  const folderIds = new Set<string>();
  for (const snippet of snippets) {
    for (const membership of snippet.memberships) {
      if (membership.folderId !== null) {
        for (const folder of folderChain(foldersById, membership.folderId)) {
          folderIds.add(folder.id);
        }
      }
    }
  }

  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    appVersion,
    exportedAt,
    libraries: source.libraries.filter((l) => libraryIds.has(l.id)),
    folders: source.folders.filter((f) => folderIds.has(f.id)),
    snippets,
    tags: source.tags.filter((t) => tagIds.has(t.id)),
  };
}

export function exportFileName(exportedAt: string): string {
  const date = exportedAt.slice(0, 10).replace(/-/g, "");
  return `reportsnips-export-${date}.json`;
}
