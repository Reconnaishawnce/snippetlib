/** Folder tree with drag re-parenting, counts, and CRUD (§7.2). */
import * as React from "react";
import {
  Badge,
  Button,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Toast,
  ToastTitle,
  makeStyles,
  mergeClasses,
  tokens,
  useToastController,
} from "@fluentui/react-components";
import {
  ChevronDown16Regular,
  ChevronRight16Regular,
  Folder16Regular,
  Library16Regular,
  MoreHorizontal16Regular,
} from "@fluentui/react-icons";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { useLibraryStore } from "../state/libraryStore";
import { useSnippetStore } from "../state/snippetStore";
import {
  FOLDER_DEPTH_WARNING,
  buildFolderTree,
  folderDepth,
  isSelfOrDescendant,
  recursiveSnippetCounts,
  type FolderNode,
} from "../state/folderTreeUtils";
import { NameDialog, ConfirmDialog } from "./dialogs";

const ROOT_DROP_ID = "__root__";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: "1px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXXS,
    paddingTop: "2px",
    paddingBottom: "2px",
    paddingRight: tokens.spacingHorizontalXS,
    borderRadius: tokens.borderRadiusMedium,
    cursor: "pointer",
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  selected: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
    fontWeight: tokens.fontWeightSemibold,
  },
  dropTarget: {
    outlineWidth: "1px",
    outlineStyle: "dashed",
    outlineColor: tokens.colorBrandStroke1,
  },
  name: {
    flexGrow: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: tokens.fontSizeBase300,
  },
  chevronSpacer: { width: "20px", flexShrink: 0 },
});

interface RowProps {
  node: FolderNode;
  depth: number;
  onAction: (action: "new-child" | "rename" | "delete", folderId: string) => void;
}

const FolderRow: React.FC<RowProps> = ({ node, depth, onAction }) => {
  const styles = useStyles();
  const { selectedFolderId, selectFolder, folders } = useLibraryStore();
  const scope = useLibraryStore((s) => s.scope);
  const snippets = useSnippetStore((s) => s.snippets);
  const [expanded, setExpanded] = React.useState(true);

  const { setNodeRef: setDragRef, attributes, listeners } = useDraggable({ id: node.folder.id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: node.folder.id });

  const counts = React.useMemo(
    () =>
      scope.kind === "library"
        ? recursiveSnippetCounts(folders, snippets, scope.libraryId)
        : new Map<string, number>(),
    [folders, snippets, scope]
  );
  const count = counts.get(node.folder.id) ?? 0;

  return (
    <>
      <div
        ref={(el) => {
          setDragRef(el);
          setDropRef(el);
        }}
        className={mergeClasses(
          styles.row,
          selectedFolderId === node.folder.id && styles.selected,
          isOver && styles.dropTarget
        )}
        style={{ paddingLeft: `${depth * 14}px` }}
        onClick={() => selectFolder(node.folder.id)}
        {...attributes}
        {...listeners}
      >
        {node.children.length > 0 ? (
          <Button
            appearance="transparent"
            size="small"
            icon={expanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            aria-label={expanded ? "Collapse" : "Expand"}
          />
        ) : (
          <span className={styles.chevronSpacer} />
        )}
        <Folder16Regular />
        <span className={styles.name}>{node.folder.name}</span>
        {count > 0 && (
          <Badge appearance="tint" color="informative" size="small">
            {count}
          </Badge>
        )}
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button
              appearance="transparent"
              size="small"
              icon={<MoreHorizontal16Regular />}
              aria-label={`Actions for ${node.folder.name}`}
              onClick={(e) => e.stopPropagation()}
            />
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem onClick={() => onAction("new-child", node.folder.id)}>
                New subfolder…
              </MenuItem>
              <MenuItem onClick={() => onAction("rename", node.folder.id)}>Rename…</MenuItem>
              <MenuItem onClick={() => onAction("delete", node.folder.id)}>Delete…</MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
      </div>
      {expanded &&
        node.children.map((child) => (
          <FolderRow key={child.folder.id} node={child} depth={depth + 1} onAction={onAction} />
        ))}
    </>
  );
};

export const FolderTree: React.FC = () => {
  const styles = useStyles();
  const {
    scope,
    folders,
    selectedFolderId,
    selectFolder,
    createFolder,
    renameFolder,
    deleteFolder,
    moveFolder,
  } = useLibraryStore();
  const { dispatchToast } = useToastController();
  const [dialog, setDialog] = React.useState<{
    kind: "new-child" | "rename" | "delete";
    folderId: string | null;
  } | null>(null);

  const { setNodeRef: setRootDropRef, isOver: overRoot } = useDroppable({ id: ROOT_DROP_ID });

  if (scope.kind !== "library") {
    return null;
  }

  const tree = buildFolderTree(folders);
  const dialogFolder = folders.find((f) => f.id === dialog?.folderId);

  const warnDepth = (parentId: string | null) => {
    if (folderDepth(folders, parentId) + 1 > FOLDER_DEPTH_WARNING) {
      dispatchToast(
        <Toast>
          <ToastTitle>
            That folder is more than {FOLDER_DEPTH_WARNING} levels deep — deep trees get hard to
            browse.
          </ToastTitle>
        </Toast>,
        { intent: "warning" }
      );
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    const dragId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (overId === null || dragId === overId) {
      return;
    }
    const newParentId = overId === ROOT_DROP_ID ? null : overId;
    // Never drop a folder into itself or its own subtree.
    if (newParentId !== null && isSelfOrDescendant(folders, dragId, newParentId)) {
      return;
    }
    warnDepth(newParentId);
    void moveFolder(dragId, newParentId);
  };

  return (
    <DndContext onDragEnd={onDragEnd}>
      <div className={styles.root}>
        <div
          ref={setRootDropRef}
          className={mergeClasses(
            styles.row,
            selectedFolderId === null && styles.selected,
            overRoot && styles.dropTarget
          )}
          onClick={() => selectFolder(null)}
        >
          <span className={styles.chevronSpacer} />
          <Library16Regular />
          <span className={styles.name}>All snippets</span>
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button
                appearance="transparent"
                size="small"
                icon={<MoreHorizontal16Regular />}
                aria-label="Library folder actions"
                onClick={(e) => e.stopPropagation()}
              />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem onClick={() => setDialog({ kind: "new-child", folderId: null })}>
                  New folder…
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>
        {tree.map((node) => (
          <FolderRow
            key={node.folder.id}
            node={node}
            depth={1}
            onAction={(kind, folderId) => setDialog({ kind, folderId })}
          />
        ))}
      </div>

      <NameDialog
        open={dialog?.kind === "new-child"}
        title="New folder"
        label="Folder name"
        submitLabel="Create"
        onSubmit={(name) => {
          const parentId = dialog?.folderId ?? null;
          setDialog(null);
          warnDepth(parentId);
          void createFolder(parentId, name);
        }}
        onCancel={() => setDialog(null)}
      />
      <NameDialog
        open={dialog?.kind === "rename"}
        title="Rename folder"
        label="Folder name"
        initialValue={dialogFolder?.name}
        submitLabel="Rename"
        onSubmit={(name) => {
          setDialog(null);
          if (dialogFolder) {
            void renameFolder(dialogFolder.id, name);
          }
        }}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog?.kind === "delete"}
        title={`Delete folder "${dialogFolder?.name ?? ""}"?`}
        message="Subfolders and snippets inside it are not deleted — they move up to the parent folder."
        confirmLabel="Delete folder"
        onConfirm={() => {
          setDialog(null);
          if (dialogFolder) {
            void deleteFolder(dialogFolder.id);
          }
        }}
        onCancel={() => setDialog(null)}
      />
    </DndContext>
  );
};
