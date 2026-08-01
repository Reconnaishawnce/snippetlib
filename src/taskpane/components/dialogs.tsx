/** Shared small dialogs: single-field name entry and destructive confirmation. */
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
} from "@fluentui/react-components";

export interface NameDialogProps {
  open: boolean;
  title: string;
  label: string;
  initialValue?: string;
  submitLabel: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export const NameDialog: React.FC<NameDialogProps> = (props) => {
  const [value, setValue] = React.useState(props.initialValue ?? "");

  React.useEffect(() => {
    if (props.open) {
      setValue(props.initialValue ?? "");
    }
  }, [props.open, props.initialValue]);

  const trimmed = value.trim();
  const submit = () => {
    if (trimmed) {
      props.onSubmit(trimmed);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={(_, data) => !data.open && props.onCancel()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogContent>
            <Field label={props.label} required>
              <Input
                value={value}
                onChange={(_, data) => setValue(data.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                autoFocus
              />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={props.onCancel}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={!trimmed} onClick={submit}>
              {props.submitLabel}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Spell out the specific consequences (§8). */
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = (props) => (
  <Dialog open={props.open} onOpenChange={(_, data) => !data.open && props.onCancel()}>
    <DialogSurface>
      <DialogBody>
        <DialogTitle>{props.title}</DialogTitle>
        <DialogContent>{props.message}</DialogContent>
        <DialogActions>
          <Button appearance="secondary" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button appearance="primary" onClick={props.onConfirm}>
            {props.confirmLabel}
          </Button>
        </DialogActions>
      </DialogBody>
    </DialogSurface>
  </Dialog>
);
