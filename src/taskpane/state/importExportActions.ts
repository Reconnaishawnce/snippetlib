/**
 * Export/import glue for the task pane (§7.8, §3). Bundles come from the pure
 * exporter; persistence goes through the StorageProvider; the download uses a
 * blob link (the only reliable file path in Office webviews).
 */
/* global document, URL, Blob */
import {
  buildExportBundle,
  exportFileName,
  type ExportSelection,
} from "../../importexport/exporter";
import type { ExportBundle, ImportConflictPolicy } from "../../models/entities";
import type { ImportResult } from "../../storage/StorageProvider";
import { getStorage } from "./storage";
import { useLibraryStore } from "./libraryStore";
import { useSearchStore } from "./searchStore";
import { useSnippetStore } from "./snippetStore";
import { useTagStore } from "./tagStore";

const APP_VERSION = "0.1.0";

function download(fileName: string, json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Builds and downloads a bundle. A full export (no selection) resets the backup nudge (§3). */
export async function exportAndDownload(selection: ExportSelection): Promise<ExportBundle> {
  const storage = getStorage();
  const [libraries, folders, snippets, tags] = await Promise.all([
    storage.getAllLibraries(),
    storage.getAllFolders(),
    storage.getAllSnippets(),
    storage.getAllTags(),
  ]);
  const exportedAt = new Date().toISOString();
  const bundle = buildExportBundle(
    { libraries, folders, snippets, tags },
    selection,
    APP_VERSION,
    exportedAt
  );
  download(exportFileName(exportedAt), JSON.stringify(bundle, null, 2));
  const isFullExport = !selection.libraryIds && !selection.snippetIds;
  if (isFullExport) {
    await storage.updatePrefs({ lastExportAt: exportedAt, changesSinceExport: 0 });
  }
  return bundle;
}

/** Applies a validated bundle and refreshes every store that mirrors storage. */
export async function applyImport(
  bundle: ExportBundle,
  policy: ImportConflictPolicy
): Promise<ImportResult> {
  const result = await getStorage().importBundle(bundle, policy);
  const libraryState = useLibraryStore.getState();
  const storage = getStorage();
  const libraries = await storage.getAllLibraries();
  useLibraryStore.setState({
    libraries,
    folders:
      libraryState.scope.kind === "library"
        ? await storage.getFoldersByLibrary(libraryState.scope.libraryId)
        : [],
  });
  await useSnippetStore.getState().loadForScope(libraryState.scope);
  await useTagStore.getState().load();
  await useSearchStore.getState().rebuild();
  return result;
}

const BACKUP_STALE_DAYS = 7;
const BACKUP_CHANGE_LIMIT = 25;

/** Whether the dismissible backup nudge should show (§3). */
export function backupNudgeDue(
  lastExportAt: string | null,
  changesSinceExport: number,
  snippetCount: number,
  now: Date
): boolean {
  if (snippetCount === 0) {
    return false;
  }
  if (changesSinceExport > BACKUP_CHANGE_LIMIT) {
    return true;
  }
  if (lastExportAt === null) {
    return changesSinceExport > 0;
  }
  const ageMs = now.getTime() - Date.parse(lastExportAt);
  return ageMs > BACKUP_STALE_DAYS * 24 * 60 * 60 * 1000;
}
