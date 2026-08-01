/** Unknown-placeholder prompt shown at insert time (§7.6). */
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
  Input,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import type { ParsedPlaceholder } from "../../office/placeholderEngine";

const useStyles = makeStyles({
  fields: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  note: {
    color: tokens.colorNeutralForeground3,
  },
});

export interface PlaceholderDialogProps {
  open: boolean;
  missing: ParsedPlaceholder[];
  /** Filled values by normalized key — blanks are omitted (token kept). */
  onSubmit: (filled: Record<string, string>) => void;
  onCancel: () => void;
}

export const PlaceholderDialog: React.FC<PlaceholderDialogProps> = (props) => {
  const styles = useStyles();
  const [inputs, setInputs] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (props.open) {
      setInputs({});
    }
  }, [props.open]);

  const submit = () => {
    const filled: Record<string, string> = {};
    for (const placeholder of props.missing) {
      const value = inputs[placeholder.key];
      if (value !== undefined && value.trim() !== "") {
        filled[placeholder.key] = value;
      }
    }
    props.onSubmit(filled);
  };

  return (
    <Dialog open={props.open} onOpenChange={(_, data) => !data.open && props.onCancel()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>New placeholders in this snippet</DialogTitle>
          <DialogContent>
            <div className={styles.fields}>
              <Text size={200} className={styles.note}>
                Values you enter are remembered for this document, so later inserts fill them in
                automatically. Leave a field blank to keep the [token] for manual handling.
              </Text>
              {props.missing.map((placeholder) => (
                <Field key={placeholder.key} label={placeholder.display}>
                  <Input
                    value={inputs[placeholder.key] ?? ""}
                    onChange={(_, data) =>
                      setInputs((prev) => ({ ...prev, [placeholder.key]: data.value }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                  />
                </Field>
              ))}
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={props.onCancel}>
              Cancel
            </Button>
            <Button appearance="primary" onClick={submit}>
              Insert
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
