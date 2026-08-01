/** Tag chip input with ranked autocomplete and new-tag confirmation (§7.4). */
import * as React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  Tag,
  TagGroup,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import type { Tag as TagEntity } from "../../models/entities";
import { getStorage } from "../state/storage";
import { useTagStore } from "../state/tagStore";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
  },
  inputWrap: {
    position: "relative",
  },
  suggestions: {
    position: "absolute",
    top: "100%",
    left: "0",
    right: "0",
    zIndex: 10,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow8,
    borderRadius: tokens.borderRadiusMedium,
    paddingTop: "2px",
    paddingBottom: "2px",
    maxHeight: "180px",
    overflowY: "auto",
  },
  suggestion: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingTop: "4px",
    paddingBottom: "4px",
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    cursor: "pointer",
    border: "none",
    backgroundColor: "transparent",
    textAlign: "left",
    fontSize: tokens.fontSizeBase300,
  },
  suggestionActive: {
    backgroundColor: tokens.colorNeutralBackground1Hover,
  },
  usage: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
});

/** A committed chip: an existing tag, or a name pending creation on save. */
export interface TagChip {
  name: string;
  tagId: string | null;
}

export interface TagInputProps {
  chips: TagChip[];
  onChange: (chips: TagChip[]) => void;
}

/** Resolve chips to tag ids at save time, creating pending tags (§7.4). */
export async function resolveChipTagIds(chips: TagChip[]): Promise<string[]> {
  const ids: string[] = [];
  for (const chip of chips) {
    if (chip.tagId) {
      ids.push(chip.tagId);
    } else {
      const tag = await getStorage().getOrCreateTag(chip.name);
      ids.push(tag.id);
    }
  }
  await useTagStore.getState().load();
  return [...new Set(ids)];
}

export const TagInput: React.FC<TagInputProps> = ({ chips, onChange }) => {
  const styles = useStyles();
  const tags = useTagStore((s) => s.tags);
  const [text, setText] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const [suppressConfirm, setSuppressConfirm] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    getStorage()
      .getPrefs()
      .then((p) => setSuppressConfirm(p.suppressNewTagConfirm))
      .catch(() => setSuppressConfirm(false));
  }, []);

  const chipNames = new Set(chips.map((c) => c.name.toLowerCase()));
  const query = text.trim().toLowerCase();
  const suggestions = query
    ? tags
        .filter((t) => t.name.toLowerCase().includes(query) && !chipNames.has(t.name.toLowerCase()))
        .sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name))
        .slice(0, 6)
    : [];

  const addChip = (name: string, tag: TagEntity | undefined) => {
    const trimmed = name.trim();
    if (!trimmed || chipNames.has(trimmed.toLowerCase())) {
      setText("");
      return;
    }
    onChange([...chips, { name: tag?.name ?? trimmed, tagId: tag?.id ?? null }]);
    setText("");
    setActiveIndex(0);
  };

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return;
    }
    const existing = tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      addChip(existing.name, existing);
    } else if (suppressConfirm) {
      addChip(trimmed, undefined);
    } else {
      setConfirming(trimmed);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (suggestions.length > 0 && e.key === "Enter") {
        const pick = suggestions[activeIndex] ?? suggestions[0];
        if (pick && text.trim().toLowerCase() !== pick.name.toLowerCase()) {
          // Enter picks the highlighted suggestion unless the text is an exact name.
          addChip(pick.name, pick);
          return;
        }
      }
      commit(text);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Backspace" && text === "" && chips.length > 0) {
      onChange(chips.slice(0, -1));
    }
  };

  return (
    <div className={styles.root}>
      {chips.length > 0 && (
        <TagGroup
          onDismiss={(_, data) => onChange(chips.filter((c) => c.name !== data.value))}
          aria-label="Selected tags"
        >
          {chips.map((chip) => (
            <Tag key={chip.name} dismissible value={chip.name} size="small">
              {chip.name}
            </Tag>
          ))}
        </TagGroup>
      )}
      <div className={styles.inputWrap}>
        <Input
          value={text}
          placeholder="Add tags (Enter or comma)"
          onChange={(_, data) => {
            setText(data.value);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          style={{ width: "100%" }}
        />
        {suggestions.length > 0 && (
          <div className={styles.suggestions} role="listbox">
            {suggestions.map((tag, i) => (
              <button
                key={tag.id}
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                className={
                  i === activeIndex
                    ? `${styles.suggestion} ${styles.suggestionActive}`
                    : styles.suggestion
                }
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => addChip(tag.name, tag)}
              >
                <span>{tag.name}</span>
                <span className={styles.usage}>{tag.usageCount}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={confirming !== null}
        onOpenChange={(_, data) => !data.open && setConfirming(null)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>New tag</DialogTitle>
            <DialogContent>
              <Text>
                You&apos;re adding a new tag: &ldquo;{confirming}&rdquo;. You can edit tags later in
                the Tag Manager.
              </Text>
            </DialogContent>
            <DialogActions position="start">
              <Button
                appearance="primary"
                onClick={() => {
                  if (confirming) {
                    addChip(confirming, undefined);
                  }
                  setConfirming(null);
                }}
              >
                Yes
              </Button>
              <Button appearance="secondary" onClick={() => setConfirming(null)}>
                No
              </Button>
              <Button
                appearance="subtle"
                onClick={() => {
                  setSuppressConfirm(true);
                  void getStorage().updatePrefs({ suppressNewTagConfirm: true });
                  if (confirming) {
                    addChip(confirming, undefined);
                  }
                  setConfirming(null);
                }}
              >
                Stop showing this
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};
