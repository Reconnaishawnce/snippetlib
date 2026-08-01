import * as React from "react";
import {
  Button,
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
import { getSelectedText } from "../../office/documentIO";
import { useLibraryStore } from "../state/libraryStore";
import { useSearchStore } from "../state/searchStore";
import { useSnippetStore } from "../state/snippetStore";
import { useTagStore } from "../state/tagStore";
import { deriveDefaultName } from "../state/snippetName";
import { getStorage } from "../state/storage";
import { LibrarySwitcher } from "./LibrarySwitcher";
import { FolderTree } from "./FolderTree";
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
  const [tab, setTab] = React.useState<"browse" | "tags">("browse");
  const searchQuery = useSearchStore((s) => s.query);
  const searching = searchQuery.trim().length > 0;

  React.useEffect(() => {
    init().catch((e: unknown) => {
      setError(`Storage failed to open: ${e instanceof Error ? e.message : String(e)}`);
    });
  }, [init]);

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
          <SearchResults onEdit={onEdit} />
        </div>
      ) : (
        <>
          <TabList
            selectedValue={tab}
            onTabSelect={(_, data) => setTab(data.value === "tags" ? "tags" : "browse")}
            size="small"
          >
            <Tab value="browse">Browse</Tab>
            <Tab value="tags">Tags</Tab>
          </TabList>
          <div className={styles.content}>
            {tab === "browse" ? (
              <>
                <TagFilterBar />
                <FolderTree />
                <SnippetList onEdit={onEdit} />
              </>
            ) : (
              <TagManager />
            )}
          </div>
        </>
      )}

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
