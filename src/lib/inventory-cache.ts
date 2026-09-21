"use client";

import type { Product, StockTransaction } from "@/lib/types";

const DATABASE_NAME = "inventory-system-cache";
const STORE_NAME = "snapshots";
const SNAPSHOT_KEY_PREFIX = "latest-inventory";

export type CachedInventorySnapshot = {
  products: Product[];
  transactions: StockTransaction[];
  savedAt: string;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function snapshotKey(scope: string) {
  return `${SNAPSHOT_KEY_PREFIX}:${scope}`;
}

export async function saveInventorySnapshot(scope: string, snapshot: CachedInventorySnapshot) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(snapshot, snapshotKey(scope));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function loadInventorySnapshot(scope: string): Promise<CachedInventorySnapshot | null> {
  const database = await openDatabase();
  const snapshot = await new Promise<CachedInventorySnapshot | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(snapshotKey(scope));
    request.onsuccess = () => resolve((request.result as CachedInventorySnapshot | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return snapshot;
}
