/**
 * Per-document placeholder values (§7.6), persisted in the Word document's
 * settings via documentIO so they travel with the file. Keys are normalized;
 * first-seen display casing is kept alongside for the UI.
 */
import { create } from "zustand";
import { documentPlaceholderValuesSchema } from "../../models/schemas";
import { readDocSettings, writeDocSettings } from "../../office/documentIO";
import { normalizeKey } from "../../office/placeholderEngine";

const VALUES_KEY = "reportsnips.placeholderValues";
const DISPLAYS_KEY = "reportsnips.placeholderDisplays";

export interface PlaceholderState {
  /** normalized key → substitution value for this document. */
  values: Record<string, string>;
  /**
   * normalized key → first-seen display casing. May contain keys with no
   * value yet (pre-listed via Scan snippets) — those still prompt on insert.
   */
  displays: Record<string, string>;

  load(): void;
  /**
   * Store (or update) a value; records the display casing on first sight.
   * An empty value un-sets the entry (it will prompt again on insert).
   */
  setValue(display: string, value: string): void;
  /** Pre-list placeholders (display only, no value) — the Scan feature. */
  registerDisplays(entries: { key: string; display: string }[]): number;
  removeValue(key: string): void;
}

export const usePlaceholderStore = create<PlaceholderState>((set, get) => ({
  values: {},
  displays: {},

  load() {
    // Both reads cross a trust boundary (the document file) — zod-validated.
    const values = readDocSettings(VALUES_KEY, documentPlaceholderValuesSchema) ?? {};
    const displays = readDocSettings(DISPLAYS_KEY, documentPlaceholderValuesSchema) ?? {};
    set({ values, displays });
  },

  setValue(display, value) {
    const key = normalizeKey(display);
    if (!key) {
      return;
    }
    const values = { ...get().values };
    if (value === "") {
      delete values[key]; // blank = unset: keep the row, prompt again on insert
    } else {
      values[key] = value;
    }
    const displays = { ...get().displays };
    if (!displays[key]) {
      displays[key] = display;
    }
    set({ values, displays });
    writeDocSettings(VALUES_KEY, values);
    writeDocSettings(DISPLAYS_KEY, displays);
  },

  registerDisplays(entries) {
    const displays = { ...get().displays };
    let added = 0;
    for (const entry of entries) {
      if (entry.key && !displays[entry.key]) {
        displays[entry.key] = entry.display;
        added += 1;
      }
    }
    if (added > 0) {
      set({ displays });
      writeDocSettings(DISPLAYS_KEY, displays);
    }
    return added;
  },

  removeValue(key) {
    const values = { ...get().values };
    const displays = { ...get().displays };
    delete values[key];
    delete displays[key];
    set({ values, displays });
    writeDocSettings(VALUES_KEY, values);
    writeDocSettings(DISPLAYS_KEY, displays);
  },
}));
