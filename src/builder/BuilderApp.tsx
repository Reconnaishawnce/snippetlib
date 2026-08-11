/**
 * The report-builder dialog (report builder v2, owner-directed): outline on
 * the left (loadable from saved queue templates), the snippet library on the
 * right (library/folder browse + search), drag or Add snippets into sections.
 * "Save to queue" hands the outline back to the pane via dialog messaging.
 */
/* global window */
import * as React from "react";
import {
  Button,
  Caption1,
  Card,
  Dropdown,
  Input,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Option,
  Text,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import {
  Add16Regular,
  ArrowDown16Regular,
  ArrowUp16Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
  Delete16Regular,
  Dismiss16Regular,
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
import type {
  BuilderSection,
  Folder,
  Library,
  QueueTemplate,
  SectionLayout,
  Snippet,
} from "../models/entities";
import { queueStateSchema } from "../models/schemas";
import { sendBuilderMessage } from "../office/documentIO";
import { getStorage } from "../taskpane/state/storage";
import { subtreeFolderIds } from "../taskpane/state/folderTreeUtils";
import { DEFAULT_SECTION_LAYOUT } from "../taskpane/state/reportPlan";

const useStyles = makeStyles({
  root: {
    display: "grid",
    gridTemplateRows: "1fr auto",
    height: "100%",
    boxSizing: "border-box",
    // Long snippet content must never widen the window.
    overflowX: "hidden",
  },
  columns: {
    display: "grid",
    // minmax(0, …) so content can't force a column (and the window) wider.
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingHorizontalM,
    minHeight: 0,
    maxWidth: "1100px",
    width: "100%",
    boxSizing: "border-box",
    marginLeft: "auto",
    marginRight: "auto",
  },
  column: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    minHeight: 0,
    minWidth: 0,
  },
  columnScroll: {
    overflowY: "auto",
    overflowX: "hidden",
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    paddingRight: tokens.spacingHorizontalXS,
    minWidth: 0,
  },
  columnTitle: {
    fontWeight: tokens.fontWeightSemibold,
  },
  section: {
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
  },
  sectionDrop: {
    outlineWidth: "2px",
    outlineStyle: "dashed",
    outlineColor: tokens.colorBrandStroke1,
  },
  sectionHead: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  sectionName: {
    flexGrow: 1,
  },
  layoutDrop: {
    minWidth: "130px",
  },
  itemRow: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    paddingLeft: tokens.spacingHorizontalS,
  },
  itemName: {
    flexGrow: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  snippetCard: {
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    cursor: "grab",
    minWidth: 0,
    overflow: "hidden",
  },
  snippetHead: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  snippetName: {
    flexGrow: 1,
    fontWeight: tokens.fontWeightSemibold,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  snippetPreview: {
    // Wrap up to two lines, then clamp — long unbroken strings break anywhere.
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
    color: tokens.colorNeutralForeground2,
  },
  folderRow: {
    display: "flex",
    alignItems: "center",
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingHorizontalM,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: tokens.colorNeutralStroke2,
  },
  hint: {
    color: tokens.colorNeutralForeground3,
  },
  addRow: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
  },
});

interface OutlineItem {
  key: string;
  id?: string;
  snippetId: string;
}

interface OutlineSection {
  key: string;
  id?: string;
  name: string;
  layout: SectionLayout;
  items: OutlineItem[];
}

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `k${keyCounter}`;
}

/** The queue handed in by the pane, via the URL hash. */
function parseInitialOutline(): OutlineSection[] {
  try {
    const match = /(?:^|[#&])state=([^&]*)/.exec(window.location.hash);
    if (!match?.[1]) {
      return [];
    }
    const parsed = queueStateSchema.safeParse(JSON.parse(decodeURIComponent(match[1])));
    if (!parsed.success) {
      return [];
    }
    return [...parsed.data.sections]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((section) => ({
        key: nextKey(),
        id: section.id,
        name: section.name,
        layout: section.layout ?? DEFAULT_SECTION_LAYOUT,
        items: [...section.items]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((item) => ({ key: nextKey(), id: item.id, snippetId: item.snippetId })),
      }));
  } catch {
    return [];
  }
}

export const BuilderApp: React.FC = () => {
  const styles = useStyles();
  const [sections, setSections] = React.useState<OutlineSection[]>(parseInitialOutline);
  const [libraries, setLibraries] = React.useState<Library[]>([]);
  const [folders, setFolders] = React.useState<Folder[]>([]);
  const [snippets, setSnippets] = React.useState<Snippet[]>([]);
  const [templates, setTemplates] = React.useState<QueueTemplate[]>([]);
  const [libraryId, setLibraryId] = React.useState<string | "all">("all");
  const [folderId, setFolderId] = React.useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = React.useState<Set<string>>(new Set());
  const [query, setQuery] = React.useState("");
  const [newSection, setNewSection] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  React.useEffect(() => {
    void (async () => {
      try {
        const storage = getStorage();
        await storage.init();
        const [libs, allFolders, allSnippets, allTemplates] = await Promise.all([
          storage.getAllLibraries(),
          storage.getAllFolders(),
          storage.getAllSnippets(),
          storage.getAllQueueTemplates(),
        ]);
        setLibraries(libs.sort((a, b) => a.name.localeCompare(b.name)));
        setFolders(allFolders);
        setSnippets(allSnippets.sort((a, b) => a.name.localeCompare(b.name)));
        setTemplates(allTemplates);
      } catch (e: unknown) {
        setError(
          `Couldn't open the snippet library: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    })();
  }, []);

  const snippetsById = React.useMemo(() => new Map(snippets.map((s) => [s.id, s])), [snippets]);

  const visibleSnippets = React.useMemo(() => {
    let list = snippets;
    if (libraryId !== "all") {
      list = list.filter((s) => s.memberships.some((m) => m.libraryId === libraryId));
      if (folderId !== null) {
        const subtree = subtreeFolderIds(folders, folderId);
        list = list.filter((s) =>
          s.memberships.some(
            (m) => m.libraryId === libraryId && m.folderId !== null && subtree.has(m.folderId)
          )
        );
      }
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
      );
    }
    return list;
  }, [snippets, libraryId, folderId, folders, query]);

  const libraryFolders = React.useMemo(
    () => (libraryId === "all" ? [] : folders.filter((f) => f.libraryId === libraryId)),
    [folders, libraryId]
  );

  const addToSection = React.useCallback((sectionKey: string, snippetId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.key === sectionKey ? { ...s, items: [...s.items, { key: nextKey(), snippetId }] } : s
      )
    );
  }, []);

  /** Click-to-add targets the first section when none is obvious. */
  const addToFirstSection = (snippetId: string) => {
    if (sections.length === 0) {
      setSections([
        {
          key: nextKey(),
          name: "Queue",
          layout: DEFAULT_SECTION_LAYOUT,
          items: [{ key: nextKey(), snippetId }],
        },
      ]);
    } else {
      addToSection(sections[0]!.key, snippetId);
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!activeId.startsWith("snip:") || !overId?.startsWith("sec:")) {
      return;
    }
    addToSection(overId.slice(4), activeId.slice(5));
  };

  const moveItem = (sectionKey: string, index: number, delta: number) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.key !== sectionKey) {
          return s;
        }
        const target = index + delta;
        if (target < 0 || target >= s.items.length) {
          return s;
        }
        const items = [...s.items];
        const [moved] = items.splice(index, 1);
        items.splice(target, 0, moved!);
        return { ...s, items };
      })
    );
  };

  const moveSection = (index: number, delta: number) => {
    setSections((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved!);
      return next;
    });
  };

  const loadTemplate = (template: QueueTemplate) => {
    setSections((prev) => [
      ...prev,
      ...template.sections.map((section) => ({
        key: nextKey(),
        name: section.name,
        layout: section.layout ?? DEFAULT_SECTION_LAYOUT,
        items: section.snippetIds.map((snippetId) => ({ key: nextKey(), snippetId })),
      })),
    ]);
  };

  const finish = (cancel: boolean) => {
    const payload = cancel
      ? { cancel: true as const }
      : {
          sections: sections.map((s): BuilderSection => ({
            ...(s.id !== undefined ? { id: s.id } : {}),
            name: s.name.trim() || "Untitled",
            layout: s.layout,
            items: s.items.map((i) => ({
              ...(i.id !== undefined ? { id: i.id } : {}),
              snippetId: i.snippetId,
            })),
          })),
        };
    try {
      sendBuilderMessage(JSON.stringify(payload));
    } catch {
      setError("Couldn't send the outline back to the task pane.");
    }
  };

  const renderFolder = (folder: Folder, depth: number): React.ReactNode => {
    const children = libraryFolders
      .filter((f) => f.parentId === folder.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const collapsed = collapsedFolders.has(folder.id);
    return (
      <React.Fragment key={folder.id}>
        <div className={styles.folderRow} style={{ paddingLeft: `${depth * 14}px` }}>
          <Button
            appearance="transparent"
            size="small"
            icon={collapsed ? <ChevronRight16Regular /> : <ChevronDown16Regular />}
            aria-label={collapsed ? `Expand ${folder.name}` : `Collapse ${folder.name}`}
            disabled={children.length === 0}
            onClick={() =>
              setCollapsedFolders((prev) => {
                const next = new Set(prev);
                if (next.has(folder.id)) {
                  next.delete(folder.id);
                } else {
                  next.add(folder.id);
                }
                return next;
              })
            }
          />
          <Button
            appearance={folderId === folder.id ? "primary" : "subtle"}
            size="small"
            onClick={() => setFolderId(folderId === folder.id ? null : folder.id)}
          >
            {folder.name}
          </Button>
        </div>
        {!collapsed && children.map((child) => renderFolder(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className={styles.root}>
        <div className={styles.columns}>
          {/* ---- Left: the report outline ---- */}
          <div className={styles.column}>
            <div className={styles.sectionHead}>
              <Text className={styles.columnTitle}>Report outline</Text>
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <Button appearance="secondary" size="small" disabled={templates.length === 0}>
                    Load outline
                  </Button>
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    {templates.map((template) => (
                      <MenuItem key={template.id} onClick={() => loadTemplate(template)}>
                        {template.name}
                      </MenuItem>
                    ))}
                  </MenuList>
                </MenuPopover>
              </Menu>
            </div>
            <Caption1 className={styles.hint}>
              Drag snippets from the right into a section (or use +). Sections map to
              {" {{Section Name}} "}markers in your document.
            </Caption1>
            <div className={styles.columnScroll}>
              {sections.map((section, si) => (
                <OutlineSectionCard
                  key={section.key}
                  section={section}
                  snippetsById={snippetsById}
                  onRename={(name) =>
                    setSections((prev) =>
                      prev.map((s) => (s.key === section.key ? { ...s, name } : s))
                    )
                  }
                  onLayout={(layout) =>
                    setSections((prev) =>
                      prev.map((s) => (s.key === section.key ? { ...s, layout } : s))
                    )
                  }
                  onRemove={() => setSections((prev) => prev.filter((s) => s.key !== section.key))}
                  onMoveSection={(delta) => moveSection(si, delta)}
                  onMoveItem={(index, delta) => moveItem(section.key, index, delta)}
                  onRemoveItem={(key) =>
                    setSections((prev) =>
                      prev.map((s) =>
                        s.key === section.key
                          ? { ...s, items: s.items.filter((i) => i.key !== key) }
                          : s
                      )
                    )
                  }
                />
              ))}
              <div className={styles.addRow}>
                <Input
                  placeholder="New section name"
                  value={newSection}
                  onChange={(_, data) => setNewSection(data.value)}
                />
                <Button
                  appearance="secondary"
                  size="small"
                  icon={<Add16Regular />}
                  disabled={!newSection.trim()}
                  onClick={() => {
                    setSections((prev) => [
                      ...prev,
                      {
                        key: nextKey(),
                        name: newSection.trim(),
                        layout: DEFAULT_SECTION_LAYOUT,
                        items: [],
                      },
                    ]);
                    setNewSection("");
                  }}
                >
                  Add section
                </Button>
              </div>
            </div>
          </div>

          {/* ---- Right: the snippet library ---- */}
          <div className={styles.column}>
            <Text className={styles.columnTitle}>Snippet library</Text>
            <Dropdown
              value={
                libraryId === "all"
                  ? "All libraries"
                  : (libraries.find((l) => l.id === libraryId)?.name ?? "")
              }
              selectedOptions={[libraryId]}
              onOptionSelect={(_, data) => {
                setLibraryId((data.optionValue as string | undefined) ?? "all");
                setFolderId(null);
              }}
            >
              <Option value="all">All libraries</Option>
              {libraries.map((library) => (
                <Option key={library.id} value={library.id}>
                  {library.name}
                </Option>
              ))}
            </Dropdown>
            <Input
              placeholder="Search snippets"
              value={query}
              onChange={(_, data) => setQuery(data.value)}
            />
            <div className={styles.columnScroll}>
              {libraryId !== "all" &&
                libraryFolders
                  .filter((f) => f.parentId === null)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((folder) => renderFolder(folder, 0))}
              {error && <Text>{error}</Text>}
              {visibleSnippets.map((snippet) => (
                <DraggableSnippet
                  key={snippet.id}
                  snippet={snippet}
                  onAdd={() => addToFirstSection(snippet.id)}
                />
              ))}
              {visibleSnippets.length === 0 && !error && (
                <Caption1 className={styles.hint}>No snippets match.</Caption1>
              )}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <Caption1 className={styles.hint}>
            {sections.reduce((n, s) => n + s.items.length, 0)} snippets in {sections.length}{" "}
            {sections.length === 1 ? "section" : "sections"}
          </Caption1>
          <Button appearance="secondary" onClick={() => finish(true)}>
            Cancel
          </Button>
          <Button appearance="primary" onClick={() => finish(false)}>
            Save to queue
          </Button>
        </div>
      </div>
    </DndContext>
  );
};

const OutlineSectionCard: React.FC<{
  section: OutlineSection;
  snippetsById: Map<string, Snippet>;
  onRename: (name: string) => void;
  onLayout: (layout: SectionLayout) => void;
  onRemove: () => void;
  onMoveSection: (delta: number) => void;
  onMoveItem: (index: number, delta: number) => void;
  onRemoveItem: (key: string) => void;
}> = ({
  section,
  snippetsById,
  onRename,
  onLayout,
  onRemove,
  onMoveSection,
  onMoveItem,
  onRemoveItem,
}) => {
  const styles = useStyles();
  const { setNodeRef, isOver } = useDroppable({ id: `sec:${section.key}` });
  return (
    <Card
      ref={setNodeRef}
      className={mergeClasses(styles.section, isOver && styles.sectionDrop)}
      size="small"
    >
      <div className={styles.sectionHead}>
        <Input
          className={styles.sectionName}
          value={section.name}
          aria-label="Section name"
          onChange={(_, data) => onRename(data.value)}
        />
        <Dropdown
          className={styles.layoutDrop}
          size="small"
          value={section.layout === "table" ? "Table" : "Paragraphs"}
          selectedOptions={[section.layout]}
          onOptionSelect={(_, data) => onLayout((data.optionValue as SectionLayout) ?? "table")}
          aria-label={`Layout for ${section.name}`}
        >
          <Option value="table">Table</Option>
          <Option value="paragraphs">Paragraphs</Option>
        </Dropdown>
        <Button
          appearance="subtle"
          size="small"
          icon={<ArrowUp16Regular />}
          aria-label={`Move section ${section.name} up`}
          onClick={() => onMoveSection(-1)}
        />
        <Button
          appearance="subtle"
          size="small"
          icon={<ArrowDown16Regular />}
          aria-label={`Move section ${section.name} down`}
          onClick={() => onMoveSection(1)}
        />
        <Button
          appearance="subtle"
          size="small"
          icon={<Delete16Regular />}
          aria-label={`Remove section ${section.name}`}
          onClick={onRemove}
        />
      </div>
      {section.items.map((item, index) => {
        const snippet = snippetsById.get(item.snippetId);
        return (
          <div key={item.key} className={styles.itemRow}>
            <Caption1 className={styles.itemName}>
              {snippet ? snippet.name : "(snippet deleted)"}
            </Caption1>
            <Button
              appearance="transparent"
              size="small"
              icon={<ArrowUp16Regular />}
              aria-label="Move up"
              onClick={() => onMoveItem(index, -1)}
            />
            <Button
              appearance="transparent"
              size="small"
              icon={<ArrowDown16Regular />}
              aria-label="Move down"
              onClick={() => onMoveItem(index, 1)}
            />
            <Button
              appearance="transparent"
              size="small"
              icon={<Dismiss16Regular />}
              aria-label={`Remove ${snippet?.name ?? "item"}`}
              onClick={() => onRemoveItem(item.key)}
            />
          </div>
        );
      })}
      {section.items.length === 0 && (
        <Caption1 className={styles.hint}>Drop snippets here.</Caption1>
      )}
    </Card>
  );
};

const DraggableSnippet: React.FC<{ snippet: Snippet; onAdd: () => void }> = ({
  snippet,
  onAdd,
}) => {
  const styles = useStyles();
  const { setNodeRef, attributes, listeners } = useDraggable({ id: `snip:${snippet.id}` });
  return (
    <Card
      ref={setNodeRef}
      className={styles.snippetCard}
      size="small"
      {...attributes}
      {...listeners}
    >
      <div className={styles.snippetHead}>
        <span className={styles.snippetName}>{snippet.name}</span>
        <Tooltip content="Add to the outline" relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<Add16Regular />}
            aria-label={`Add ${snippet.name} to outline`}
            // dnd-kit's listeners swallow plain clicks otherwise.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onAdd}
          />
        </Tooltip>
      </div>
      {/* Snippet content is untrusted plain text — text nodes only. */}
      <Caption1 className={styles.snippetPreview}>{snippet.content}</Caption1>
    </Card>
  );
};
