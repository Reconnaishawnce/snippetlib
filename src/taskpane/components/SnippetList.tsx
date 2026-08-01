/** Browse list: snippets in the current scope/folder, with edit/delete (§9 M2). */
import * as React from "react";
import {
  Button,
  Caption1,
  Card,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { MoreHorizontal16Regular } from "@fluentui/react-icons";
import type { Snippet } from "../../models/entities";
import { useLibraryStore } from "../state/libraryStore";
import { useSnippetStore } from "../state/snippetStore";
import { ConfirmDialog } from "./dialogs";

const useStyles = makeStyles({
  list: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  card: {
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },
  name: {
    flexGrow: 1,
    fontWeight: tokens.fontWeightSemibold,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  preview: {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    color: tokens.colorNeutralForeground2,
    whiteSpace: "pre-wrap",
  },
  empty: {
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
    paddingTop: tokens.spacingVerticalXXL,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
  },
});

export interface SnippetListProps {
  onEdit: (snippet: Snippet) => void;
}

export const SnippetList: React.FC<SnippetListProps> = ({ onEdit }) => {
  const styles = useStyles();
  const { scope, selectedFolderId } = useLibraryStore();
  const snippets = useSnippetStore((s) => s.snippets);
  const remove = useSnippetStore((s) => s.remove);
  const [toDelete, setToDelete] = React.useState<Snippet | null>(null);

  const visible = React.useMemo(() => {
    let list = snippets;
    if (scope.kind === "library" && selectedFolderId !== null) {
      list = snippets.filter((snippet) =>
        snippet.memberships.some(
          (m) => m.libraryId === scope.libraryId && m.folderId === selectedFolderId
        )
      );
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [snippets, scope, selectedFolderId]);

  if (visible.length === 0) {
    return (
      <div className={styles.empty}>
        <Text>
          {scope.kind === "backlog"
            ? "The Unassigned Backlog is empty. Snippets land here when they have no library."
            : "No snippets here yet. Select text in your report and click Save Selection."}
        </Text>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {visible.map((snippet) => (
        <Card key={snippet.id} className={styles.card} size="small">
          <div className={styles.header}>
            <span className={styles.name}>{snippet.name}</span>
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button
                  appearance="transparent"
                  size="small"
                  icon={<MoreHorizontal16Regular />}
                  aria-label={`Actions for ${snippet.name}`}
                />
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItem onClick={() => onEdit(snippet)}>Edit…</MenuItem>
                  <MenuItem onClick={() => setToDelete(snippet)}>Delete…</MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
          </div>
          {/* Snippet content is untrusted plain text — React text nodes only, never HTML. */}
          <Text size={200} className={styles.preview}>
            {snippet.content}
          </Text>
          <Caption1>
            {snippet.memberships.length === 0
              ? "Unassigned Backlog"
              : `In ${snippet.memberships.length} ${snippet.memberships.length === 1 ? "location" : "locations"}`}
          </Caption1>
        </Card>
      ))}

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete snippet "${toDelete?.name ?? ""}"?`}
        message="This deletes the snippet from every library it belongs to. This cannot be undone."
        confirmLabel="Delete snippet"
        onConfirm={() => {
          if (toDelete) {
            void remove(toDelete.id);
          }
          setToDelete(null);
        }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
};
