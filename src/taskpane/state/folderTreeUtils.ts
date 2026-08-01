/**
 * Pure folder-tree helpers (§7.2). No storage or React dependencies so they
 * stay unit-testable.
 */
import type { Folder, Snippet } from "../../models/entities";

export interface FolderNode {
  folder: Folder;
  children: FolderNode[];
}

/** Builds the per-library tree; siblings sorted by sortOrder then name. */
export function buildFolderTree(folders: Folder[]): FolderNode[] {
  const byParent = new Map<string | null, Folder[]>();
  for (const folder of folders) {
    const list = byParent.get(folder.parentId) ?? [];
    list.push(folder);
    byParent.set(folder.parentId, list);
  }
  const build = (parentId: string | null): FolderNode[] =>
    (byParent.get(parentId) ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((folder) => ({ folder, children: build(folder.id) }));
  return build(null);
}

/** True if `candidateId` is `folderId` itself or one of its descendants. */
export function isSelfOrDescendant(
  folders: Folder[],
  folderId: string,
  candidateId: string | null
): boolean {
  if (candidateId === null) {
    return false;
  }
  const byId = new Map(folders.map((f) => [f.id, f]));
  let current: string | null = candidateId;
  const seen = new Set<string>();
  while (current !== null) {
    if (current === folderId) {
      return true;
    }
    if (seen.has(current)) {
      return false; // corrupt cycle — treat as unrelated rather than looping forever
    }
    seen.add(current);
    current = byId.get(current)?.parentId ?? null;
  }
  return false;
}

/** Depth of a folder (root children = 1). Used for the >8 depth warning (§7.2). */
export function folderDepth(folders: Folder[], folderId: string | null): number {
  const byId = new Map(folders.map((f) => [f.id, f]));
  let depth = 0;
  let current = folderId;
  const seen = new Set<string>();
  while (current !== null) {
    const folder = byId.get(current);
    if (!folder || seen.has(current)) {
      break;
    }
    seen.add(current);
    depth += 1;
    current = folder.parentId;
  }
  return depth;
}

export const FOLDER_DEPTH_WARNING = 8;

/**
 * Recursive snippet count per folder id (a snippet in a subfolder counts toward
 * every ancestor), for the muted badge on tree rows (§7.2).
 */
export function recursiveSnippetCounts(
  folders: Folder[],
  snippets: Snippet[],
  libraryId: string
): Map<string, number> {
  const counts = new Map<string, number>();
  const byId = new Map(folders.map((f) => [f.id, f]));
  for (const snippet of snippets) {
    for (const membership of snippet.memberships) {
      if (membership.libraryId !== libraryId) {
        continue;
      }
      let current = membership.folderId;
      const seen = new Set<string>();
      while (current !== null) {
        const folder = byId.get(current);
        if (!folder || seen.has(current)) {
          break;
        }
        seen.add(current);
        counts.set(current, (counts.get(current) ?? 0) + 1);
        current = folder.parentId;
      }
    }
  }
  return counts;
}

/** Human-readable `Library > Folder > Subfolder` path for a folder. */
export function folderPath(folders: Folder[], folderId: string | null): string[] {
  if (folderId === null) {
    return [];
  }
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: string[] = [];
  let current: string | null = folderId;
  const seen = new Set<string>();
  while (current !== null) {
    const folder = byId.get(current);
    if (!folder || seen.has(current)) {
      break;
    }
    seen.add(current);
    path.unshift(folder.name);
    current = folder.parentId;
  }
  return path;
}
