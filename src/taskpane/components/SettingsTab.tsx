/** Settings tab (§7.10): feature toggles first — every non-core feature can be turned off. */
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
  SpinButton,
  Switch,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { usePrefsStore } from "../state/prefsStore";
import { useLibraryStore } from "../state/libraryStore";
import { getStorage } from "../state/storage";
import { buildDiagnosticsReport, copyToClipboard } from "../state/diagnostics";

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
    alignItems: "center",
  },
  danger: {
    color: tokens.colorPaletteRedForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  daysField: {
    maxWidth: "220px",
  },
});

export interface SettingsTabProps {
  onExportAll: () => void;
  onImport: () => void;
  onError: (message: string) => void;
  /** Stale snippets under the current thresholds (0 when review is off). */
  staleCount: number;
  onReviewStale: () => void;
  /** Called after any pref change that affects staleness, so App recomputes. */
  onStaleSettingsChanged: () => void;
  /** Manual team-library check (App owns the fetch/banner/import flow). */
  onTeamCheckNow: () => Promise<void>;
}

export const SettingsTab: React.FC<SettingsTabProps> = (props) => {
  const styles = useStyles();
  const { prefs, load, update } = usePrefsStore();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [urlDraft, setUrlDraft] = React.useState<string | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const copyDiagnostics = async () => {
    try {
      const storage = getStorage();
      const [allLibraries, allSnippets] = await Promise.all([
        storage.getAllLibraries(),
        storage.getAllSnippets(),
      ]);
      const report = buildDiagnosticsReport(
        typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev",
        { libraries: allLibraries.length, snippets: allSnippets.length }
      );
      setCopied(await copyToClipboard(report));
    } catch {
      setCopied(false);
    }
  };

  const urlValue = urlDraft ?? prefs?.teamLibraryUrl ?? "";
  const urlValid = React.useMemo(() => {
    if (!urlValue.trim()) {
      return false;
    }
    try {
      return new URL(urlValue).protocol === "https:";
    } catch {
      return false;
    }
  }, [urlValue]);
  /* global URL */

  React.useEffect(() => {
    if (!prefs) {
      void load();
    }
  }, [prefs, load]);

  const updateStale = async (patch: Parameters<typeof update>[0]) => {
    await update(patch);
    props.onStaleSettingsChanged();
  };

  const daysSpinner = (
    label: string,
    value: number,
    onCommit: (days: number) => void
  ): React.ReactElement => (
    <Field label={label} className={styles.daysField}>
      <SpinButton
        value={value}
        min={1}
        max={3650}
        onChange={(_, data) => {
          const next =
            data.value ?? (data.displayValue !== undefined ? Number(data.displayValue) : NaN);
          if (Number.isFinite(next) && next >= 1) {
            onCommit(Math.floor(next));
          }
        }}
      />
    </Field>
  );

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
      <Text weight="semibold">Features</Text>
      <Text size={200} className={styles.hint}>
        Keep the pane as simple as you like — anything you turn off disappears from the interface
        (your data is kept).
      </Text>
      <Switch
        label="Queue (staging list, Q buttons, Queue tab)"
        checked={prefs?.enableQueue ?? true}
        onChange={(_, data) => void update({ enableQueue: Boolean(data.checked) })}
      />
      <Switch
        label="Usage sorting (count inserts, sort by Recently/Most used)"
        checked={prefs?.enableFrecency ?? true}
        onChange={(_, data) => void update({ enableFrecency: Boolean(data.checked) })}
      />
      <Switch
        label="Rich text snippets (experimental — keep Word formatting)"
        checked={prefs?.enableRichText ?? false}
        onChange={(_, data) => void update({ enableRichText: Boolean(data.checked) })}
      />
      {prefs?.enableRichText && (
        <Text size={200} className={styles.hint}>
          New saves capture formatting (bold, lists, tables) and inserts restore it. Snippets with
          [placeholders] and generated report tables still insert as plain text, and editing a
          snippet&apos;s text drops its stored formatting.
        </Text>
      )}
      <Switch
        label="Quick Save (skip the form when saving a selection)"
        checked={prefs?.quickSaveMode ?? false}
        onChange={(_, data) => void update({ quickSaveMode: Boolean(data.checked) })}
      />
      <Switch
        label="Drag queue items into the document (experimental)"
        checked={prefs?.enableDocDragDrop ?? true}
        onChange={(_, data) => void update({ enableDocDragDrop: Boolean(data.checked) })}
      />
      <Switch
        label="Confirm before creating a new tag"
        checked={prefs ? !prefs.suppressNewTagConfirm : true}
        onChange={(_, data) => void update({ suppressNewTagConfirm: !data.checked })}
      />
      <Switch
        label="Team library (pull shared snippets from a URL)"
        checked={prefs?.enableTeamLibrary ?? false}
        onChange={(_, data) => void update({ enableTeamLibrary: Boolean(data.checked) })}
      />
      {prefs?.enableTeamLibrary && (
        <>
          <Divider />
          <Text weight="semibold">Team library</Text>
          <Text size={200} className={styles.hint}>
            Paste the HTTPS link to your team&apos;s exported .json (a GitHub raw link, GitHub
            Pages, SharePoint — anywhere that allows cross-origin downloads). ReportSnips checks it
            when the pane opens and offers to pull anything new; your own snippets are never changed
            without the import preview.
          </Text>
          <Field
            label="Shared bundle URL"
            validationState={urlValue && !urlValid ? "error" : "none"}
            validationMessage={
              urlValue && !urlValid ? "Enter a full https:// link to the .json file." : undefined
            }
          >
            <Input
              value={urlValue}
              placeholder="https://…/reportsnips-export.json"
              onChange={(_, data) => setUrlDraft(data.value)}
            />
          </Field>
          <div className={styles.row}>
            <Button
              appearance="secondary"
              disabled={urlDraft === null || (urlValue.trim() !== "" && !urlValid)}
              onClick={() => {
                void update({ teamLibraryUrl: urlValue.trim() === "" ? null : urlValue.trim() });
                setUrlDraft(null);
              }}
            >
              Save URL
            </Button>
            <Button
              appearance="secondary"
              disabled={!prefs.teamLibraryUrl || checking}
              onClick={() => {
                setChecking(true);
                void props.onTeamCheckNow().finally(() => setChecking(false));
              }}
            >
              {checking ? "Checking…" : "Check for updates"}
            </Button>
          </div>
          <Text size={200} className={styles.hint}>
            {prefs.teamLibraryLastCheckedAt
              ? `Last checked ${new Date(prefs.teamLibraryLastCheckedAt).toLocaleString()}. `
              : "Not checked yet. "}
            {prefs.teamLibraryLastPulledAt
              ? `Last pulled a bundle exported ${new Date(prefs.teamLibraryLastPulledAt).toLocaleString()}.`
              : "Nothing pulled yet."}
          </Text>
        </>
      )}
      <Divider />
      <Text weight="semibold">Snippet freshness</Text>
      <Switch
        label="Flag stale snippets for review"
        checked={prefs?.staleReviewEnabled ?? false}
        onChange={(_, data) => void updateStale({ staleReviewEnabled: Boolean(data.checked) })}
      />
      {prefs?.staleReviewEnabled && (
        <>
          {daysSpinner(
            "Flag when not edited in (days)",
            prefs.staleEditedDays,
            (days) => void updateStale({ staleEditedDays: days })
          )}
          {daysSpinner(
            "Flag when not used in (days)",
            prefs.staleUnusedDays,
            (days) => void updateStale({ staleUnusedDays: days })
          )}
          <Switch
            label="Show an alert banner when snippets go stale"
            checked={prefs.staleAlerts}
            onChange={(_, data) => void updateStale({ staleAlerts: Boolean(data.checked) })}
          />
          <div className={styles.row}>
            <Button appearance="secondary" onClick={props.onReviewStale}>
              Review stale snippets ({props.staleCount})
            </Button>
          </div>
        </>
      )}
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

      <Divider />
      <div className={styles.row}>
        <Button appearance="secondary" size="small" onClick={() => void copyDiagnostics()}>
          {copied ? "Copied to clipboard" : "Copy diagnostics"}
        </Button>
        <Text size={200} className={styles.hint}>
          ReportSnips v{typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev"} — the
          report contains recent errors only, never snippet content.
        </Text>
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
