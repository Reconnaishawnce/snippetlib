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
