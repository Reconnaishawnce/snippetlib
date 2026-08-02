/** Last-resort error boundary (§9 M7): a readable fallback instead of a blank pane. */
/* global window */
import * as React from "react";
import { Button, MessageBar, MessageBarBody, makeStyles, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalL,
  },
});

const Fallback: React.FC<{ message: string }> = ({ message }) => {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <MessageBar intent="error">
        <MessageBarBody>
          ReportSnips hit an unexpected error: {message}. Your snippet library is safe — reload the
          pane to continue.
        </MessageBarBody>
      </MessageBar>
      <Button appearance="primary" onClick={() => window.location.reload()}>
        Reload ReportSnips
      </Button>
    </div>
  );
};

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override render(): React.ReactNode {
    if (this.state.error) {
      return <Fallback message={this.state.error.message} />;
    }
    return this.props.children;
  }
}
