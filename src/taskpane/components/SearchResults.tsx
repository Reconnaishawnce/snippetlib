/** Search results with highlighting and preview popover (§7.5). */
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
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Tag,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { Eye16Regular, MoreHorizontal16Regular } from "@fluentui/react-icons";
import type { Snippet } from "../../models/entities";
import { highlightSegments, makeExcerpt } from "../../search/highlight";
import { useLibraryStore } from "../state/libraryStore";
import { useSearchStore } from "../state/searchStore";
import { useSnippetStore } from "../state/snippetStore";
import { useTagStore } from "../state/tagStore";
import { getStorage } from "../state/storage";
import { folderPath } from "../state/folderTreeUtils";
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
    gap: tokens.spacingHorizontalXXS,
  },
  name: {
    flexGrow: 1,
    fontWeight: tokens.fontWeightSemibold,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  mark: {
    backgroundColor: tokens.colorBrandBackground2,
    fontWeight: tokens.fontWeightSemibold,
  },
  excerpt: {
    color: tokens.colorNeutralForeground2,
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalXXS,
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
  },
});

function Highlighted({ text, terms, mark }: { text: string; terms: string[]; mark: string }) {
  const segments = highlightSegments(text, terms);
  return (
    <>
      {segments.map((seg, i) =>
        seg.hit ? (
          <span key={i} className={mark}>
            {seg.text}
          </span>
        ) : (
          <React.Fragment key={i}>{seg.text}</React.Fragment>
        )
      )}
    </>
  );
}

export interface SearchResultsProps {
  onEdit: (snippet: Snippet) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({ onEdit }) => {
  const styles = useStyles();
  const hits = useSearchStore((s) => s.hits);
  const filterTagIds = useSearchStore((s) => s.filterTagIds);
  const tags = useTagStore((s) => s.tags);
  const libraries = useLibraryStore((s) => s.libraries);
  const remove = useSnippetStore((s) => s.remove);

  const [resolved, setResolved] = React.useState<Map<string, Snippet>>(new Map());
  const [toDelete, setToDelete] = React.useState<Snippet | null>(null);
  const [allFolders, setAllFolders] = React.useState<
    Awaited<ReturnType<ReturnType<typeof getStorage>["getAllFolders"]>>
  >([]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const storage = getStorage();
      const [snippets, folders] = await Promise.all([
        Promise.all(hits.map((h) => storage.getSnippet(h.id))),
        storage.getAllFolders(),
      ]);
      if (!cancelled) {
        const map = new Map<string, Snippet>();
        for (const snippet of snippets) {
          if (snippet) {
            map.set(snippet.id, snippet);
          }
        }
        setResolved(map);
        setAllFolders(folders);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hits]);

  const tagsById = new Map(tags.map((t) => [t.id, t]));
  const librariesById = new Map(libraries.map((l) => [l.id, l]));

  const visible = hits
    .map((hit) => ({ hit, snippet: resolved.get(hit.id) }))
    .filter((x): x is { hit: (typeof hits)[number]; snippet: Snippet } => Boolean(x.snippet))
    .filter(({ snippet }) => filterTagIds.every((tagId) => snippet.tagIds.includes(tagId)));

  if (visible.length === 0) {
    return (
      <div className={styles.empty}>
        <Text>No matching snippets.</Text>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {visible.map(({ hit, snippet }) => {
        const firstMembership = snippet.memberships[0];
        const breadcrumb = firstMembership
          ? [
              librariesById.get(firstMembership.libraryId)?.name ?? "?",
              ...folderPath(
                allFolders.filter((f) => f.libraryId === firstMembership.libraryId),
                firstMembership.folderId
              ),
            ].join(" > ") +
            (snippet.memberships.length > 1 ? `  (+${snippet.memberships.length - 1})` : "")
          : "Unassigned Backlog";
        return (
          <Card key={snippet.id} className={styles.card} size="small">
            <div className={styles.header}>
              <span className={styles.name}>
                <Highlighted text={snippet.name} terms={hit.terms} mark={styles.mark} />
              </span>
              <Popover withArrow>
                <PopoverTrigger disableButtonEnhancement>
                  <Button
                    appearance="transparent"
                    size="small"
                    icon={<Eye16Regular />}
                    aria-label={`Preview ${snippet.name}`}
                  />
                </PopoverTrigger>
                <PopoverSurface>
                  {/* Read-only preview; snippet content stays a text node. */}
                  <Text size={200} className={styles.preview} block>
                    {snippet.content}
                  </Text>
                </PopoverSurface>
              </Popover>
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
            <Caption1>{breadcrumb}</Caption1>
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
            <Text size={200} className={styles.excerpt}>
              <Highlighted
                text={makeExcerpt(snippet.content, hit.terms)}
                terms={hit.terms}
                mark={styles.mark}
              />
            </Text>
          </Card>
        );
      })}

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
