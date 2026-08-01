/**
 * Tag state + Tag Manager operations (§7.4). Rename merges on collision;
 * delete strips the tag from every snippet. All via the StorageProvider.
 */
import { create } from "zustand";
import type { Tag } from "../../models/entities";
import { getStorage } from "./storage";
import { useSnippetStore } from "./snippetStore";
import { useSearchStore } from "./searchStore";

export interface TagState {
  tags: Tag[];

  load(): Promise<void>;
  /** Existing tag on case-insensitive match, else create. Returns the tag. */
  getOrCreate(name: string): Promise<Tag>;
  /** True if `name` matches an existing tag, case-insensitively. */
  exists(name: string): boolean;
  /**
   * Rename. If the new name collides with another tag, merges into it
   * (caller confirms first). Returns the surviving tag.
   */
  rename(id: string, newName: string): Promise<Tag>;
  /** Move all snippets from `fromId` onto `intoId`, then delete `fromId`. */
  merge(fromId: string, intoId: string): Promise<Tag>;
  remove(id: string): Promise<void>;
  /** Snippet count for confirm dialogs. */
  usageOf(id: string): number;
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],

  async load() {
    set({ tags: await getStorage().getAllTags() });
  },

  async getOrCreate(name) {
    const tag = await getStorage().getOrCreateTag(name);
    await get().load();
    return tag;
  },

  exists(name) {
    const needle = name.trim().toLowerCase();
    return get().tags.some((t) => t.name.toLowerCase() === needle);
  },

  async rename(id, newName) {
    const storage = getStorage();
    const tag = get().tags.find((t) => t.id === id);
    if (!tag) {
      throw new Error("Tag not found.");
    }
    const collision = await storage.getTagByName(newName);
    if (collision && collision.id !== id) {
      return get().merge(id, collision.id);
    }
    const updated = await storage.updateTag({ ...tag, name: newName });
    await get().load();
    await useSearchStore.getState().rebuild();
    return updated;
  },

  async merge(fromId, intoId) {
    const storage = getStorage();
    const target = get().tags.find((t) => t.id === intoId);
    if (!target || fromId === intoId) {
      throw new Error("Invalid merge target.");
    }
    const affected = await storage.getSnippetsByTag(fromId);
    for (const snippet of affected) {
      const tagIds = snippet.tagIds.filter((t) => t !== fromId);
      if (!tagIds.includes(intoId)) {
        tagIds.push(intoId);
      }
      await storage.updateSnippet({ ...snippet, tagIds });
    }
    await storage.deleteTag(fromId);
    await get().load();
    await useSnippetStore.getState().reload();
    await useSearchStore.getState().rebuild();
    return (await storage.getTag(intoId)) ?? target;
  },

  async remove(id) {
    await getStorage().deleteTag(id);
    await get().load();
    await useSnippetStore.getState().reload();
    await useSearchStore.getState().rebuild();
  },

  usageOf(id) {
    return get().tags.find((t) => t.id === id)?.usageCount ?? 0;
  },
}));
