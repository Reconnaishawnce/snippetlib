/** Save/edit snippet form (§7.3). Used by Save Selection and Edit. */
import * as React from "react";
import {
  Badge,
  Button,
  Combobox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Option,
  Text,
  Textarea,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import type { Folder, Library, Snippet, SnippetMembership } from "../../models/entities";
import { folderPath } from "../state/folderTreeUtils";
import { detectPlaceholders } from "../state/snippetName";
import { TagInput, type TagChip } from "./TagInput";

const useStyles = makeStyles({
  fields: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalXS,
  },
});

export interface SnippetFormValues {
  name: string;
  content: string;
  memberships: SnippetMembership[];
  /** Committed tag chips; resolved to tag ids (creating new tags) at save time. */
  tagChips: TagChip[];
}

export interface SnippetFormProps {
  open: boolean;
  /** Editing an existing snippet or saving a new one. */
  mode: "create" | "edit";
  initial: SnippetFormValues;
  libraries: Library[];
  /** Folders across ALL libraries, for building target options. */
  allFolders: Folder[];
  onSave: (values: SnippetFormValues) => void;
  onCancel: () => void;
}

export interface TargetOption {
  key: string; // `${libraryId}:${folderId ?? ""}`
  label: string;
  membership: SnippetMembership;
}

export function targetKey(m: SnippetMembership): string {
  return `${m.libraryId}:${m.folderId ?? ""}`;
}

export function buildTargetOptions(libraries: Library[], allFolders: Folder[]): TargetOption[] {
  const options: TargetOption[] = [];
  const sorted = [...libraries].sort((a, b) => a.name.localeCompare(b.name));
  for (const library of sorted) {
    const libraryFolders = allFolders.filter((f) => f.libraryId === library.id);
    options.push({
      key: `${library.id}:`,
      label: library.name,
      membership: { libraryId: library.id, folderId: null },
    });
    const folderOptions = libraryFolders
      .map((folder) => ({
        folder,
        path: [library.name, ...folderPath(libraryFolders, folder.id)].join(" > "),
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
    for (const { folder, path } of folderOptions) {
      options.push({
        key: `${library.id}:${folder.id}`,
        label: path,
        membership: { libraryId: library.id, folderId: folder.id },
      });
    }
  }
  return options;
}

export const SnippetForm: React.FC<SnippetFormProps> = (props) => {
  const styles = useStyles();
  const [name, setName] = React.useState("");
  const [content, setContent] = React.useState("");
  const [selectedKeys, setSelectedKeys] = React.useState<string[]>([]);
  const [tagChips, setTagChips] = React.useState<TagChip[]>([]);

  React.useEffect(() => {
    if (props.open) {
      setName(props.initial.name);
      setContent(props.initial.content);
      setSelectedKeys(props.initial.memberships.map(targetKey));
      setTagChips(props.initial.tagChips);
    }
  }, [props.open, props.initial]);

  const options = React.useMemo(
    () => buildTargetOptions(props.libraries, props.allFolders),
    [props.libraries, props.allFolders]
  );
  const optionByKey = React.useMemo(() => new Map(options.map((o) => [o.key, o])), [options]);
  const placeholders = React.useMemo(() => detectPlaceholders(content), [content]);

  const selectedLabels = selectedKeys
    .map((key) => optionByKey.get(key)?.label)
    .filter((label): label is string => Boolean(label));

  const canSave = name.trim().length > 0;

  const save = () => {
    if (!canSave) {
      return;
    }
    const memberships = selectedKeys
      .map((key) => optionByKey.get(key)?.membership)
      .filter((m): m is SnippetMembership => Boolean(m));
    props.onSave({ name: name.trim(), content, memberships, tagChips });
  };

  return (
    <Dialog open={props.open} onOpenChange={(_, data) => !data.open && props.onCancel()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{props.mode === "create" ? "Save snippet" : "Edit snippet"}</DialogTitle>
          <DialogContent>
            <div className={styles.fields}>
              <Field label="Name" required>
                <Input value={name} onChange={(_, data) => setName(data.value)} autoFocus />
              </Field>
              <Field label="Content">
                <Textarea
                  value={content}
                  onChange={(_, data) => setContent(data.value)}
                  resize="vertical"
                  rows={6}
                />
              </Field>
              {placeholders.length > 0 && (
                <div>
                  <Text size={200}>Will prompt for:&nbsp;</Text>
                  <span className={styles.chips}>
                    {placeholders.map((p) => (
                      <Badge key={p} appearance="tint" color="brand" size="small">
                        {p}
                      </Badge>
                    ))}
                  </span>
                </div>
              )}
              <Field label="Tags">
                <TagInput chips={tagChips} onChange={setTagChips} />
              </Field>
              <Field
                label="Save to (library › folder)"
                hint={
                  selectedKeys.length === 0
                    ? "No destination selected — this snippet will go to the Unassigned Backlog."
                    : "Pick one or more folders; you can also move snippets later via ⋯ → Move to."
                }
              >
                <Combobox
                  multiselect
                  placeholder="Choose library / folder targets"
                  value={selectedLabels.join(", ")}
                  selectedOptions={selectedKeys}
                  onOptionSelect={(_, data) => setSelectedKeys(data.selectedOptions)}
                >
                  {options.map((option) => (
                    <Option key={option.key} value={option.key}>
                      {option.label}
                    </Option>
                  ))}
                </Combobox>
              </Field>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={props.onCancel}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={!canSave} onClick={save}>
              {props.mode === "create" ? "Save snippet" : "Save changes"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

export function membershipsEqual(a: SnippetMembership[], b: SnippetMembership[]): boolean {
  const keys = (list: SnippetMembership[]) => list.map(targetKey).sort().join("|");
  return keys(a) === keys(b);
}

export type { Snippet };
