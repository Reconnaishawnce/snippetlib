/** Browse list: snippets in the current scope/folder, with edit/delete (§9 M2). */
import * as React from "react";
import {
  Button,
  Caption1,
  Card,
  Checkbox,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Text,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { MoreHorizontal16Regular, TextAdd20Regular } from "@fluentui/react-icons";
import type { Snippet } from "../../models/entities";
import { useLibraryStore } from "../state/libraryStore";
import { useSearchStore } from "../state/searchStore";
import { useSnippetStore } from "../state/snippetStore";
import { useTagStore } from "../state/tagStore";
import { AddToQueueMenuItem } from "./AddToQueueMenuItem";
import { ConfirmDialog } from "./dialogs";
import { SelectionHeader } from "./SelectionHeader";
import { Tag } from "@fluentui/react-components";

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
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalXXS,
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
  /** Insert one or more snippets at the cursor, in list order (§7.5, M4). */
  onInsert: (snippets: Snippet[]) => void;
}

export const SnippetList: React.FC<SnippetListProps> = ({ onEdit, onInsert }) => {
  const styles = useStyles();
  const { scope, selectedFolderId } = useLibraryStore();
  const snippets = useSnippetStore((s) => s.snippets);
  const remove = useSnippetStore((s) => s.remove);
  const filterTagIds = useSearchStore((s) => s.filterTagIds);
  const tags = useTagStore((s) => s.tags);
  const [toDelete, setToDelete] = React.useState<Snippet | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const visible = React.useMemo(() => {
    let list = snippets;
    if (scope.kind === "library" && selectedFolderId !== null) {
      list = snippets.filter((snippet) =>
        snippet.memberships.some(
          (m) => m.libraryId === scope.libraryId && m.folderId === selectedFolderId
        )
      );
    }
    // Multi-tag filter, AND semantics (§7.4).
    list = list.filter((snippet) => filterTagIds.every((tagId) => snippet.tagIds.includes(tagId)));
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [snippets, scope, selectedFolderId, filterTagIds]);

  const tagsById = React.useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

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

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const insertSelected = () => {
    const chosen = visible.filter((s) => selectedIds.has(s.id));
    setSelectedIds(new Set());
    onInsert(chosen);
  };

  return (
    <div className={styles.list}>
      <SelectionHeader
        count={selectedIds.size}
        onInsertAll={insertSelected}
        onClear={() => setSelectedIds(new Set())}
      />
      {visible.map((snippet) => (
        <Card key={snippet.id} className={styles.card} size="small">
          <div className={styles.header}>
            <Checkbox
              checked={selectedIds.has(snippet.id)}
              onChange={(_, data) => toggleSelected(snippet.id, Boolean(data.checked))}
              aria-label={`Select ${snippet.name}`}
            />
            <span className={styles.name}>{snippet.name}</span>
            <Tooltip content="Insert at cursor" relationship="label">
              <Button
                appearance="subtle"
                size="small"
                icon={<TextAdd20Regular />}
                aria-label={`Insert ${snippet.name}`}
                onClick={() => onInsert([snippet])}
              />
            </Tooltip>
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
                  <AddToQueueMenuItem snippetId={snippet.id} />
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
          {snippet.tagIds.length > 0 && (
            <span className={styles.chips}>
              {snippet.tagIds.map((tagId) => {
                const tag = tagsById.get(tagId);
                return tag ? (
                  <Tag key={tagId} size="extra-small" appearance="outline">
                    {tag.name}
                  </Tag>
                ) : null;
              })}
            </span>
          )}
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
