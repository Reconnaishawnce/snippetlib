/**
 * The Office boundary (TECH_PLAN.md §6): the ONLY file allowed to call
 * Word.run / Office.context. Everything above it is unit-testable with a mock.
 */
/* global Word, Office, setTimeout, clearTimeout, window */
import type { z } from "zod";

/** Returns the text of the current selection ("" when the cursor is collapsed). */
export async function getSelectedText(): Promise<string> {
  return Word.run(async (context) => {
    const selection = context.document.getSelection();
    selection.load("text");
    await context.sync();
    return selection.text;
  });
}

/**
 * Inserts plain text at the cursor, replacing any selection (§6). A trailing
 * space is appended and the cursor lands after it, so consecutive inserts
 * chain naturally instead of stacking on top of each other.
 */
export async function insertText(text: string): Promise<void> {
  await Word.run(async (context) => {
    const range = context.document
      .getSelection()
      .insertText(text + " ", Word.InsertLocation.replace);
    range.select(Word.SelectionMode.end);
    await context.sync();
  });
}

/** One {{marker}} replacement for report generation (see reportPlan.ts). */
export interface ReportSectionWrite {
  /** Literal marker text to find, e.g. "{{HIGH Vulnerabilities}}". */
  marker: string;
  layout: "table" | "paragraphs";
  rows: Array<{ name: string; text: string }>;
}

/**
 * Which of the given markers do NOT appear in the document body. Read-only —
 * called before generation so the user can fix the document or skip sections.
 */
export async function findMissingMarkers(markers: string[]): Promise<string[]> {
  return Word.run(async (context) => {
    const searches = markers.map((marker) => {
      const results = context.document.body.search(marker, { matchCase: false });
      results.load("items");
      return results;
    });
    await context.sync();
    return markers.filter((_, i) => (searches[i]?.items.length ?? 0) === 0);
  });
}

/**
 * Replaces each section's {{marker}} with its content: a 2-column table
 * (snippet name | content) or plain paragraphs (blank line between snippets).
 * Only the first occurrence of a marker is filled; missing markers are
 * silently skipped (the caller pre-checks with findMissingMarkers).
 */
export async function writeReportSections(sections: ReportSectionWrite[]): Promise<void> {
  await Word.run(async (context) => {
    // One sync to find every marker, one sync to write — no per-section syncs.
    const searches = sections.map((section) => {
      const results = context.document.body.search(section.marker, { matchCase: false });
      results.load("items");
      return results;
    });
    await context.sync();
    sections.forEach((section, i) => {
      const range = searches[i]?.items[0];
      if (!range) {
        return;
      }
      if (section.layout === "table") {
        const values = section.rows.map((row) => [row.name, row.text]);
        range.insertTable(values.length, 2, Word.InsertLocation.before, values);
        range.insertText("", Word.InsertLocation.replace);
      } else {
        range.insertText(
          section.rows.map((row) => row.text).join("\n\n"),
          Word.InsertLocation.replace
        );
      }
    });
    await context.sync();
  });
}

/**
 * Opens the report-builder page in a separate Office dialog window. The
 * current queue rides in via the URL hash; the edited outline comes back
 * through dialog messaging (zod-validated by the caller — trust boundary).
 * Resolves when the dialog closes; onMessage fires for each message.
 */
export async function openReportBuilder(
  initialState: unknown,
  onMessage: (message: string) => void
): Promise<void> {
  const url = new window.URL(window.location.href);
  url.pathname = url.pathname.replace(/taskpane\.html$/, "builder.html");
  url.search = "";
  url.hash = `state=${encodeURIComponent(JSON.stringify(initialState))}`;
  await new Promise<void>((resolve, reject) => {
    Office.context.ui.displayDialogAsync(
      url.toString(),
      // Reasonable window: tall for the lists, not monitor-spanning wide.
      { height: 80, width: 65, displayInIframe: false },
      (result) => {
        if (result.status !== Office.AsyncResultStatus.Succeeded) {
          reject(new Error(result.error?.message ?? "Couldn't open the builder window."));
          return;
        }
        const dialog = result.value;
        dialog.addEventHandler(Office.EventType.DialogMessageReceived, (arg) => {
          if ("message" in arg) {
            onMessage(arg.message);
          }
          dialog.close();
          resolve();
        });
        dialog.addEventHandler(Office.EventType.DialogEventReceived, () => {
          // 12006 = user closed the window — treat as cancel.
          resolve();
        });
      }
    );
  });
}

/** Builder page → pane. The ONLY Office call the builder page makes. */
export function sendBuilderMessage(message: string): void {
  Office.context.ui.messageParent(message);
}

/**
 * Reads a JSON value from this document's settings, zod-validated (doc
 * settings are a trust boundary — the file may come from anywhere).
 * Returns undefined when missing or invalid.
 */
export function readDocSettings<T>(key: string, schema: z.ZodType<T>): T | undefined {
  const raw: unknown = Office.context.document.settings.get(key);
  if (raw === null || raw === undefined) {
    return undefined;
  }
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Whether Word's own theme is dark, judged by its body background luminance.
 * Undefined when the host doesn't expose a theme (e.g. outside Office).
 */
export function isOfficeThemeDark(): boolean | undefined {
  try {
    const theme = Office.context?.officeTheme;
    const background = theme?.bodyBackgroundColor;
    if (!background) {
      return undefined;
    }
    const hex = background.replace("#", "");
    if (hex.length < 6) {
      return undefined;
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b < 128;
  } catch {
    return undefined;
  }
}

const SAVE_DEBOUNCE_MS = 2000;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Writes a value into this document's settings. The in-memory set is
 * immediate; the durable saveAsync is debounced 2s (§6).
 */
export function writeDocSettings(key: string, value: unknown): void {
  Office.context.document.settings.set(key, JSON.stringify(value));
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    Office.context.document.settings.saveAsync();
  }, SAVE_DEBOUNCE_MS);
}
