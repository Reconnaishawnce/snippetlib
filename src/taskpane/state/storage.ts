/**
 * The app-wide StorageProvider instance. Stores import { storage } from here;
 * tests swap in a provider backed by fake-indexeddb via setStorageProvider.
 */
/* global __APP_VERSION__ */
import { IndexedDbProvider } from "../../storage/IndexedDbProvider";
import type { StorageProvider } from "../../storage/StorageProvider";

let provider: StorageProvider = new IndexedDbProvider({
  appVersion: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev",
});

export function getStorage(): StorageProvider {
  return provider;
}

export function setStorageProvider(next: StorageProvider): void {
  provider = next;
}
