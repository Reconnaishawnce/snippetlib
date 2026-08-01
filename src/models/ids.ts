/* global crypto */

/** UUID v4 generator with a fallback for webviews lacking crypto.randomUUID. */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Math.random-based v4 fallback: uniqueness (not cryptographic strength) is
  // all snippet ids need, and older Office webviews lack crypto.randomUUID.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
