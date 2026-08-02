/** Revision history viewer (§7.9): last 3 revisions, read-only, with Restore. */
import * as React from "react";
import {
  Button,
  Caption1,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import type { Snippet } from "../../models/entities";

const useStyles = makeStyles({
  list: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  card: {
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },
  name: {
    flexGrow: 1,
    fontWeight: tokens.fontWeightSemibold,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  content: {
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    color: tokens.colorNeutralForeground2,
    whiteSpace: "pre-wrap",
  },
  empty: {
    color: tokens.colorNeutralForeground3,
  },
});

export interface HistoryDialogProps {
  snippet: Snippet | null;
  onRestore: (snippet: Snippet, revisionIndex: number) => void;
  onClose: () => void;
}

export const HistoryDialog: React.FC<HistoryDialogProps> = ({ snippet, onRestore, onClose }) => {
  const styles = useStyles();
  return (
    <Dialog open={snippet !== null} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>History — {snippet?.name ?? ""}</DialogTitle>
          <DialogContent>
            {snippet && snippet.history.length === 0 ? (
              <Text className={styles.empty}>
                No earlier revisions yet. The last 3 versions are kept each time you update this
                snippet&apos;s content.
              </Text>
            ) : (
              <div className={styles.list}>
                {snippet?.history.map((revision, index) => (
                  <Card key={`${revision.savedAt}-${index}`} className={styles.card} size="small">
                    <div className={styles.header}>
                      <span className={styles.name}>{revision.name}</span>
                      <Button
                        appearance="secondary"
                        size="small"
                        onClick={() => onRestore(snippet, index)}
                      >
                        Restore
                      </Button>
                    </div>
                    <Caption1>Saved {new Date(revision.savedAt).toLocaleString()}</Caption1>
                    {/* Untrusted plain text — rendered as a text node only. */}
                    <Text size={200} className={styles.content}>
                      {revision.content}
                    </Text>
                  </Card>
                ))}
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              Close
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
