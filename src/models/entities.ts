/**
 * Core data model (TECH_PLAN.md §5).
 * All entities carry `id` (UUID v4) and ISO `createdAt` / `updatedAt` strings.
 */

/** A library = one working context (e.g., "Risk Assessments", "Compliance", "Marketing"). */
export interface Library {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** Folder tree node. Folders belong to exactly one library. */
export interface Folder {
  id: string;
  libraryId: string;
  parentId: string | null; // null = root of that library
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SnippetMembership {
  libraryId: string;
  folderId: string | null; // null = library root
}

export interface SnippetRevision {
  content: string;
  name: string;
  savedAt: string;
}

/**
 * Snippets are GLOBAL entities. A snippet can live in multiple libraries
 * (possibly in a different folder in each), or in none (the Unassigned Backlog).
 */
export interface Snippet {
  id: string;
  name: string;
  content: string; // plain text; may contain [Placeholder Name] tokens
  tagIds: string[];
  memberships: SnippetMembership[]; // empty array = Unassigned Backlog
  history: SnippetRevision[]; // most recent first, max length 3
  createdAt: string;
  updatedAt: string;
}

/** Tags are global across all libraries. */
export interface Tag {
  id: string;
  name: string; // unique, case-insensitive
  usageCount: number; // maintained on snippet save/delete; drives autocomplete ranking
  createdAt: string;
  updatedAt: string;
}

/** ---- Document-scoped (stored in Word document settings, NOT IndexedDB) ---- */

/** Placeholder values captured for the current document. Key = normalized placeholder name. */
export type DocumentPlaceholderValues = Record<string, string>;

/** The Queue for the current document. */
export interface QueueState {
  sections: QueueSection[];
}

export interface QueueSection {
  id: string;
  name: string; // e.g., "High", "Medium", "Low" — user-defined
  sortOrder: number;
  items: QueueItem[];
}

export interface QueueItem {
  id: string;
  snippetId: string;
  sortOrder: number;
  inserted: boolean; // marked true after insertion; struck through in UI, not removed
}

/** ---- App-scoped preferences (IndexedDB) ---- */
export interface AppPrefs {
  activeLibraryId: string | null; // null = "All libraries" view
  suppressNewTagConfirm: boolean; // "Stop Showing This"
  lastExportAt: string | null;
  changesSinceExport: number;
  /** Feature flag (§7.7): native drag from queue into the document. */
  enableDocDragDrop: boolean;
}

/** ---- Import/export bundle (§7.8) — the sharing currency and backup format ---- */

export const EXPORT_FORMAT_VERSION = 1;

export interface ExportBundle {
  formatVersion: typeof EXPORT_FORMAT_VERSION;
  appVersion: string;
  exportedAt: string;
  libraries: Library[];
  folders: Folder[];
  snippets: Snippet[];
  tags: Tag[];
}

/** Per-conflict policy for snippets whose id already exists locally (§7.8). */
export type ImportConflictPolicy = "keep-mine" | "take-theirs" | "keep-both";
