import * as React from "react";
import {
  Button,
  CounterBadge,
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
import { Add16Regular, Dismiss16Regular } from "@fluentui/react-icons";
import type { Folder, Snippet } from "../../models/entities";
import { getSelectedText, insertText } from "../../office/documentIO";
import type { ParsedPlaceholder } from "../../office/placeholderEngine";
import { useLibraryStore } from "../state/libraryStore";
import { usePlaceholderStore } from "../state/placeholderStore";
import { useQueueStore } from "../state/queueStore";
import { useSearchStore } from "../state/searchStore";
import { useSnippetStore } from "../state/snippetStore";
import { useTagStore } from "../state/tagStore";
import { buildInsertText, planInsert } from "../state/insertFlow";
import { unInsertedCount } from "../state/queueOps";
import { deriveDefaultName } from "../state/snippetName";
import { getStorage } from "../state/storage";
import { LibrarySwitcher } from "./LibrarySwitcher";
import { FolderTree } from "./FolderTree";
import { PlaceholderDialog } from "./PlaceholderDialog";
import { PlaceholdersTab } from "./PlaceholdersTab";
import { QueueTab } from "./QueueTab";
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
  const [tab, setTab] = React.useState<"browse" | "queue" | "placeholders" | "tags">("browse");
  const searchQuery = useSearchStore((s) => s.query);
  const searching = searchQuery.trim().length > 0;
  const queue = useQueueStore((s) => s.queue);
  const queueBadge = unInsertedCount(queue);
  const [dragToDocEnabled, setDragToDocEnabled] = React.useState(false);
  const [pendingInsert, setPendingInsert] = React.useState<{
    snippets: Snippet[];
    missing: ParsedPlaceholder[];
    onDone?: () => void;
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
    getStorage()
      .getPrefs()
      .then((p) => setDragToDocEnabled(p.enableDocDragDrop))
      .catch(() => setDragToDocEnabled(false));
  }, [init]);

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
        await saveEdit({ ...session.editing, name, content, memberships, tagIds });
      }
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
        <LibrarySwitcher />
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
      </div>
      <SearchBox />
      <Divider className={styles.divider} />
      {searching ? (
        <div className={styles.content}>
          <TagFilterBar />
          <SearchResults onEdit={onEdit} onInsert={onInsert} />
        </div>
      ) : (
        <>
          <TabList
            selectedValue={tab}
            onTabSelect={(_, data) => {
              const value = String(data.value);
              setTab(
                value === "tags" || value === "placeholders" || value === "queue"
                  ? (value as "queue" | "placeholders" | "tags")
                  : "browse"
              );
            }}
            size="small"
          >
            <Tab value="browse">Browse</Tab>
            <Tab value="queue">
              Queue{" "}
              {queueBadge > 0 && <CounterBadge count={queueBadge} size="small" color="brand" />}
            </Tab>
            <Tab value="placeholders">Placeholders</Tab>
            <Tab value="tags">Tags</Tab>
          </TabList>
          <div className={styles.content}>
            {tab === "browse" ? (
              <>
                <TagFilterBar />
                <FolderTree />
                <SnippetList onEdit={onEdit} onInsert={onInsert} />
              </>
            ) : tab === "queue" ? (
              <QueueTab
                onInsert={onInsert}
                onGoToSnippet={onGoToSnippet}
                dragToDocEnabled={dragToDocEnabled}
              />
            ) : tab === "placeholders" ? (
              <PlaceholdersTab />
            ) : (
              <TagManager />
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
    </div>
  );
};

export default App;
