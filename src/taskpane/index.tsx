import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { isOfficeThemeDark } from "../office/documentIO";
import { installDiagnosticHooks } from "./state/diagnostics";

/* global document, window, Office, HTMLElement */

installDiagnosticHooks();

function prefersDark(): boolean {
  // Word's own theme wins (§8: feel like Word's UI); OS preference is the fallback.
  return (
    isOfficeThemeDark() ?? window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
  );
}

const Root: React.FC = () => {
  const [dark, setDark] = React.useState(prefersDark);

  React.useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) {
      return;
    }
    const onChange = () => setDark(prefersDark());
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);

  return (
    <FluentProvider theme={dark ? webDarkTheme : webLightTheme}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </FluentProvider>
  );
};

const rootElement: HTMLElement | null = document.getElementById("container");
const root = rootElement ? createRoot(rootElement) : undefined;

/* Render application after Office initializes */
Office.onReady(() => {
  root?.render(<Root />);
});
