/** One-click "Q" — adds a snippet to the Queue's last-used section (§7.7). */
import * as React from "react";
import { Button, Tooltip, makeStyles, tokens } from "@fluentui/react-components";
import { useQueueStore } from "../state/queueStore";
import { usePrefsStore } from "../state/prefsStore";

const useStyles = makeStyles({
  q: {
    fontWeight: tokens.fontWeightBold,
    minWidth: "24px",
    paddingLeft: "0",
    paddingRight: "0",
  },
});

export const QuickQueueButton: React.FC<{ snippetId: string; snippetName: string }> = ({
  snippetId,
  snippetName,
}) => {
  const styles = useStyles();
  const addSnippet = useQueueStore((s) => s.addSnippet);
  const enableQueue = usePrefsStore((s) => s.prefs?.enableQueue ?? true);
  if (!enableQueue) {
    return null;
  }
  return (
    <Tooltip content="Add to Queue" relationship="label">
      <Button
        appearance="subtle"
        size="small"
        className={styles.q}
        aria-label={`Add ${snippetName} to Queue`}
        onClick={() => addSnippet(snippetId)}
      >
        Q
      </Button>
    </Tooltip>
  );
};
