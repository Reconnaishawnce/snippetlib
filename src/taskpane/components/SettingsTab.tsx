/** Settings tab (§7.10). */
import * as React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Divider,
  Field,
  Input,
  Switch,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { usePrefsStore } from "../state/prefsStore";
import { useLibraryStore } from "../state/libraryStore";
import { getStorage } from "../state/storage";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  hint: {
    color: tokens.colorNeutralForeground3,
  },
  row: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
    flexWrap: "wrap",
  },
  danger: {
    color: tokens.colorPaletteRedForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
});

export interface SettingsTabProps {
  onExportAll: () => void;
  onImport: () => void;
  onError: (message: string) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = (props) => {
  const styles = useStyles();
  const { prefs, load, update } = usePrefsStore();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");

  React.useEffect(() => {
    if (!prefs) {
      void load();
    }
  }, [prefs, load]);

  const deleteAll = async () => {
    setConfirmOpen(false);
    setConfirmText("");
    try {
      await getStorage().clearAll();
      // Re-init from scratch: seeds "My Snippets" and reloads every store.
      await useLibraryStore.getState().init();
      await load();
    } catch (e: unknown) {
      props.onError(`Delete failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className={styles.root}>
      <Switch
        label="Confirm before creating a new tag"
        checked={prefs ? !prefs.suppressNewTagConfirm : true}
        onChange={(_, data) => void update({ suppressNewTagConfirm: !data.checked })}
      />
      <Switch
        label="Allow dragging queue items into the document (experimental)"
        checked={prefs?.enableDocDragDrop ?? true}
        onChange={(_, data) => void update({ enableDocDragDrop: Boolean(data.checked) })}
      />
      <Divider />
      <Text weight="semibold">Backup &amp; sharing</Text>
      <Text size={200} className={styles.hint}>
        Your library lives only on this machine. Export regularly — the file doubles as the way to
        share snippets with teammates.
        {prefs?.lastExportAt
          ? ` Last full export: ${new Date(prefs.lastExportAt).toLocaleString()}.`
          : " No full export yet."}
      </Text>
      <div className={styles.row}>
        <Button appearance="secondary" onClick={props.onExportAll}>
          Export everything
        </Button>
        <Button appearance="secondary" onClick={props.onImport}>
          Import…
        </Button>
      </div>
      <Divider />
      <Text weight="semibold" className={styles.danger}>
        Danger zone
      </Text>
      <div className={styles.row}>
        <Button appearance="secondary" onClick={() => setConfirmOpen(true)}>
          Delete all data…
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(_, data) => !data.open && setConfirmOpen(false)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete all ReportSnips data?</DialogTitle>
            <DialogContent>
              <Field label='This permanently deletes every library, folder, snippet, tag, and setting on this machine. Type "DELETE" to confirm.'>
                <Input
                  value={confirmText}
                  onChange={(_, data) => setConfirmText(data.value)}
                  placeholder="DELETE"
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                disabled={confirmText !== "DELETE"}
                onClick={() => void deleteAll()}
              >
                Delete everything
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};
