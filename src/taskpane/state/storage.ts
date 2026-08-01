/**
 * The app-wide StorageProvider instance. Stores import { storage } from here;
 * tests swap in a provider backed by fake-indexeddb via setStorageProvider.
 */
import { IndexedDbProvider } from "../../storage/IndexedDbProvider";
import type { StorageProvider } from "../../storage/StorageProvider";

let provider: StorageProvider = new IndexedDbProvider({ appVersion: "0.1.0" });

export function getStorage(): StorageProvider {
  return provider;
}

export function setStorageProvider(next: StorageProvider): void {
  provider = next;
}
