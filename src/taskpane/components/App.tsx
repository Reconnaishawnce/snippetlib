import * as React from "react";
import {
  Button,
  Divider,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Spinner,
  Toaster,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { Add16Regular, Dismiss16Regular } from "@fluentui/react-icons";
import type { Folder, Snippet } from "../../models/entities";
import { getSelectedText } from "../../office/documentIO";
import { useLibraryStore } from "../state/libraryStore";
import { useSnippetStore } from "../state/snippetStore";
import { deriveDefaultName } from "../state/snippetName";
import { getStorage } from "../state/storage";
import { LibrarySwitcher } from "./LibrarySwitcher";
import { FolderTree } from "./FolderTree";
import { SnippetList } from "./SnippetList";
import { SnippetForm, type SnippetFormValues } from "./SnippetForm";

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
      },
    });
  };

  const onEdit = (snippet: Snippet) => {
    void openForm({
      mode: "edit",
      editing: snippet,
      initial: { name: snippet.name, content: snippet.content, memberships: snippet.memberships },
    });
  };

  const onFormSave = async (values: SnippetFormValues) => {
    const session = form;
    setForm(null);
    if (!session) {
      return;
    }
    try {
      if (session.mode === "create") {
        await saveNew({ ...values, tagIds: [] });
      } else if (session.editing) {
        await saveEdit({ ...session.editing, ...values });
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
      <Divider className={styles.divider} />
      <div className={styles.content}>
        <FolderTree />
        <SnippetList onEdit={onEdit} />
      </div>

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
