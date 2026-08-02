/**
 * Pure queue reducers (§7.7). Every function returns a new QueueState; no
 * storage, Office, or React dependencies — fully unit-tested.
 */
import type {
  QueueItem,
  QueueSection,
  QueueState,
  QueueTemplateSection,
} from "../../models/entities";
import { newId } from "../../models/ids";

export const DEFAULT_SECTION_NAME = "Queue";

export function emptyQueue(): QueueState {
  return { sections: [] };
}

function resequence(items: QueueItem[]): QueueItem[] {
  return items.map((item, index) => ({ ...item, sortOrder: index }));
}

function resequenceSections(sections: QueueSection[]): QueueSection[] {
  return sections.map((section, index) => ({ ...section, sortOrder: index }));
}

/** Sections sorted for display; inserted items sink to the bottom (§7.7). */
export function displaySections(state: QueueState): QueueSection[] {
  return [...state.sections]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((section) => ({
      ...section,
      items: [...section.items].sort(
        (a, b) => Number(a.inserted) - Number(b.inserted) || a.sortOrder - b.sortOrder
      ),
    }));
}

export function unInsertedCount(state: QueueState): number {
  return state.sections.reduce(
    (sum, section) => sum + section.items.filter((item) => !item.inserted).length,
    0
  );
}

export function addSection(state: QueueState, name: string): QueueState {
  const section: QueueSection = {
    id: newId(),
    name,
    sortOrder: state.sections.length,
    items: [],
  };
  return { sections: [...state.sections, section] };
}

export function renameSection(state: QueueState, sectionId: string, name: string): QueueState {
  return {
    sections: state.sections.map((s) => (s.id === sectionId ? { ...s, name } : s)),
  };
}

/**
 * Deletes a section. Its items move to the first remaining section (never
 * silently dropped); deleting the last section moves items to a fresh default.
 */
export function deleteSection(state: QueueState, sectionId: string): QueueState {
  const doomed = state.sections.find((s) => s.id === sectionId);
  if (!doomed) {
    return state;
  }
  let remaining = state.sections.filter((s) => s.id !== sectionId);
  if (doomed.items.length > 0) {
    if (remaining.length === 0) {
      remaining = [{ id: newId(), name: DEFAULT_SECTION_NAME, sortOrder: 0, items: [] }];
    }
    const target = remaining[0]!;
    remaining = remaining.map((s) =>
      s.id === target.id ? { ...s, items: resequence([...s.items, ...doomed.items]) } : s
    );
  }
  return { sections: resequenceSections(remaining) };
}

/**
 * Adds a snippet to a section (created on demand if the queue is empty).
 * Returns the new state and the id of the section used.
 */
export function addToQueue(
  state: QueueState,
  snippetId: string,
  sectionId?: string
): { state: QueueState; sectionId: string } {
  let sections = state.sections;
  let target = sections.find((s) => s.id === sectionId) ?? sections[0];
  if (!target) {
    target = { id: newId(), name: DEFAULT_SECTION_NAME, sortOrder: 0, items: [] };
    sections = [target];
  }
  const item: QueueItem = {
    id: newId(),
    snippetId,
    sortOrder: target.items.length,
    inserted: false,
  };
  return {
    state: {
      sections: sections.map((s) => (s.id === target.id ? { ...s, items: [...s.items, item] } : s)),
    },
    sectionId: target.id,
  };
}

export function removeItem(state: QueueState, itemId: string): QueueState {
  return {
    sections: state.sections.map((s) => ({
      ...s,
      items: resequence(s.items.filter((i) => i.id !== itemId)),
    })),
  };
}

/** Marks items inserted (dimmed + struck through in the UI, not removed). */
export function markInserted(state: QueueState, itemIds: string[]): QueueState {
  const ids = new Set(itemIds);
  return {
    sections: state.sections.map((s) => ({
      ...s,
      items: s.items.map((i) => (ids.has(i.id) ? { ...i, inserted: true } : i)),
    })),
  };
}

export function clearInserted(state: QueueState, sectionId: string): QueueState {
  return {
    sections: state.sections.map((s) =>
      s.id === sectionId ? { ...s, items: resequence(s.items.filter((i) => !i.inserted)) } : s
    ),
  };
}

/**
 * Moves an item to `targetSectionId` at `targetIndex` (within its un-inserted
 * display order). Also used for same-section reordering.
 */
export function moveItem(
  state: QueueState,
  itemId: string,
  targetSectionId: string,
  targetIndex: number
): QueueState {
  let moved: QueueItem | undefined;
  const without = state.sections.map((s) => {
    const found = s.items.find((i) => i.id === itemId);
    if (found) {
      moved = found;
    }
    return { ...s, items: s.items.filter((i) => i.id !== itemId) };
  });
  if (!moved) {
    return state;
  }
  return {
    sections: without.map((s) => {
      if (s.id !== targetSectionId) {
        return { ...s, items: resequence(s.items) };
      }
      const items = [...s.items];
      const clamped = Math.max(0, Math.min(targetIndex, items.length));
      items.splice(clamped, 0, moved!);
      return { ...s, items: resequence(items) };
    }),
  };
}

/** Drops references to snippets that no longer exist is NOT done here — the UI
 * renders dangling items as "(snippet deleted)" with a remove affordance (§7.7). */
export function itemsOfSection(state: QueueState, sectionId: string): QueueItem[] {
  return state.sections.find((s) => s.id === sectionId)?.items ?? [];
}

/** The current queue as a reusable template shape (section names + snippet ids). */
export function toTemplateSections(state: QueueState): QueueTemplateSection[] {
  return displaySections(state).map((section) => ({
    name: section.name,
    snippetIds: [...section.items]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => item.snippetId),
  }));
}

/**
 * Appends a template's sections to the queue (fresh ids, nothing inserted).
 * Appending — not replacing — so loading into a working document is safe.
 */
export function appendTemplate(state: QueueState, sections: QueueTemplateSection[]): QueueState {
  const base = Math.max(0, ...state.sections.map((s) => s.sortOrder + 1));
  const added = sections.map((section, i) => ({
    id: newId(),
    name: section.name,
    sortOrder: base + i,
    items: section.snippetIds.map((snippetId, j) => ({
      id: newId(),
      snippetId,
      sortOrder: j,
      inserted: false,
    })),
  }));
  return { sections: [...state.sections, ...added] };
}
