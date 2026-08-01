/**
 * IndexedDB implementation of StorageProvider, via Dexie (TECH_PLAN.md §3, §6).
 * This is the ONLY file in the codebase allowed to touch Dexie/IndexedDB.
 */
/* global navigator, IDBFactory, IDBKeyRange */
import Dexie, { type Table } from "dexie";
import type {
  AppPrefs,
  ExportBundle,
  Folder,
  ImportConflictPolicy,
  Library,
  Snippet,
  Tag,
} from "../models/entities";
import { EXPORT_FORMAT_VERSION } from "../models/entities";
import { newId } from "../models/ids";
import type {
  FolderInput,
  ImportResult,
  LibraryInput,
  SnippetInput,
  StorageProvider,
} from "./StorageProvider";

/** Stored rows carry computed index fields that never leave this module. */
type SnippetRow = Snippet & { membershipLibraryIds: string[] };
type TagRow = Tag & { nameLower: string };
type PrefsRow = AppPrefs & { id: "prefs" };

const DEFAULT_PREFS: AppPrefs = {
  activeLibraryId: null,
  suppressNewTagConfirm: false,
  lastExportAt: null,
  changesSinceExport: 0,
};

export interface IndexedDbProviderOptions {
  databaseName?: string;
  appVersion?: string;
  /** Test seam: inject fake-indexeddb. Defaults to the platform globals. */
  indexedDB?: IDBFactory;
  IDBKeyRange?: typeof IDBKeyRange;
}

class ReportSnipsDb extends Dexie {
  libraries!: Table<Library, string>;
  folders!: Table<Folder, string>;
  snippets!: Table<SnippetRow, string>;
  tags!: Table<TagRow, string>;
  prefs!: Table<PrefsRow, string>;

  constructor(name: string, options: IndexedDbProviderOptions) {
    super(
      name,
      options.indexedDB && options.IDBKeyRange
        ? { indexedDB: options.indexedDB, IDBKeyRange: options.IDBKeyRange }
        : undefined
    );
    // Schema v1 (§5). Only queried fields are indexed; `*` = multi-entry, `&` = unique.
    this.version(1).stores({
      libraries: "id",
      folders: "id, libraryId, parentId",
      snippets: "id, *tagIds, *membershipLibraryIds",
      tags: "id, &nameLower, usageCount",
      prefs: "id",
    });
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function membershipLibraryIds(snippet: Pick<Snippet, "memberships">): string[] {
  // Deduplicated: a snippet may appear in one library only once per membership,
  // but defensive dedupe keeps the multi-entry index sane regardless.
  return [...new Set(snippet.memberships.map((m) => m.libraryId))];
}

function toSnippet(row: SnippetRow): Snippet {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    tagIds: row.tagIds,
    memberships: row.memberships,
    history: row.history,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    usageCount: row.usageCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeTagName(name: string): string {
  return name.trim();
}

export class IndexedDbProvider implements StorageProvider {
  private readonly db: ReportSnipsDb;
  private readonly appVersion: string;

  constructor(options: IndexedDbProviderOptions = {}) {
    this.db = new ReportSnipsDb(options.databaseName ?? "reportsnips", options);
    this.appVersion = options.appVersion ?? "dev";
  }

  async init(): Promise<void> {
    await this.db.open();
    // Ask the platform not to evict our data (§3). Best-effort: browsers may
    // decline silently, and test/node environments lack navigator.storage.
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      try {
        await navigator.storage.persist();
      } catch {
        // Denied or unsupported — the backup-nudge flow (§3) is the fallback.
      }
    }
  }

  /** Close the underlying connection (used by tests; harmless in production). */
  close(): void {
    this.db.close();
  }

  // ---- Libraries ----

  async createLibrary(input: LibraryInput): Promise<Library> {
    const timestamp = nowIso();
    const library: Library = {
      id: newId(),
      name: input.name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.db.libraries.add(library);
    return library;
  }

  async getLibrary(id: string): Promise<Library | undefined> {
    return this.db.libraries.get(id);
  }

  async getAllLibraries(): Promise<Library[]> {
    return this.db.libraries.toArray();
  }

  async updateLibrary(library: Library): Promise<Library> {
    const updated: Library = { ...library, updatedAt: nowIso() };
    await this.db.libraries.put(updated);
    return updated;
  }

  async deleteLibrary(id: string): Promise<void> {
    await this.db.transaction(
      "rw",
      [this.db.libraries, this.db.folders, this.db.snippets],
      async () => {
        await this.db.libraries.delete(id);
        await this.db.folders.where("libraryId").equals(id).delete();
        const members = await this.db.snippets.where("membershipLibraryIds").equals(id).toArray();
        for (const row of members) {
          row.memberships = row.memberships.filter((m) => m.libraryId !== id);
          row.membershipLibraryIds = membershipLibraryIds(row);
          row.updatedAt = nowIso();
          await this.db.snippets.put(row);
        }
      }
    );
  }

  // ---- Folders ----

  async createFolder(input: FolderInput): Promise<Folder> {
    const timestamp = nowIso();
    const folder: Folder = {
      id: newId(),
      libraryId: input.libraryId,
      parentId: input.parentId,
      name: input.name,
      sortOrder: input.sortOrder,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.db.folders.add(folder);
    return folder;
  }

  async getFolder(id: string): Promise<Folder | undefined> {
    return this.db.folders.get(id);
  }

  async getFoldersByLibrary(libraryId: string): Promise<Folder[]> {
    return this.db.folders.where("libraryId").equals(libraryId).toArray();
  }

  async updateFolder(folder: Folder): Promise<Folder> {
    const updated: Folder = { ...folder, updatedAt: nowIso() };
    await this.db.folders.put(updated);
    return updated;
  }

  async deleteFolder(id: string): Promise<void> {
    await this.db.transaction("rw", [this.db.folders, this.db.snippets], async () => {
      const folder = await this.db.folders.get(id);
      if (!folder) {
        return;
      }
      // Contents move to the parent (§7.2): child folders re-parent…
      const children = await this.db.folders.where("parentId").equals(id).toArray();
      for (const child of children) {
        child.parentId = folder.parentId;
        child.updatedAt = nowIso();
        await this.db.folders.put(child);
      }
      // …and snippet memberships pointing at this folder move up too.
      const members = await this.db.snippets
        .where("membershipLibraryIds")
        .equals(folder.libraryId)
        .toArray();
      for (const row of members) {
        let touched = false;
        for (const membership of row.memberships) {
          if (membership.libraryId === folder.libraryId && membership.folderId === id) {
            membership.folderId = folder.parentId;
            touched = true;
          }
        }
        if (touched) {
          row.updatedAt = nowIso();
          await this.db.snippets.put(row);
        }
      }
      await this.db.folders.delete(id);
    });
  }

  // ---- Snippets ----

  async createSnippet(input: SnippetInput): Promise<Snippet> {
    const timestamp = nowIso();
    const snippet: Snippet = {
      id: newId(),
      name: input.name,
      content: input.content,
      tagIds: [...input.tagIds],
      memberships: input.memberships.map((m) => ({ ...m })),
      history: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.db.transaction("rw", [this.db.snippets, this.db.tags, this.db.prefs], async () => {
      await this.db.snippets.add({
        ...snippet,
        membershipLibraryIds: membershipLibraryIds(snippet),
      });
      await this.adjustTagUsage(snippet.tagIds, +1);
      await this.bumpChangesSinceExport();
    });
    return snippet;
  }

  async getSnippet(id: string): Promise<Snippet | undefined> {
    const row = await this.db.snippets.get(id);
    return row ? toSnippet(row) : undefined;
  }

  async getAllSnippets(): Promise<Snippet[]> {
    return (await this.db.snippets.toArray()).map(toSnippet);
  }

  async getSnippetsByLibrary(libraryId: string): Promise<Snippet[]> {
    const rows = await this.db.snippets.where("membershipLibraryIds").equals(libraryId).toArray();
    return rows.map(toSnippet);
  }

  async getUnassignedSnippets(): Promise<Snippet[]> {
    // Multi-entry indexes cannot match empty arrays, so filter over the table.
    const rows = await this.db.snippets.filter((row) => row.memberships.length === 0).toArray();
    return rows.map(toSnippet);
  }

  async updateSnippet(snippet: Snippet): Promise<Snippet> {
    const updated: Snippet = { ...snippet, updatedAt: nowIso() };
    await this.db.transaction("rw", [this.db.snippets, this.db.tags, this.db.prefs], async () => {
      const previous = await this.db.snippets.get(snippet.id);
      const previousTagIds = previous?.tagIds ?? [];
      const removed = previousTagIds.filter((tagId) => !updated.tagIds.includes(tagId));
      const added = updated.tagIds.filter((tagId) => !previousTagIds.includes(tagId));
      await this.db.snippets.put({
        ...updated,
        membershipLibraryIds: membershipLibraryIds(updated),
      });
      await this.adjustTagUsage(removed, -1);
      await this.adjustTagUsage(added, +1);
      await this.bumpChangesSinceExport();
    });
    return updated;
  }

  async deleteSnippet(id: string): Promise<void> {
    await this.db.transaction("rw", [this.db.snippets, this.db.tags, this.db.prefs], async () => {
      const row = await this.db.snippets.get(id);
      if (!row) {
        return;
      }
      await this.db.snippets.delete(id);
      await this.adjustTagUsage(row.tagIds, -1);
      await this.bumpChangesSinceExport();
    });
  }

  // ---- Tags ----

  async createTag(name: string): Promise<Tag> {
    const trimmed = normalizeTagName(name);
    if (!trimmed) {
      throw new Error("Tag name cannot be empty.");
    }
    const timestamp = nowIso();
    const row: TagRow = {
      id: newId(),
      name: trimmed,
      nameLower: trimmed.toLowerCase(),
      usageCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    // The unique &nameLower index rejects case-insensitive duplicates.
    await this.db.tags.add(row);
    return toTag(row);
  }

  async getOrCreateTag(name: string): Promise<Tag> {
    const existing = await this.getTagByName(name);
    return existing ?? this.createTag(name);
  }

  async getTag(id: string): Promise<Tag | undefined> {
    const row = await this.db.tags.get(id);
    return row ? toTag(row) : undefined;
  }

  async getTagByName(name: string): Promise<Tag | undefined> {
    const row = await this.db.tags
      .where("nameLower")
      .equals(normalizeTagName(name).toLowerCase())
      .first();
    return row ? toTag(row) : undefined;
  }

  async getAllTags(): Promise<Tag[]> {
    return (await this.db.tags.toArray()).map(toTag);
  }

  async updateTag(tag: Tag): Promise<Tag> {
    const trimmed = normalizeTagName(tag.name);
    if (!trimmed) {
      throw new Error("Tag name cannot be empty.");
    }
    const updated: Tag = { ...tag, name: trimmed, updatedAt: nowIso() };
    // A rename colliding with another tag's name throws via &nameLower;
    // merge-on-collision is Tag Manager behavior built on top (M3, §7.4).
    await this.db.tags.put({ ...updated, nameLower: trimmed.toLowerCase() });
    return updated;
  }

  async deleteTag(id: string): Promise<void> {
    await this.db.transaction("rw", [this.db.tags, this.db.snippets], async () => {
      await this.db.tags.delete(id);
      const rows = await this.db.snippets.where("tagIds").equals(id).toArray();
      for (const row of rows) {
        row.tagIds = row.tagIds.filter((tagId) => tagId !== id);
        row.updatedAt = nowIso();
        await this.db.snippets.put(row);
      }
    });
  }

  // ---- Preferences ----

  async getPrefs(): Promise<AppPrefs> {
    const row = await this.db.prefs.get("prefs");
    if (!row) {
      return { ...DEFAULT_PREFS };
    }
    return {
      activeLibraryId: row.activeLibraryId,
      suppressNewTagConfirm: row.suppressNewTagConfirm,
      lastExportAt: row.lastExportAt,
      changesSinceExport: row.changesSinceExport,
    };
  }

  async updatePrefs(patch: Partial<AppPrefs>): Promise<AppPrefs> {
    return this.db.transaction("rw", this.db.prefs, async () => {
      const current = await this.getPrefs();
      const next: AppPrefs = { ...current, ...patch };
      await this.db.prefs.put({ ...next, id: "prefs" });
      return next;
    });
  }

  // ---- Import / export ----

  async exportAll(): Promise<ExportBundle> {
    return this.db.transaction(
      "r",
      [this.db.libraries, this.db.folders, this.db.snippets, this.db.tags],
      async () => ({
        formatVersion: EXPORT_FORMAT_VERSION,
        appVersion: this.appVersion,
        exportedAt: nowIso(),
        libraries: await this.db.libraries.toArray(),
        folders: await this.db.folders.toArray(),
        snippets: (await this.db.snippets.toArray()).map(toSnippet),
        tags: (await this.db.tags.toArray()).map(toTag),
      })
    );
  }

  // Import lands in M6 (§9) — the contract exists now so stores/UI never
  // need to change when it does.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  importBundle(_bundle: ExportBundle, _policy: ImportConflictPolicy): Promise<ImportResult> {
    return Promise.reject(new Error("importBundle is not implemented until M6."));
  }

  // ---- internals ----

  private async adjustTagUsage(tagIds: string[], delta: 1 | -1): Promise<void> {
    for (const tagId of tagIds) {
      const tag = await this.db.tags.get(tagId);
      if (tag) {
        tag.usageCount = Math.max(0, tag.usageCount + delta);
        tag.updatedAt = nowIso();
        await this.db.tags.put(tag);
      }
    }
  }

  private async bumpChangesSinceExport(): Promise<void> {
    const current = await this.getPrefs();
    await this.db.prefs.put({
      ...current,
      changesSinceExport: current.changesSinceExport + 1,
      id: "prefs",
    });
  }
}
