/** One-click "Q" — adds a snippet to the Queue's last-used section (§7.7). */
import * as React from "react";
import { Button, Tooltip, makeStyles, tokens } from "@fluentui/react-components";
import { useQueueStore } from "../state/queueStore";

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
