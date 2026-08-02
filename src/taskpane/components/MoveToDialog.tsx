/** Explicit "Move to…" for snippets — the discoverable way into folders. */
import * as React from "react";
import {
  Button,
  Combobox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Option,
} from "@fluentui/react-components";
import type { Folder, Snippet, SnippetMembership } from "../../models/entities";
import { useLibraryStore } from "../state/libraryStore";
import { getStorage } from "../state/storage";
import { buildTargetOptions, targetKey } from "./SnippetForm";

export interface MoveToDialogProps {
  snippet: Snippet | null;
  onSave: (snippet: Snippet, memberships: SnippetMembership[]) => void;
  onClose: () => void;
}

export const MoveToDialog: React.FC<MoveToDialogProps> = ({ snippet, onSave, onClose }) => {
  const libraries = useLibraryStore((s) => s.libraries);
  const [allFolders, setAllFolders] = React.useState<Folder[]>([]);
  const [selectedKeys, setSelectedKeys] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (snippet) {
      setSelectedKeys(snippet.memberships.map(targetKey));
      getStorage()
        .getAllFolders()
        .then(setAllFolders)
        .catch(() => setAllFolders([]));
    }
  }, [snippet]);

  const options = React.useMemo(
    () => buildTargetOptions(libraries, allFolders),
    [libraries, allFolders]
  );
  const optionByKey = React.useMemo(() => new Map(options.map((o) => [o.key, o])), [options]);
  const selectedLabels = selectedKeys
    .map((key) => optionByKey.get(key)?.label)
    .filter((label): label is string => Boolean(label));

  return (
    <Dialog open={snippet !== null} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Move &ldquo;{snippet?.name ?? ""}&rdquo;</DialogTitle>
          <DialogContent>
            <Field
              label="Locations (library › folder)"
              hint={
                selectedKeys.length === 0
                  ? "No location selected — the snippet will move to the Unassigned Backlog."
                  : "A snippet can live in several folders at once."
              }
            >
              <Combobox
                multiselect
                placeholder="Choose library / folder locations"
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
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              onClick={() => {
                if (snippet) {
                  const memberships = selectedKeys
                    .map((key) => optionByKey.get(key)?.membership)
                    .filter((m): m is SnippetMembership => Boolean(m));
                  onSave(snippet, memberships);
                }
              }}
            >
              Move
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
