import * as React from "react";
import { createRoot } from "react-dom/client";
import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { BuilderApp } from "./BuilderApp";

/* global document, window, Office, HTMLElement */

function prefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

const rootElement: HTMLElement | null = document.getElementById("container");
const root = rootElement ? createRoot(rootElement) : undefined;

Office.onReady(() => {
  root?.render(
    <FluentProvider theme={prefersDark() ? webDarkTheme : webLightTheme} style={{ height: "100%" }}>
      <BuilderApp />
    </FluentProvider>
  );
});
