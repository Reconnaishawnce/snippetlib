/** The Queue tab (§7.7): hunt snippets up front, then insert top-to-bottom. */
import * as React from "react";
import {
  Button,
  Caption1,
  Menu,
  MenuItem,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Text,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import {
  Add16Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
  MoreHorizontal16Regular,
  ReOrderDotsVertical16Regular,
  TextAdd20Regular,
} from "@fluentui/react-icons";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { QueueSection, QueueTemplate, SectionLayout, Snippet } from "../../models/entities";
import { DEFAULT_SECTION_LAYOUT } from "../state/reportPlan";
import { resolveContent } from "../../office/placeholderEngine";
import { usePlaceholderStore } from "../state/placeholderStore";
import { useQueueStore } from "../state/queueStore";
import { displaySections } from "../state/queueOps";
import { getStorage } from "../state/storage";
import { NameDialog, ConfirmDialog } from "./dialogs";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXXS,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    paddingRight: tokens.spacingHorizontalXS,
  },
  sectionName: {
    flexGrow: 1,
    fontWeight: tokens.fontWeightSemibold,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXXS,
    paddingTop: "2px",
    paddingBottom: "2px",
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalXS,
    borderRadius: tokens.borderRadiusMedium,
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  itemName: {
    flexGrow: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: tokens.fontSizeBase300,
  },
  inserted: {
    opacity: 0.55,
    textDecorationLine: "line-through",
  },
  dropTarget: {
    outlineWidth: "1px",
    outlineStyle: "dashed",
    outlineColor: tokens.colorBrandStroke1,
  },
  grip: {
    cursor: "grab",
    color: tokens.colorNeutralForeground3,
    display: "flex",
    alignItems: "center",
  },
  preview: {
    maxWidth: "280px",
    maxHeight: "300px",
    overflowY: "auto",
    whiteSpace: "pre-wrap",
  },
  empty: {
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
    paddingTop: tokens.spacingVerticalXXL,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
  },
  generateRow: {
    display: "flex",
    justifyContent: "flex-end",
    gap: tokens.spacingHorizontalS,
  },
  addSectionRow: {
    display: "flex",
    justifyContent: "flex-start",
  },
});

export interface QueueTabProps {
  /** Insert snippets at the cursor; onDone fires only after a successful insert. */
  onInsert: (snippets: Snippet[], onDone?: () => void) => void;
  onGoToSnippet: (snippet: Snippet) => void;
  dragToDocEnabled: boolean;
  /** Report builder v1: fill every {{Section}} marker in the document. */
  onGenerateReport: () => void;
  /** Report builder v2: the drag-and-drop outline window. */
  onOpenBuilder: () => void;
}

interface ItemRowProps extends QueueTabProps {
  section: QueueSection;
  itemId: string;
  snippet: Snippet | undefined;
  inserted: boolean;
}

const ItemRow: React.FC<ItemRowProps> = (props) => {
  const styles = useStyles();
  const { removeItem, markInserted } = useQueueStore();
  const values = usePlaceholderStore((s) => s.values);
  const { setNodeRef: setDragRef, attributes, listeners } = useDraggable({ id: props.itemId });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: props.itemId });

  const snippet = props.snippet;

  // Native drag into the document (§7.7, feature-flagged): plain text with
  // known placeholders resolved; unknown ones stay as tokens — no dialog can
  // interrupt a native drag.
  const onNativeDragStart = (e: React.DragEvent) => {
    if (snippet) {
      e.dataTransfer.setData("text/plain", resolveContent(snippet.content, values).text);
      e.dataTransfer.effectAllowed = "copy";
    }
  };

  return (
    <div
      ref={(el) => {
        setDragRef(el);
        setDropRef(el);
      }}
      className={mergeClasses(styles.item, isOver && styles.dropTarget)}
      {...attributes}
      {...listeners}
    >
      {props.dragToDocEnabled && snippet && !props.inserted && (
        <Tooltip content="Drag into your document" relationship="label">
          <span
            className={styles.grip}
            draggable
            onDragStart={onNativeDragStart}
            // Keep dnd-kit from hijacking the native HTML5 drag.
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ReOrderDotsVertical16Regular />
          </span>
        </Tooltip>
      )}
      <span
        className={mergeClasses(styles.itemName, props.inserted && styles.inserted)}
        title={snippet?.name}
      >
        {snippet ? snippet.name : "(snippet deleted)"}
      </span>
      {snippet && (
        <Tooltip content="Insert at cursor" relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<TextAdd20Regular />}
            aria-label={`Insert ${snippet.name}`}
            onClick={() => props.onInsert([snippet], () => markInserted([props.itemId]))}
          />
        </Tooltip>
      )}
      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <Button
            appearance="transparent"
            size="small"
            icon={<MoreHorizontal16Regular />}
            aria-label="Queue item actions"
          />
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            {snippet && (
              <Popover withArrow>
                <PopoverTrigger disableButtonEnhancement>
                  <MenuItem>Preview</MenuItem>
                </PopoverTrigger>
                <PopoverSurface>
                  <Text size={200} className={styles.preview} block>
                    {snippet.content}
                  </Text>
                </PopoverSurface>
              </Popover>
            )}
            {snippet && (
              <MenuItem onClick={() => props.onGoToSnippet(snippet)}>Go to snippet</MenuItem>
            )}
            <MenuItem onClick={() => removeItem(props.itemId)}>Remove from queue</MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
    </div>
  );
};

export const QueueTab: React.FC<QueueTabProps> = (props) => {
  const styles = useStyles();
  const queue = useQueueStore((s) => s.queue);
  const { addSection, renameSection, deleteSection, clearInserted, markInserted, moveItem } =
    useQueueStore();
  const setSectionLayout = useQueueStore((s) => s.setSectionLayout);
  const saveAsTemplate = useQueueStore((s) => s.saveAsTemplate);
  const loadTemplate = useQueueStore((s) => s.loadTemplate);
  const [templates, setTemplates] = React.useState<QueueTemplate[]>([]);
  const [snippetsById, setSnippetsById] = React.useState<Map<string, Snippet>>(new Map());
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [dialog, setDialog] = React.useState<
    | { kind: "add" }
    | { kind: "rename"; sectionId: string }
    | { kind: "delete"; sectionId: string }
    | { kind: "saveTemplate" }
    | null
  >(null);

  const refreshTemplates = React.useCallback(async () => {
    try {
      setTemplates(await getStorage().getAllQueueTemplates());
    } catch {
      setTemplates([]);
    }
  }, []);
  React.useEffect(() => {
    void refreshTemplates();
  }, [refreshTemplates]);

  const sections = displaySections(queue);

  // Clicks on buttons inside draggable rows must not start drags (see FolderTree).
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const storage = getStorage();
      const ids = [...new Set(sections.flatMap((s) => s.items.map((i) => i.snippetId)))];
      const loaded = await Promise.all(ids.map((id) => storage.getSnippet(id)));
      if (!cancelled) {
        const map = new Map<string, Snippet>();
        for (const snippet of loaded) {
          if (snippet) {
            map.set(snippet.id, snippet);
          }
        }
        setSnippetsById(map);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  const onDragEnd = (event: DragEndEvent) => {
    const dragId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || dragId === overId) {
      return;
    }
    // Drop on a section header = append to that section; drop on an item =
    // take that item's position in its section.
    const asSection = queue.sections.find((s) => s.id === overId);
    if (asSection) {
      moveItem(dragId, asSection.id, asSection.items.length);
      return;
    }
    for (const section of queue.sections) {
      const index = section.items.findIndex((i) => i.id === overId);
      if (index !== -1) {
        moveItem(dragId, section.id, index);
        return;
      }
    }
  };

  const templatesMenu = (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Button appearance="subtle" size="small">
          Templates
        </Button>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          <MenuItem
            disabled={sections.every((s) => s.items.length === 0)}
            onClick={() => setDialog({ kind: "saveTemplate" })}
          >
            Save queue as template…
          </MenuItem>
          {templates.map((template) => (
            <MenuItem key={template.id} onClick={() => loadTemplate(template)}>
              Load &ldquo;{template.name}&rdquo;
            </MenuItem>
          ))}
          {templates.length > 0 && (
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <MenuItem>Delete template</MenuItem>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {templates.map((template) => (
                    <MenuItem
                      key={template.id}
                      onClick={() =>
                        void getStorage().deleteQueueTemplate(template.id).then(refreshTemplates)
                      }
                    >
                      {template.name}
                    </MenuItem>
                  ))}
                </MenuList>
              </MenuPopover>
            </Menu>
          )}
        </MenuList>
      </MenuPopover>
    </Menu>
  );

  const dialogSection =
    dialog && "sectionId" in dialog
      ? queue.sections.find((s) => s.id === dialog.sectionId)
      : undefined;

  if (sections.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>
          <Text>
            The Queue is your staging list: hunt down the snippets you need up front, then work
            through the document top to bottom inserting them. Use &ldquo;Add to Queue&rdquo; on any
            snippet.
          </Text>
        </div>
        <div className={styles.addSectionRow}>
          <Button
            appearance="subtle"
            size="small"
            icon={<Add16Regular />}
            onClick={() => setDialog({ kind: "add" })}
          >
            Add section
          </Button>
          {templates.length > 0 && templatesMenu}
          <Button appearance="secondary" size="small" onClick={props.onOpenBuilder}>
            Builder…
          </Button>
        </div>
        <NameDialog
          open={dialog?.kind === "add"}
          title="New section"
          label="Section name"
          submitLabel="Create"
          onSubmit={(name) => {
            setDialog(null);
            addSection(name);
          }}
          onCancel={() => setDialog(null)}
        />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className={styles.root}>
        <div className={styles.generateRow}>
          <Tooltip
            content="Build the outline in a big drag-and-drop window"
            relationship="description"
          >
            <Button appearance="secondary" size="small" onClick={props.onOpenBuilder}>
              Builder…
            </Button>
          </Tooltip>
          <Tooltip
            content="Replace each {{Section Name}} marker in your document with that section's snippets"
            relationship="description"
          >
            <Button appearance="primary" size="small" onClick={props.onGenerateReport}>
              Generate report
            </Button>
          </Tooltip>
        </div>
        {sections.map((section) => {
          const isCollapsed = collapsed.has(section.id);
          const unInserted = section.items.filter((i) => !i.inserted);
          const hasInserted = section.items.some((i) => i.inserted);
          return (
            <SectionBlock
              key={section.id}
              section={section}
              collapsed={isCollapsed}
              onToggle={() =>
                setCollapsed((prev) => {
                  const next = new Set(prev);
                  if (next.has(section.id)) {
                    next.delete(section.id);
                  } else {
                    next.add(section.id);
                  }
                  return next;
                })
              }
              onInsertAll={() => {
                const snippets = unInserted
                  .map((i) => snippetsById.get(i.snippetId))
                  .filter((s): s is Snippet => Boolean(s));
                const itemIds = unInserted
                  .filter((i) => snippetsById.has(i.snippetId))
                  .map((i) => i.id);
                if (snippets.length > 0) {
                  props.onInsert(snippets, () => markInserted(itemIds));
                }
              }}
              canInsertAll={unInserted.some((i) => snippetsById.has(i.snippetId))}
              hasInserted={hasInserted}
              onClearInserted={() => clearInserted(section.id)}
              onRename={() => setDialog({ kind: "rename", sectionId: section.id })}
              onDelete={() => setDialog({ kind: "delete", sectionId: section.id })}
              onSetLayout={(layout) => setSectionLayout(section.id, layout)}
            >
              {!isCollapsed &&
                section.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    {...props}
                    section={section}
                    itemId={item.id}
                    snippet={snippetsById.get(item.snippetId)}
                    inserted={item.inserted}
                  />
                ))}
            </SectionBlock>
          );
        })}
        <div className={styles.addSectionRow}>
          <Button
            appearance="subtle"
            size="small"
            icon={<Add16Regular />}
            onClick={() => setDialog({ kind: "add" })}
          >
            Add section
          </Button>
          {templatesMenu}
        </div>

        <NameDialog
          open={dialog?.kind === "saveTemplate"}
          title="Save queue as template"
          label="Template name"
          submitLabel="Save template"
          onSubmit={(name) => {
            setDialog(null);
            void saveAsTemplate(name).then(refreshTemplates);
          }}
          onCancel={() => setDialog(null)}
        />
        <NameDialog
          open={dialog?.kind === "add"}
          title="New section"
          label="Section name"
          submitLabel="Create"
          onSubmit={(name) => {
            setDialog(null);
            addSection(name);
          }}
          onCancel={() => setDialog(null)}
        />
        <NameDialog
          open={dialog?.kind === "rename"}
          title="Rename section"
          label="Section name"
          initialValue={dialogSection?.name}
          submitLabel="Rename"
          onSubmit={(name) => {
            setDialog(null);
            if (dialogSection) {
              renameSection(dialogSection.id, name);
            }
          }}
          onCancel={() => setDialog(null)}
        />
        <ConfirmDialog
          open={dialog?.kind === "delete"}
          title={`Delete section "${dialogSection?.name ?? ""}"?`}
          message="Queued snippets in this section are not lost — they move to the first remaining section."
          confirmLabel="Delete section"
          onConfirm={() => {
            setDialog(null);
            if (dialogSection) {
              deleteSection(dialogSection.id);
            }
          }}
          onCancel={() => setDialog(null)}
        />
      </div>
    </DndContext>
  );
};

interface SectionBlockProps {
  section: QueueSection;
  collapsed: boolean;
  canInsertAll: boolean;
  hasInserted: boolean;
  onToggle: () => void;
  onInsertAll: () => void;
  onClearInserted: () => void;
  onRename: () => void;
  onDelete: () => void;
  onSetLayout: (layout: SectionLayout) => void;
  children: React.ReactNode;
}

const SectionBlock: React.FC<SectionBlockProps> = (props) => {
  const styles = useStyles();
  const { setNodeRef, isOver } = useDroppable({ id: props.section.id });
  const unInserted = props.section.items.filter((i) => !i.inserted).length;
  return (
    <div>
      <div
        ref={setNodeRef}
        className={mergeClasses(styles.sectionHeader, isOver && styles.dropTarget)}
      >
        <Button
          appearance="transparent"
          size="small"
          icon={props.collapsed ? <ChevronRight16Regular /> : <ChevronDown16Regular />}
          onClick={props.onToggle}
          aria-label={props.collapsed ? "Expand section" : "Collapse section"}
        />
        <span className={styles.sectionName}>{props.section.name}</span>
        <Caption1>{unInserted} to insert</Caption1>
        <Tooltip content="Insert all remaining, top to bottom" relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<TextAdd20Regular />}
            disabled={!props.canInsertAll}
            aria-label={`Insert all in ${props.section.name}`}
            onClick={props.onInsertAll}
          />
        </Tooltip>
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button
              appearance="transparent"
              size="small"
              icon={<MoreHorizontal16Regular />}
              aria-label={`Actions for section ${props.section.name}`}
            />
          </MenuTrigger>
          <MenuPopover>
            <MenuList
              checkedValues={{ layout: [props.section.layout ?? DEFAULT_SECTION_LAYOUT] }}
              onCheckedValueChange={(_, data) => {
                const layout = data.checkedItems[0] as SectionLayout | undefined;
                if (layout) {
                  props.onSetLayout(layout);
                }
              }}
            >
              <MenuItem onClick={props.onRename}>Rename…</MenuItem>
              <MenuItem disabled={!props.hasInserted} onClick={props.onClearInserted}>
                Clear inserted
              </MenuItem>
              <MenuItemRadio name="layout" value="table">
                Report layout: table (name | content)
              </MenuItemRadio>
              <MenuItemRadio name="layout" value="paragraphs">
                Report layout: paragraphs
              </MenuItemRadio>
              <MenuItem onClick={props.onDelete}>Delete…</MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
      </div>
      {props.children}
    </div>
  );
};
