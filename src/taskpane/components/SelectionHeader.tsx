/** Multi-select header: appears when items are checked (§7.5). */
import * as React from "react";
import { Button, Text, makeStyles, tokens } from "@fluentui/react-components";
import { TextAdd20Regular, Dismiss16Regular } from "@fluentui/react-icons";

const useStyles = makeStyles({
  root: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    paddingTop: "2px",
    paddingBottom: "2px",
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  count: {
    flexGrow: 1,
  },
});

export interface SelectionHeaderProps {
  count: number;
  onInsertAll: () => void;
  onClear: () => void;
}

export const SelectionHeader: React.FC<SelectionHeaderProps> = ({
  count,
  onInsertAll,
  onClear,
}) => {
  const styles = useStyles();
  if (count === 0) {
    return null;
  }
  return (
    <div className={styles.root}>
      <Text size={200} className={styles.count}>
        {count} selected
      </Text>
      <Button appearance="primary" size="small" icon={<TextAdd20Regular />} onClick={onInsertAll}>
        Insert All
      </Button>
      <Button
        appearance="subtle"
        size="small"
        icon={<Dismiss16Regular />}
        aria-label="Clear selection"
        onClick={onClear}
      />
    </div>
  );
};
