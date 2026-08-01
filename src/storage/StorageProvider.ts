/**
 * THE storage interface (TECH_PLAN.md §6). Everything above the storage layer
 * (stores, UI) talks to this contract and never to Dexie/IndexedDB directly.
 * A v2.0 cloud provider slots in behind this same interface.
 */
import type {
  AppPrefs,
  ExportBundle,
  Folder,
  ImportConflictPolicy,
  Library,
  Snippet,
  SnippetMembership,
  Tag,
} from "../models/entities";

/** Creation inputs: the provider assigns `id`, `createdAt`, `updatedAt`. */
export interface LibraryInput {
  name: string;
  description?: string;
}

export interface FolderInput {
  libraryId: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
}

export interface SnippetInput {
  name: string;
  content: string;
  tagIds: string[];
  memberships: SnippetMembership[];
}

export interface ImportResult {
  snippetsAdded: number;
  snippetsUpdated: number;
  snippetsCopied: number;
  tagsAdded: number;
  librariesAdded: number;
  foldersAdded: number;
}

export interface StorageProvider {
  /**
   * Open the underlying store and request persistence from the platform.
   * Safe to call more than once.
   */
  init(): Promise<void>;

  // ---- Libraries ----
  createLibrary(input: LibraryInput): Promise<Library>;
  getLibrary(id: string): Promise<Library | undefined>;
  getAllLibraries(): Promise<Library[]>;
  updateLibrary(library: Library): Promise<Library>;
  /**
   * Deletes the library, its folders, and its snippet memberships. Snippets
   * left with zero memberships become Unassigned Backlog — never deleted (§7.1).
   */
  deleteLibrary(id: string): Promise<void>;

  // ---- Folders ----
  createFolder(input: FolderInput): Promise<Folder>;
  getFolder(id: string): Promise<Folder | undefined>;
  getFoldersByLibrary(libraryId: string): Promise<Folder[]>;
  getAllFolders(): Promise<Folder[]>;
  updateFolder(folder: Folder): Promise<Folder>;
  /** Deletes the folder; child folders and snippet memberships move to its parent (§7.2). */
  deleteFolder(id: string): Promise<void>;

  // ---- Snippets ----
  createSnippet(input: SnippetInput): Promise<Snippet>;
  getSnippet(id: string): Promise<Snippet | undefined>;
  getAllSnippets(): Promise<Snippet[]>;
  getSnippetsByLibrary(libraryId: string): Promise<Snippet[]>;
  /** Snippets with zero memberships — the Unassigned Backlog. */
  getUnassignedSnippets(): Promise<Snippet[]>;
  updateSnippet(snippet: Snippet): Promise<Snippet>;
  deleteSnippet(id: string): Promise<void>;

  // ---- Tags ----
  /** Throws if a tag with the same name (case-insensitive) already exists. */
  createTag(name: string): Promise<Tag>;
  /** Returns the existing tag on a case-insensitive name match, else creates it. */
  getOrCreateTag(name: string): Promise<Tag>;
  getTag(id: string): Promise<Tag | undefined>;
  getTagByName(name: string): Promise<Tag | undefined>;
  getAllTags(): Promise<Tag[]>;
  updateTag(tag: Tag): Promise<Tag>;
  /** Deletes the tag and removes it from every snippet that references it. */
  deleteTag(id: string): Promise<void>;

  // ---- Preferences ----
  getPrefs(): Promise<AppPrefs>;
  updatePrefs(patch: Partial<AppPrefs>): Promise<AppPrefs>;

  // ---- Import / export (bundle format §7.8) ----
  exportAll(): Promise<ExportBundle>;
  importBundle(bundle: ExportBundle, policy: ImportConflictPolicy): Promise<ImportResult>;
}
