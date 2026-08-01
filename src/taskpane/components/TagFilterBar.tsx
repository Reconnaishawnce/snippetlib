/** Multi-tag AND filter bar for browse and search views (§7.4). */
import * as React from "react";
import {
  Button,
  Menu,
  MenuItemCheckbox,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Tag,
  TagGroup,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { Filter16Regular } from "@fluentui/react-icons";
import { useSearchStore } from "../state/searchStore";
import { useTagStore } from "../state/tagStore";

const useStyles = makeStyles({
  root: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    flexWrap: "wrap",
  },
});

export const TagFilterBar: React.FC = () => {
  const styles = useStyles();
  const tags = useTagStore((s) => s.tags);
  const filterTagIds = useSearchStore((s) => s.filterTagIds);
  const toggleFilterTag = useSearchStore((s) => s.toggleFilterTag);

  if (tags.length === 0) {
    return null;
  }

  const active = filterTagIds
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
  const sorted = [...tags].sort(
    (a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name)
  );

  return (
    <div className={styles.root}>
      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <Button appearance="subtle" size="small" icon={<Filter16Regular />}>
            Filter by tag
          </Button>
        </MenuTrigger>
        <MenuPopover>
          <MenuList
            checkedValues={{ tags: filterTagIds }}
            onCheckedValueChange={(_, data) => {
              const next = new Set(data.checkedItems);
              for (const tag of tags) {
                const isOn = filterTagIds.includes(tag.id);
                if (next.has(tag.id) !== isOn) {
                  toggleFilterTag(tag.id);
                }
              }
            }}
          >
            {sorted.map((tag) => (
              <MenuItemCheckbox key={tag.id} name="tags" value={tag.id}>
                {tag.name}
              </MenuItemCheckbox>
            ))}
          </MenuList>
        </MenuPopover>
      </Menu>
      {active.length > 0 && (
        <TagGroup
          aria-label="Active tag filters"
          onDismiss={(_, data) => {
            const tag = tags.find((t) => t.name === data.value);
            if (tag) {
              toggleFilterTag(tag.id);
            }
          }}
        >
          {active.map((tag) => (
            <Tag key={tag.id} dismissible value={tag.name} size="small" appearance="brand">
              {tag.name}
            </Tag>
          ))}
        </TagGroup>
      )}
    </div>
  );
};
