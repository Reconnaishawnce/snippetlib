/** Import flow (§7.8): pick file → validate → preview → conflict policy → apply. */
import * as React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Radio,
  RadioGroup,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import type { ExportBundle, ImportConflictPolicy } from "../../models/entities";
import { parseBundle, planImport, type ImportPreview } from "../../importexport/importer";
import type { ImportResult } from "../../storage/StorageProvider";
import { applyImport } from "../state/importExportActions";
import { getStorage } from "../state/storage";

const useStyles = makeStyles({
  summary: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    marginBottom: tokens.spacingVerticalS,
  },
});

export interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onError: (message: string) => void;
  onDone: (result: ImportResult) => void;
  /** Pre-validated bundle (team library pull): skips the file picker. */
  sourceBundle?: ExportBundle | null;
}

export const ImportDialog: React.FC<ImportDialogProps> = (props) => {
  const styles = useStyles();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [bundle, setBundle] = React.useState<ExportBundle | null>(null);
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [policy, setPolicy] = React.useState<ImportConflictPolicy>("keep-both");
  const [busy, setBusy] = React.useState(false);

  const previewBundle = React.useCallback(async (validated: ExportBundle) => {
    const storage = getStorage();
    const [snippets, tags, libraries] = await Promise.all([
      storage.getAllSnippets(),
      storage.getAllTags(),
      storage.getAllLibraries(),
    ]);
    setBundle(validated);
    setPreview(
      planImport(validated, {
        snippetIds: new Set(snippets.map((s) => s.id)),
        tagNamesLower: new Set(tags.map((t) => t.name.toLowerCase())),
        libraryNamesLower: new Set(libraries.map((l) => l.name.toLowerCase())),
      })
    );
  }, []);

  // Reset on open, then either preview the supplied bundle (team library pull)
  // or open the file picker.
  React.useEffect(() => {
    if (props.open) {
      setBundle(null);
      setPreview(null);
      setPolicy("keep-both");
      setBusy(false);
      if (props.sourceBundle) {
        void previewBundle(props.sourceBundle);
      } else {
        fileRef.current?.click();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  const onFile = async (file: File | undefined) => {
    if (!file) {
      props.onClose();
      return;
    }
    const text = await file.text();
    const parsed = parseBundle(text);
    if (!parsed.ok) {
      props.onClose();
      props.onError(parsed.error);
      return;
    }
    await previewBundle(parsed.bundle);
  };

  const run = async () => {
    if (!bundle) {
      return;
    }
    setBusy(true);
    try {
      const result = await applyImport(bundle, policy);
      props.onClose();
      props.onDone(result);
    } catch (e: unknown) {
      props.onClose();
      props.onError(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // allow re-picking the same file next time
          void onFile(file);
        }}
      />
      <Dialog
        open={props.open && preview !== null}
        onOpenChange={(_, data) => !data.open && props.onClose()}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Import snippets</DialogTitle>
            <DialogContent>
              {preview && (
                <div className={styles.summary}>
                  <Text>
                    {preview.newSnippets} new {preview.newSnippets === 1 ? "snippet" : "snippets"},{" "}
                    {preview.conflicts} matching existing{" "}
                    {preview.conflicts === 1 ? "snippet" : "snippets"}, {preview.newTags} new{" "}
                    {preview.newTags === 1 ? "tag" : "tags"}, {preview.newLibraries} new{" "}
                    {preview.newLibraries === 1 ? "library" : "libraries"}.
                  </Text>
                  {preview.conflicts > 0 && (
                    <Field label="When a snippet already exists here">
                      <RadioGroup
                        value={policy}
                        onChange={(_, data) => setPolicy(data.value as ImportConflictPolicy)}
                      >
                        <Radio
                          value="keep-both"
                          label="Keep both — import as a copy named “… (imported)”"
                        />
                        <Radio value="keep-mine" label="Keep mine — skip the imported version" />
                        <Radio value="take-theirs" label="Take theirs — overwrite my version" />
                      </RadioGroup>
                    </Field>
                  )}
                </div>
              )}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={props.onClose} disabled={busy}>
                Cancel
              </Button>
              <Button appearance="primary" onClick={() => void run()} disabled={busy}>
                {busy ? "Importing…" : "Import"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
};
