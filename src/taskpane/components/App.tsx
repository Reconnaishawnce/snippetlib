import * as React from "react";
import {
  Button,
  CounterBadge,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Divider,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Spinner,
  Tab,
  TabList,
  Toaster,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  Add16Regular,
  Dismiss16Regular,
  QuestionCircle20Regular,
  Settings20Regular,
} from "@fluentui/react-icons";
import type { Folder, Snippet } from "../../models/entities";
import { getSelectedText, insertText } from "../../office/documentIO";
import type { ParsedPlaceholder } from "../../office/placeholderEngine";
import { useLibraryStore } from "../state/libraryStore";
import { usePlaceholderStore } from "../state/placeholderStore";
import { usePrefsStore } from "../state/prefsStore";
import { useQueueStore } from "../state/queueStore";
import { useSearchStore } from "../state/searchStore";
import { useSnippetStore } from "../state/snippetStore";
import { useTagStore } from "../state/tagStore";
import { buildInsertText, planInsert } from "../state/insertFlow";
import { backupNudgeDue, exportAndDownload } from "../state/importExportActions";
import { unInsertedCount } from "../state/queueOps";
import { deriveDefaultName } from "../state/snippetName";
import { getStorage } from "../state/storage";
import { SAVE_AS_NEW_THRESHOLD, diceSimilarity } from "../../importexport/similarity";
import { LibrarySwitcher } from "./LibrarySwitcher";
import { FolderTree } from "./FolderTree";
import { HistoryDialog } from "./HistoryDialog";
import { ImportDialog } from "./ImportDialog";
import { PlaceholderDialog } from "./PlaceholderDialog";
import { PlaceholdersTab } from "./PlaceholdersTab";
import { HelpTab } from "./HelpTab";
import { MoveToDialog } from "./MoveToDialog";
import { QueueTab } from "./QueueTab";
import { SettingsTab } from "./SettingsTab";
import { SearchBox } from "./SearchBox";
import { SearchResults } from "./SearchResults";
import { SnippetList } from "./SnippetList";
import { SnippetForm, type SnippetFormValues } from "./SnippetForm";
import { TagFilterBar } from "./TagFilterBar";
import { TagManager } from "./TagManager";
import { resolveChipTagIds, type TagChip } from "./TagInput";

const useStyles = makeStyles({
  root: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  loading: {
    display: "flex",
    justifyContent: "center",
    paddingTop: tokens.spacingVerticalXXXL,
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    flexGrow: 1,
  },
  divider: {
    flexGrow: 0,
  },
  // Six tabs overflow a very narrow pane (~320px); wrapping beats clipping the
  // Settings/Help icons and dragging the pane into horizontal scroll.
  tabs: {
    flexWrap: "wrap",
  },
});

interface FormSession {
  mode: "create" | "edit";
  initial: SnippetFormValues;
  editing?: Snippet;
}

const App: React.FC = () => {
  const styles = useStyles();
  const initialized = useLibraryStore((s) => s.initialized);
  const init = useLibraryStore((s) => s.init);
  const scope = useLibraryStore((s) => s.scope);
  const selectedFolderId = useLibraryStore((s) => s.selectedFolderId);
  const libraries = useLibraryStore((s) => s.libraries);
  const saveNew = useSnippetStore((s) => s.saveNew);
  const saveEdit = useSnippetStore((s) => s.saveEdit);

  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormSession | null>(null);
  const [allFolders, setAllFolders] = React.useState<Folder[]>([]);
  const [tab, setTab] = React.useState<
    "browse" | "queue" | "placeholders" | "tags" | "settings" | "help"
  >("browse");
  const searchQuery = useSearchStore((s) => s.query);
  const searching = searchQuery.trim().length > 0;
  const queue = useQueueStore((s) => s.queue);
  const queueBadge = unInsertedCount(queue);
  const prefs = usePrefsStore((s) => s.prefs);
  const dragToDocEnabled = prefs?.enableDocDragDrop ?? true;
  const [pendingInsert, setPendingInsert] = React.useState<{
    snippets: Snippet[];
    missing: ParsedPlaceholder[];
    onDone?: () => void;
  } | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [historyFor, setHistoryFor] = React.useState<Snippet | null>(null);
  const [moveFor, setMoveFor] = React.useState<Snippet | null>(null);
  const [backupDue, setBackupDue] = React.useState(false);
  const [pendingEdit, setPendingEdit] = React.useState<{
    previous: Snippet;
    values: SnippetFormValues;
    tagIds: string[];
    similarity: number;
  } | null>(null);

  React.useEffect(() => {
    init().catch((e: unknown) => {
      setError(`Storage failed to open: ${e instanceof Error ? e.message : String(e)}`);
    });
    try {
      usePlaceholderStore.getState().load();
      useQueueStore.getState().load();
    } catch {
      // Doc settings unavailable (e.g. outside Word) — doc-scoped state starts empty.
    }
    void usePrefsStore.getState().load();
  }, [init]);

  const refreshBackupNudge = React.useCallback(async () => {
    try {
      const storage = getStorage();
      const [prefs, snippets] = await Promise.all([storage.getPrefs(), storage.getAllSnippets()]);
      setBackupDue(
        backupNudgeDue(prefs.lastExportAt, prefs.changesSinceExport, snippets.length, new Date())
      );
    } catch {
      setBackupDue(false);
    }
  }, []);

  React.useEffect(() => {
    if (initialized) {
      void refreshBackupNudge();
    }
  }, [initialized, refreshBackupNudge]);

  const onExport = async (selection: {
    libraryIds?: string[];
    snippetIds?: string[];
  }): Promise<void> => {
    try {
      const bundle = await exportAndDownload(selection);
      setNotice(
        `Exported ${bundle.snippets.length} ${bundle.snippets.length === 1 ? "snippet" : "snippets"}.`
      );
      await refreshBackupNudge();
    } catch (e: unknown) {
      setError(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const doInsert = async (
    snippets: Snippet[],
    values: Record<string, string>,
    onDone?: () => void
  ) => {
    try {
      await insertText(buildInsertText(snippets, values));
      onDone?.();
    } catch (e: unknown) {
      setError(`Insert failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const onInsert = (snippets: Snippet[], onDone?: () => void) => {
    if (snippets.length === 0) {
      return;
    }
    setError(null);
    const values = usePlaceholderStore.getState().values;
    const { missing } = planInsert(snippets, values);
    if (missing.length > 0) {
      // One dialog for all unknown placeholders (§7.6) — then insert.
      setPendingInsert({ snippets, missing, onDone });
    } else {
      void doInsert(snippets, values, onDone);
    }
  };

  const onPlaceholderSubmit = (filled: Record<string, string>) => {
    const pending = pendingInsert;
    setPendingInsert(null);
    if (!pending) {
      return;
    }
    const store = usePlaceholderStore.getState();
    for (const placeholder of pending.missing) {
      const value = filled[placeholder.key];
      if (value !== undefined) {
        // Remembered for the document — later inserts auto-fill (§7.6).
        store.setValue(placeholder.display, value);
      }
    }
    void doInsert(pending.snippets, { ...store.values, ...filled }, pending.onDone);
  };

  const onGoToSnippet = (snippet: Snippet) => {
    const membership = snippet.memberships[0];
    useSearchStore.getState().setQuery("", null);
    setTab("browse");
    if (membership) {
      void useLibraryStore
        .getState()
        .selectScope({ kind: "library", libraryId: membership.libraryId })
        .then(() => useLibraryStore.getState().selectFolder(membership.folderId));
    } else {
      void useLibraryStore.getState().selectScope({ kind: "backlog" });
    }
  };

  const openForm = async (session: FormSession) => {
    setAllFolders(await getStorage().getAllFolders());
    setForm(session);
  };

  const onSaveSelection = async () => {
    setError(null);
    let selection: string;
    try {
      selection = await getSelectedText();
    } catch (e: unknown) {
      setError(
        `Couldn't read the selection from Word: ${e instanceof Error ? e.message : String(e)}`
      );
      return;
    }
    if (!selection.trim()) {
      setError("Select some text in your document first.");
      return;
    }
    await openForm({
      mode: "create",
      initial: {
        name: deriveDefaultName(selection),
        content: selection,
        memberships:
          scope.kind === "library"
            ? [{ libraryId: scope.libraryId, folderId: selectedFolderId }]
            : [],
        tagChips: [],
      },
    });
  };

  const onEdit = (snippet: Snippet) => {
    const tagsById = new Map(useTagStore.getState().tags.map((t) => [t.id, t]));
    const tagChips: TagChip[] = snippet.tagIds
      .map((id) => tagsById.get(id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map((t) => ({ name: t.name, tagId: t.id }));
    void openForm({
      mode: "edit",
      editing: snippet,
      initial: {
        name: snippet.name,
        content: snippet.content,
        memberships: snippet.memberships,
        tagChips,
      },
    });
  };

  const onFormSave = async (values: SnippetFormValues) => {
    const session = form;
    setForm(null);
    if (!session) {
      return;
    }
    try {
      const tagIds = await resolveChipTagIds(values.tagChips);
      const { name, content, memberships } = values;
      if (session.mode === "create") {
        await saveNew({ name, content, memberships, tagIds });
      } else if (session.editing) {
        if (content === session.editing.content) {
          // Name/tags/targets only — plain update, no history push (§7.9).
          await saveEdit({ ...session.editing, name, content, memberships, tagIds });
        } else {
          const similarity = diceSimilarity(session.editing.content, content);
          console.debug(`[reportsnips] edit similarity: ${similarity.toFixed(3)}`);
          setPendingEdit({ previous: session.editing, values, tagIds, similarity });
        }
      }
      await refreshBackupNudge();
    } catch (e: unknown) {
      setError(`Saving failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const finishEdit = async (choice: "update" | "new") => {
    const pending = pendingEdit;
    setPendingEdit(null);
    if (!pending) {
      return;
    }
    const draft = {
      name: pending.values.name,
      content: pending.values.content,
      memberships: pending.values.memberships,
      tagIds: pending.tagIds,
    };
    try {
      if (choice === "update") {
        await useSnippetStore.getState().updateWithHistory(pending.previous, draft);
      } else {
        await useSnippetStore.getState().saveAsNew(draft);
      }
      await refreshBackupNudge();
    } catch (e: unknown) {
      setError(`Saving failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (!initialized) {
    return (
      <div className={styles.loading}>
        {error ? (
          <MessageBar intent="error">{error}</MessageBar>
        ) : (
          <Spinner label="Loading ReportSnips…" />
        )}
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <Toaster />
      <div className={styles.header}>
        <LibrarySwitcher
          onExportAll={() => void onExport({})}
          onExportLibrary={(libraryId) => void onExport({ libraryIds: [libraryId] })}
          onImport={() => setImportOpen(true)}
        />
        <Button appearance="primary" icon={<Add16Regular />} onClick={() => void onSaveSelection()}>
          Save Selection
        </Button>
        {error && (
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
            <MessageBarActions
              containerAction={
                <Button
                  appearance="transparent"
                  icon={<Dismiss16Regular />}
                  aria-label="Dismiss"
                  onClick={() => setError(null)}
                />
              }
            />
          </MessageBar>
        )}
        {notice && (
          <MessageBar intent="success">
            <MessageBarBody>{notice}</MessageBarBody>
            <MessageBarActions
              containerAction={
                <Button
                  appearance="transparent"
                  icon={<Dismiss16Regular />}
                  aria-label="Dismiss"
                  onClick={() => setNotice(null)}
                />
              }
            />
          </MessageBar>
        )}
        {backupDue && !notice && (
          <MessageBar intent="info">
            <MessageBarBody>
              Your snippet library hasn&apos;t been backed up recently.
            </MessageBarBody>
            <MessageBarActions
              containerAction={
                <Button
                  appearance="transparent"
                  icon={<Dismiss16Regular />}
                  aria-label="Dismiss backup reminder"
                  onClick={() => setBackupDue(false)}
                />
              }
            >
              <Button appearance="secondary" size="small" onClick={() => void onExport({})}>
                Back up now
              </Button>
            </MessageBarActions>
          </MessageBar>
        )}
      </div>
      <SearchBox />
      <Divider className={styles.divider} />
      {searching ? (
        <div className={styles.content}>
          <TagFilterBar />
          <SearchResults
            onEdit={onEdit}
            onInsert={onInsert}
            onHistory={setHistoryFor}
            onMove={setMoveFor}
            onExport={(snippets) => void onExport({ snippetIds: snippets.map((s) => s.id) })}
          />
        </div>
      ) : (
        <>
          <TabList
            selectedValue={tab}
            onTabSelect={(_, data) => {
              const value = String(data.value);
              const known = ["browse", "queue", "placeholders", "tags", "settings", "help"];
              setTab(known.includes(value) ? (value as typeof tab) : "browse");
            }}
            size="small"
            className={styles.tabs}
          >
            <Tab value="browse">Browse</Tab>
            <Tab value="queue">
              Queue{" "}
              {queueBadge > 0 && <CounterBadge count={queueBadge} size="small" color="brand" />}
            </Tab>
            <Tab value="placeholders">Placeholders</Tab>
            <Tab value="tags">Tags</Tab>
            <Tab value="settings" aria-label="Settings" icon={<Settings20Regular />} />
            <Tab value="help" aria-label="Help" icon={<QuestionCircle20Regular />} />
          </TabList>
          <div className={styles.content}>
            {tab === "browse" ? (
              <>
                <TagFilterBar />
                <FolderTree />
                <SnippetList
                  onEdit={onEdit}
                  onInsert={onInsert}
                  onHistory={setHistoryFor}
                  onMove={setMoveFor}
                  onExport={(snippets) => void onExport({ snippetIds: snippets.map((s) => s.id) })}
                />
              </>
            ) : tab === "queue" ? (
              <QueueTab
                onInsert={onInsert}
                onGoToSnippet={onGoToSnippet}
                dragToDocEnabled={dragToDocEnabled}
              />
            ) : tab === "placeholders" ? (
              <PlaceholdersTab />
            ) : tab === "tags" ? (
              <TagManager />
            ) : tab === "settings" ? (
              <SettingsTab
                onExportAll={() => void onExport({})}
                onImport={() => setImportOpen(true)}
                onError={setError}
              />
            ) : (
              <HelpTab />
            )}
          </div>
        </>
      )}

      <PlaceholderDialog
        open={pendingInsert !== null}
        missing={pendingInsert?.missing ?? []}
        onSubmit={onPlaceholderSubmit}
        onCancel={() => setPendingInsert(null)}
      />

      {form && (
        <SnippetForm
          open
          mode={form.mode}
          initial={form.initial}
          libraries={libraries}
          allFolders={allFolders}
          onSave={(values) => void onFormSave(values)}
          onCancel={() => setForm(null)}
        />
      )}

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onError={setError}
        onDone={(result) => {
          const parts = [
            result.snippetsAdded > 0 && `${result.snippetsAdded} added`,
            result.snippetsUpdated > 0 && `${result.snippetsUpdated} updated`,
            result.snippetsCopied > 0 && `${result.snippetsCopied} imported as copies`,
            result.tagsAdded > 0 && `${result.tagsAdded} new tags`,
            result.librariesAdded > 0 && `${result.librariesAdded} new libraries`,
          ].filter(Boolean);
          setNotice(
            `Import complete: ${parts.length > 0 ? parts.join(", ") : "nothing to change"}.`
          );
          void refreshBackupNudge();
        }}
      />

      <MoveToDialog
        snippet={moveFor}
        onClose={() => setMoveFor(null)}
        onSave={(snippet, memberships) => {
          setMoveFor(null);
          void saveEdit({ ...snippet, memberships }).catch((e: unknown) =>
            setError(`Move failed: ${e instanceof Error ? e.message : String(e)}`)
          );
        }}
      />

      <HistoryDialog
        snippet={historyFor}
        onClose={() => setHistoryFor(null)}
        onRestore={(snippet, revisionIndex) => {
          setHistoryFor(null);
          useSnippetStore
            .getState()
            .restoreRevision(snippet, revisionIndex)
            .catch((e: unknown) =>
              setError(`Restore failed: ${e instanceof Error ? e.message : String(e)}`)
            );
        }}
      />

      <Dialog open={pendingEdit !== null} onOpenChange={(_, d) => !d.open && setPendingEdit(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Save changes</DialogTitle>
            <DialogContent>
              {pendingEdit && pendingEdit.similarity < SAVE_AS_NEW_THRESHOLD
                ? "This looks like a substantially different snippet. Save it as a new snippet, or update the existing one?"
                : "Update the existing snippet (keeping its last 3 versions in history), or save this as a new snippet?"}
            </DialogContent>
            <DialogActions>
              <Button
                appearance={
                  pendingEdit && pendingEdit.similarity < SAVE_AS_NEW_THRESHOLD
                    ? "secondary"
                    : "primary"
                }
                onClick={() => void finishEdit("update")}
              >
                Update Snippet
              </Button>
              <Button
                appearance={
                  pendingEdit && pendingEdit.similarity < SAVE_AS_NEW_THRESHOLD
                    ? "primary"
                    : "secondary"
                }
                onClick={() => void finishEdit("new")}
              >
                Save as New Snippet
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

export default App;
