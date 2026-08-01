/**
 * Zod schemas mirroring src/models/entities.ts.
 *
 * Used at trust boundaries only: import bundles (§7.8) and Word document
 * settings reads (§6). Internal storage reads/writes are typed, not re-validated.
 */
import { z } from "zod";
import { EXPORT_FORMAT_VERSION } from "./entities";

const isoDateString = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid ISO date string" });

const id = z.string().min(1);

export const librarySchema = z.object({
  id,
  name: z.string().min(1),
  description: z.string().optional(),
  createdAt: isoDateString,
  updatedAt: isoDateString,
});

export const folderSchema = z.object({
  id,
  libraryId: id,
  parentId: id.nullable(),
  name: z.string().min(1),
  sortOrder: z.number(),
  createdAt: isoDateString,
  updatedAt: isoDateString,
});

export const snippetMembershipSchema = z.object({
  libraryId: id,
  folderId: id.nullable(),
});

export const snippetRevisionSchema = z.object({
  content: z.string(),
  name: z.string(),
  savedAt: isoDateString,
});

export const snippetSchema = z.object({
  id,
  name: z.string().min(1),
  content: z.string(),
  tagIds: z.array(id),
  memberships: z.array(snippetMembershipSchema),
  history: z.array(snippetRevisionSchema).max(3),
  createdAt: isoDateString,
  updatedAt: isoDateString,
});

export const tagSchema = z.object({
  id,
  name: z.string().min(1),
  usageCount: z.number().int().nonnegative(),
  createdAt: isoDateString,
  updatedAt: isoDateString,
});

export const appPrefsSchema = z.object({
  activeLibraryId: id.nullable(),
  suppressNewTagConfirm: z.boolean(),
  lastExportAt: isoDateString.nullable(),
  changesSinceExport: z.number().int().nonnegative(),
});

/** ---- Document-scoped state (validated on every doc-settings read) ---- */

export const documentPlaceholderValuesSchema = z.record(z.string(), z.string());

export const queueItemSchema = z.object({
  id,
  snippetId: id,
  sortOrder: z.number(),
  inserted: z.boolean(),
});

export const queueSectionSchema = z.object({
  id,
  name: z.string(),
  sortOrder: z.number(),
  items: z.array(queueItemSchema),
});

export const queueStateSchema = z.object({
  sections: z.array(queueSectionSchema),
});

/** ---- Import/export bundle ---- */

export const exportBundleSchema = z.object({
  formatVersion: z.literal(EXPORT_FORMAT_VERSION),
  appVersion: z.string(),
  exportedAt: isoDateString,
  libraries: z.array(librarySchema),
  folders: z.array(folderSchema),
  snippets: z.array(snippetSchema),
  tags: z.array(tagSchema),
});

export const importConflictPolicySchema = z.enum(["keep-mine", "take-theirs", "keep-both"]);
