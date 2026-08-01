/** Placeholders tab (§7.6): captured values for the current document, editable. */
import * as React from "react";
import { Button, Input, Text, makeStyles, tokens } from "@fluentui/react-components";
import { Delete16Regular } from "@fluentui/react-icons";
import { usePlaceholderStore } from "../state/placeholderStore";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  note: {
    color: tokens.colorNeutralForeground3,
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
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
    paddingTop: tokens.spacingVerticalXXL,
  },
});

export const PlaceholdersTab: React.FC = () => {
  const styles = useStyles();
  const { values, displays, setValue, removeValue } = usePlaceholderStore();
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});

  const keys = Object.keys(values).sort((a, b) =>
    (displays[a] ?? a).localeCompare(displays[b] ?? b)
  );

  if (keys.length === 0) {
    return (
      <div className={styles.empty}>
        <Text>
          No placeholder values captured for this document yet. Insert a snippet containing
          [Placeholder Name] tokens and you&apos;ll be prompted once — values are remembered here.
        </Text>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <Text size={200} className={styles.note}>
        Values apply to this document. Editing a value affects future inserts only — text already in
        the document is not changed.
      </Text>
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
              onChange={(_, data) => setDrafts((prev) => ({ ...prev, [key]: data.value }))}
              onBlur={() => {
                if (draft !== undefined && draft !== values[key]) {
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
              aria-label={`Forget value for ${display}`}
              onClick={() => removeValue(key)}
            />
          </div>
        );
      })}
    </div>
  );
};
