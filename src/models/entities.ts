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
  // Usage tracking for frecency sorting. Optional: rows written before these
  // fields existed lack them; absent means never inserted.
  useCount?: number;
  lastUsedAt?: string;
  /** Set by "Looks fine" in the stale review — resets the staleness clock without an edit. */
  lastReviewedAt?: string;
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

/** Browse-list sort order. "recent"/"most-used" rank never-inserted snippets last. */
export type BrowseSort = "name" | "recent" | "most-used" | "newest";

export interface AppPrefs {
  activeLibraryId: string | null; // null = "All libraries" view
  suppressNewTagConfirm: boolean; // "Stop Showing This"
  lastExportAt: string | null;
  changesSinceExport: number;
  /** Feature flag (§7.7): native drag from queue into the document. */
  enableDocDragDrop: boolean;
  /** Quick Save: Save Selection skips the form — auto-name, current folder, undo toast. */
  quickSaveMode: boolean;
  browseSort: BrowseSort;
  // Feature toggles — every non-core feature can be switched off to keep the
  // pane simple. All default on (except stale review, which is opt-in).
  /** Queue feature: the Queue tab, Q buttons, and Add-to-Queue menu items. */
  enableQueue: boolean;
  /** Usage tracking + the Recently/Most used sorts. Off: no recording, name sort only. */
  enableFrecency: boolean;
  // Stale-snippet review (opt-in): flag snippets not edited in `staleEditedDays`
  // OR not used in `staleUnusedDays`.
  staleReviewEnabled: boolean;
  staleEditedDays: number;
  staleUnusedDays: number;
  /** true: show a banner when stale snippets exist; false: manual review from Settings only. */
  staleAlerts: boolean;
}

/**
 * A saved queue layout ("report-type checklist"): named sections with the
 * snippets that belong in them. App-scoped (IndexedDB), loadable into any
 * document's queue. Not part of the export bundle (v0.x).
 */
export interface QueueTemplate {
  id: string;
  name: string;
  sections: QueueTemplateSection[];
  createdAt: string;
  updatedAt: string;
}

export interface QueueTemplateSection {
  name: string;
  snippetIds: string[];
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
