/** App preferences store (§6) — the one place UI reads/writes AppPrefs. */
import { create } from "zustand";
import type { AppPrefs } from "../../models/entities";
import { getStorage } from "./storage";

export interface PrefsState {
  prefs: AppPrefs | null;
  load(): Promise<void>;
  update(patch: Partial<AppPrefs>): Promise<void>;
}

export const usePrefsStore = create<PrefsState>((set) => ({
  prefs: null,

  async load() {
    set({ prefs: await getStorage().getPrefs() });
  },

  async update(patch) {
    set({ prefs: await getStorage().updatePrefs(patch) });
  },
}));
