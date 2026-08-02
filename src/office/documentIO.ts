/**
 * The Office boundary (TECH_PLAN.md §6): the ONLY file allowed to call
 * Word.run / Office.context. Everything above it is unit-testable with a mock.
 */
/* global Word, Office, setTimeout, clearTimeout */
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

/** Inserts plain text at the cursor, replacing any selection (§6). */
export async function insertText(text: string): Promise<void> {
  await Word.run(async (context) => {
    context.document.getSelection().insertText(text, Word.InsertLocation.replace);
    await context.sync();
  });
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
