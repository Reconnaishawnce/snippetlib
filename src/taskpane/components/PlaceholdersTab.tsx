/** Placeholders tab (§7.6): captured values for the current document, editable. */
import * as React from "react";
import {
  Button,
  Input,
  Text,
  Toast,
  ToastTitle,
  Tooltip,
  makeStyles,
  tokens,
  useToastController,
} from "@fluentui/react-components";
import { Delete16Regular, DocumentSearch16Regular } from "@fluentui/react-icons";
import { uniquePlaceholders } from "../../office/placeholderEngine";
import { usePlaceholderStore } from "../state/placeholderStore";
import { getStorage } from "../state/storage";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  headerRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: tokens.spacingHorizontalXS,
  },
  note: {
    color: tokens.colorNeutralForeground3,
    flexGrow: 1,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },
  label: {
    width: "40%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
  },
  value: {
    flexGrow: 1,
    minWidth: "0",
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: tokens.spacingVerticalM,
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
    paddingTop: tokens.spacingVerticalXXL,
  },
});

export const PlaceholdersTab: React.FC = () => {
  const styles = useStyles();
  const { values, displays, setValue, removeValue, registerDisplays } = usePlaceholderStore();
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const { dispatchToast } = useToastController();

  // Scan every snippet for [Placeholder] tokens and pre-list them here, so
  // values can be filled ahead of any insert (owner request, 2026-08-01).
  const scan = async () => {
    const snippets = await getStorage().getAllSnippets();
    const found = new Map<string, string>();
    for (const snippet of snippets) {
      for (const placeholder of uniquePlaceholders(snippet.content)) {
        if (!found.has(placeholder.key)) {
          found.set(placeholder.key, placeholder.display);
        }
      }
    }
    const added = registerDisplays(
      [...found.entries()].map(([key, display]) => ({ key, display }))
    );
    dispatchToast(
      <Toast>
        <ToastTitle>
          {found.size === 0
            ? "No placeholders found in your snippets."
            : `Found ${found.size} placeholder${found.size === 1 ? "" : "s"} (${added} new).`}
        </ToastTitle>
      </Toast>,
      { intent: "success" }
    );
  };

  const scanButton = (
    <Tooltip
      content="Find every [Placeholder] in your snippet library and list it here to fill in ahead of time"
      relationship="description"
    >
      <Button
        appearance="subtle"
        size="small"
        icon={<DocumentSearch16Regular />}
        onClick={() => void scan()}
      >
        Scan snippets
      </Button>
    </Tooltip>
  );

  const keys = [...new Set([...Object.keys(displays), ...Object.keys(values)])].sort((a, b) =>
    (displays[a] ?? a).localeCompare(displays[b] ?? b)
  );

  if (keys.length === 0) {
    return (
      <div className={styles.empty}>
        <Text>
          No placeholder values captured for this document yet. Insert a snippet containing
          [Placeholder Name] tokens and you&apos;ll be prompted once — or scan your library to fill
          values in ahead of time.
        </Text>
        {scanButton}
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.headerRow}>
        <Text size={200} className={styles.note}>
          Values apply to this document. Editing a value affects future inserts only — text already
          in the document is not changed.
        </Text>
        {scanButton}
      </div>
      {keys.map((key) => {
        const display = displays[key] ?? key;
        const draft = drafts[key];
        return (
          <div key={key} className={styles.row}>
            <span className={styles.label} title={display}>
              {display}
            </span>
            <Input
              className={styles.value}
              value={draft ?? values[key] ?? ""}
              placeholder="Not set — will prompt"
              onChange={(_, data) => setDrafts((prev) => ({ ...prev, [key]: data.value }))}
              onBlur={() => {
                if (draft !== undefined && draft !== (values[key] ?? "")) {
                  setValue(display, draft);
                }
                setDrafts((prev) => {
                  const next = { ...prev };
                  delete next[key];
                  return next;
                });
              }}
              aria-label={`Value for ${display}`}
            />
            <Button
              appearance="subtle"
              size="small"
              icon={<Delete16Regular />}
              aria-label={`Remove ${display}`}
              onClick={() => removeValue(key)}
            />
          </div>
        );
      })}
    </div>
  );
};
