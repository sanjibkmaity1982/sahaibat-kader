// lib/offlineStore.ts
// IndexedDB queue for offline triage cases.
// Cases saved here survive phone restarts and sync when signal returns.

export interface QueuedCase {
  localId: string;
  profileId: string;
  ngoId: string;
  childName: string;
  ageMonths: number;
  gender: 'male' | 'female';
  weightKg: number;
  heightCm: number;
  muacCm: number | null;
  feedingFreq: '1' | '2' | '3';
  milestoneScore: '1' | '2' | '3';
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  reportText: string;
  referNow: boolean;
  followUpDays: number;
  createdAt: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  syncError?: string;
}

const DB_NAME = 'sahaibat_kader';
const DB_VERSION = 1;
const STORE_NAME = 'queued_cases';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCase(c: QueuedCase): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(c);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingCases(): Promise<QueuedCase[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('syncStatus');
    const req = index.getAll('pending');
    req.onsuccess = () => resolve(req.result as QueuedCase[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllCases(): Promise<QueuedCase[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result as QueuedCase[])
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    req.onerror = () => reject(req.error);
  });
}

export async function markSynced(localId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(localId);
    req.onsuccess = () => {
      const record = req.result as QueuedCase;
      if (record) {
        record.syncStatus = 'synced';
        store.put(record);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function markSyncFailed(localId: string, error: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(localId);
    req.onsuccess = () => {
      const record = req.result as QueuedCase;
      if (record) {
        record.syncStatus = 'failed';
        record.syncError = error;
        store.put(record);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('syncStatus');
    const req = index.count('pending');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
