/** Tag Manager tab (§7.4): list, rename (merge on collision), delete, merge. */
import * as React from "react";
import {
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Option,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { MoreHorizontal16Regular, Tag16Regular } from "@fluentui/react-icons";
import { useTagStore } from "../state/tagStore";
import { NameDialog, ConfirmDialog } from "./dialogs";

const useStyles = makeStyles({
  list: {
    display: "flex",
    flexDirection: "column",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    paddingTop: "4px",
    paddingBottom: "4px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: tokens.colorNeutralStroke3,
  },
  name: {
    flexGrow: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  empty: {
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
    paddingTop: tokens.spacingVerticalXXL,
  },
});

type DialogState =
  | { kind: "rename"; tagId: string }
  | { kind: "delete"; tagId: string }
  | { kind: "merge"; tagId: string }
  | { kind: "confirm-merge"; fromId: string; intoId: string }
  | null;

export const TagManager: React.FC = () => {
  const styles = useStyles();
  const { tags, rename, remove, merge } = useTagStore();
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [mergeTargetId, setMergeTargetId] = React.useState<string | null>(null);

  const sorted = [...tags].sort(
    (a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name)
  );
  const dialogTag =
    dialog && "tagId" in dialog ? tags.find((t) => t.id === dialog.tagId) : undefined;

  if (tags.length === 0) {
    return (
      <div className={styles.empty}>
        <Text>No tags yet. Add tags while saving a snippet.</Text>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {sorted.map((tag) => (
        <div key={tag.id} className={styles.row}>
          <Tag16Regular />
          <span className={styles.name}>{tag.name}</span>
          <Caption1>
            {tag.usageCount} {tag.usageCount === 1 ? "snippet" : "snippets"}
          </Caption1>
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button
                appearance="transparent"
                size="small"
                icon={<MoreHorizontal16Regular />}
                aria-label={`Actions for tag ${tag.name}`}
              />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem onClick={() => setDialog({ kind: "rename", tagId: tag.id })}>
                  Rename…
                </MenuItem>
                <MenuItem
                  disabled={tags.length < 2}
                  onClick={() => {
                    setMergeTargetId(null);
                    setDialog({ kind: "merge", tagId: tag.id });
                  }}
                >
                  Merge into…
                </MenuItem>
                <MenuItem onClick={() => setDialog({ kind: "delete", tagId: tag.id })}>
                  Delete…
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>
      ))}

      <NameDialog
        open={dialog?.kind === "rename"}
        title={`Rename tag "${dialogTag?.name ?? ""}"`}
        label="Tag name"
        initialValue={dialogTag?.name}
        submitLabel="Rename"
        onSubmit={(name) => {
          const current = dialogTag;
          setDialog(null);
          if (!current || name.toLowerCase() === current.name.toLowerCase()) {
            if (current) {
              void rename(current.id, name);
            }
            return;
          }
          const collision = tags.find(
            (t) => t.id !== current.id && t.name.toLowerCase() === name.toLowerCase()
          );
          if (collision) {
            setDialog({ kind: "confirm-merge", fromId: current.id, intoId: collision.id });
          } else {
            void rename(current.id, name);
          }
        }}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog?.kind === "confirm-merge"}
        title="Merge tags?"
        message={
          dialog?.kind === "confirm-merge"
            ? `A tag named "${tags.find((t) => t.id === dialog.intoId)?.name ?? ""}" already exists. ` +
              `Merge "${tags.find((t) => t.id === dialog.fromId)?.name ?? ""}" into it? ` +
              `All snippets keep a single combined tag.`
            : ""
        }
        confirmLabel="Merge tags"
        onConfirm={() => {
          if (dialog?.kind === "confirm-merge") {
            void merge(dialog.fromId, dialog.intoId);
          }
          setDialog(null);
        }}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog?.kind === "delete"}
        title={`Delete tag "${dialogTag?.name ?? ""}"?`}
        message={`This removes the tag from ${dialogTag?.usageCount ?? 0} ${
          (dialogTag?.usageCount ?? 0) === 1 ? "snippet" : "snippets"
        }. The snippets themselves are not deleted.`}
        confirmLabel="Delete tag"
        onConfirm={() => {
          if (dialogTag) {
            void remove(dialogTag.id);
          }
          setDialog(null);
        }}
        onCancel={() => setDialog(null)}
      />

      <Dialog
        open={dialog?.kind === "merge"}
        onOpenChange={(_, data) => !data.open && setDialog(null)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Merge &ldquo;{dialogTag?.name ?? ""}&rdquo; into…</DialogTitle>
            <DialogContent>
              <Field label="Target tag">
                <Dropdown
                  placeholder="Choose a tag"
                  value={tags.find((t) => t.id === mergeTargetId)?.name ?? ""}
                  selectedOptions={mergeTargetId ? [mergeTargetId] : []}
                  onOptionSelect={(_, data) => setMergeTargetId(data.optionValue ?? null)}
                >
                  {sorted
                    .filter((t) => t.id !== dialogTag?.id)
                    .map((t) => (
                      <Option key={t.id} value={t.id}>
                        {t.name}
                      </Option>
                    ))}
                </Dropdown>
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                disabled={!mergeTargetId}
                onClick={() => {
                  if (dialogTag && mergeTargetId) {
                    void merge(dialogTag.id, mergeTargetId);
                  }
                  setDialog(null);
                }}
              >
                Merge
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};
