/** Manual review of stale snippets (opt-in freshness feature). */
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
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import type { Snippet } from "../../models/entities";
import type { StaleResult } from "../state/staleness";
import { useSnippetStore } from "../state/snippetStore";

const useStyles = makeStyles({
  list: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    maxHeight: "50vh",
    overflowY: "auto",
  },
  row: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    paddingBottom: tokens.spacingVerticalS,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: tokens.colorNeutralStroke2,
  },
  head: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  name: {
    flexGrow: 1,
    fontWeight: tokens.fontWeightSemibold,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  reason: {
    color: tokens.colorNeutralForeground3,
  },
});

export interface StaleReviewDialogProps {
  open: boolean;
  stale: StaleResult[];
  onEdit: (snippet: Snippet) => void;
  onClose: () => void;
}

export const StaleReviewDialog: React.FC<StaleReviewDialogProps> = ({
  open,
  stale,
  onEdit,
  onClose,
}) => {
  const styles = useStyles();
  const markReviewed = useSnippetStore((s) => s.markReviewed);
  /** Rows dealt with in this dialog session stay hidden until reopen. */
  const [handled, setHandled] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (open) {
      setHandled(new Set());
    }
  }, [open]);

  const visible = stale.filter((r) => !handled.has(r.snippet.id));

  const dismiss = (id: string) => {
    setHandled((prev) => new Set(prev).add(id));
    void markReviewed([id]);
  };

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Review stale snippets ({visible.length})</DialogTitle>
          <DialogContent>
            {visible.length === 0 ? (
              <Text size={200}>Nothing left to review — your library is fresh.</Text>
            ) : (
              <div className={styles.list}>
                {visible.map(({ snippet, reasons }) => (
                  <div key={snippet.id} className={styles.row}>
                    <div className={styles.head}>
                      <span className={styles.name}>{snippet.name}</span>
                      <Button
                        appearance="secondary"
                        size="small"
                        onClick={() => {
                          onClose();
                          onEdit(snippet);
                        }}
                      >
                        Edit…
                      </Button>
                      <Button appearance="subtle" size="small" onClick={() => dismiss(snippet.id)}>
                        Looks fine
                      </Button>
                    </div>
                    <Caption1 className={styles.reason}>{reasons.join(" · ")}</Caption1>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
          <DialogActions>
            {visible.length > 1 && (
              <Button
                appearance="secondary"
                onClick={() => {
                  const ids = visible.map((r) => r.snippet.id);
                  setHandled((prev) => new Set([...prev, ...ids]));
                  void markReviewed(ids);
                }}
              >
                All look fine
              </Button>
            )}
            <Button appearance="primary" onClick={onClose}>
              Done
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
