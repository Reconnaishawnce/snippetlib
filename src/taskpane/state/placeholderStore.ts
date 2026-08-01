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
  /** normalized key → first-seen display casing. */
  displays: Record<string, string>;

  load(): void;
  /** Store (or update) a value; records the display casing on first sight. */
  setValue(display: string, value: string): void;
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
    const values = { ...get().values, [key]: value };
    const displays = { ...get().displays };
    if (!displays[key]) {
      displays[key] = display;
    }
    set({ values, displays });
    writeDocSettings(VALUES_KEY, values);
    writeDocSettings(DISPLAYS_KEY, displays);
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
