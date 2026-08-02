/**
 * Per-document Queue state (§7.7), persisted in the Word document's settings
 * so it travels with the file. All mutations go through the pure queueOps.
 */
import { create } from "zustand";
import { z } from "zod";
import type { QueueState as QueueData, QueueTemplate } from "../../models/entities";
import { queueStateSchema } from "../../models/schemas";
import { readDocSettings, writeDocSettings } from "../../office/documentIO";
import { getStorage } from "./storage";
import * as ops from "./queueOps";

const QUEUE_KEY = "reportsnips.queue";
const LAST_SECTION_KEY = "reportsnips.queueLastSection";

export interface QueueStoreState {
  queue: QueueData;
  /** Remembered target for the section picker (§7.7). */
  lastSectionId: string | null;

  load(): void;
  addSnippet(snippetId: string, sectionId?: string): void;
  addSection(name: string): void;
  renameSection(sectionId: string, name: string): void;
  deleteSection(sectionId: string): void;
  removeItem(itemId: string): void;
  markInserted(itemIds: string[]): void;
  clearInserted(sectionId: string): void;
  moveItem(itemId: string, targetSectionId: string, targetIndex: number): void;
  /** Save the current queue layout as a named, reusable template. */
  saveAsTemplate(name: string): Promise<QueueTemplate>;
  /** Append a template's sections (fresh ids, nothing marked inserted). */
  loadTemplate(template: QueueTemplate): void;
}

export const useQueueStore = create<QueueStoreState>((set, get) => {
  const persist = (queue: QueueData) => {
    set({ queue });
    writeDocSettings(QUEUE_KEY, queue);
  };

  return {
    queue: ops.emptyQueue(),
    lastSectionId: null,

    load() {
      // Doc settings are a trust boundary — zod-validated on read.
      const queue = readDocSettings(QUEUE_KEY, queueStateSchema) ?? ops.emptyQueue();
      const lastSectionId = readDocSettings(LAST_SECTION_KEY, z.string()) ?? null;
      set({ queue, lastSectionId });
    },

    addSnippet(snippetId, sectionId) {
      const preferred = sectionId ?? get().lastSectionId ?? undefined;
      const { state, sectionId: used } = ops.addToQueue(get().queue, snippetId, preferred);
      persist(state);
      set({ lastSectionId: used });
      writeDocSettings(LAST_SECTION_KEY, used);
    },

    addSection(name) {
      persist(ops.addSection(get().queue, name));
    },

    renameSection(sectionId, name) {
      persist(ops.renameSection(get().queue, sectionId, name));
    },

    deleteSection(sectionId) {
      persist(ops.deleteSection(get().queue, sectionId));
      if (get().lastSectionId === sectionId) {
        set({ lastSectionId: null });
      }
    },

    removeItem(itemId) {
      persist(ops.removeItem(get().queue, itemId));
    },

    markInserted(itemIds) {
      persist(ops.markInserted(get().queue, itemIds));
    },

    clearInserted(sectionId) {
      persist(ops.clearInserted(get().queue, sectionId));
    },

    moveItem(itemId, targetSectionId, targetIndex) {
      persist(ops.moveItem(get().queue, itemId, targetSectionId, targetIndex));
    },

    async saveAsTemplate(name) {
      return getStorage().saveQueueTemplate(name, ops.toTemplateSections(get().queue));
    },

    loadTemplate(template) {
      persist(ops.appendTemplate(get().queue, template.sections));
    },
  };
});
