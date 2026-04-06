// lib/offlineStore.ts
// IndexedDB queue for offline triage cases — all 4 modules.
// DB_VERSION bumped to 2 to support new moduleType + payload fields.

export type ModuleType = 'child' | 'maternal' | 'postpartum' | 'neonatal';

export interface QueuedCase {
  localId: string;
  profileId: string;
  ngoId: string;
  moduleType: ModuleType;

  // Universal patient fields
  patientName: string;
  nik?: string;                // NIK 16 digit — wajib untuk child module
  dob?: string | null;         // ISO YYYY-MM-DD from DOB input
  ageMonths: number | null;    // null for maternal/postpartum
  ageDays: number | null;      // for neonatal (0-28 days)
  gender: 'male' | 'female' | 'unknown';

  // Child growth fields (moduleType === 'child')
  weightKg?: number | null;
  heightCm?: number | null;
  waz?: string;                // WHO weight-for-age
  laz?: string;                // WHO length-for-age
  wlz?: string;                // WHO weight-for-length
  muacCat?: 'sam' | 'mam' | 'normal';  // MUAC classification
  muacCm?: number | null;
  feedingFreq?: '1' | '2' | '3' | null;
  milestoneScore?: '1' | '2' | '3' | null;

  // Flexible payload for maternal/postpartum/neonatal answers
  payload?: Record<string, any>;

  // Universal result fields
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  reportText: string;
  referNow: boolean;
  followUpDays: number;

  createdAt: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  syncError?: string;
}

// ── Legacy support — keep childName as alias for patientName ─────────────────
// Existing child cases use childName. New code uses patientName.
export function getPatientName(c: QueuedCase): string {
  return c.patientName || (c as any).childName || 'Tidak diketahui';
}

// ── IndexedDB ─────────────────────────────────────────────────────────────────
const DB_NAME = 'sahaibat_kader';
const DB_VERSION = 2;
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
        store.createIndex('moduleType', 'moduleType', { unique: false });
      } else {
        // Version 2 migration: add moduleType index if not exists
        const tx = (e.target as IDBOpenDBRequest).transaction!;
        const store = tx.objectStore(STORE_NAME);
        if (!store.indexNames.contains('moduleType')) {
          store.createIndex('moduleType', 'moduleType', { unique: false });
        }
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
    req.onsuccess = () => resolve(
      (req.result as QueuedCase[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    );
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
      if (record) { record.syncStatus = 'synced'; store.put(record); }
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
      if (record) { record.syncStatus = 'failed'; record.syncError = error; store.put(record); }
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

// ── Age display helper (shared across all modules) ────────────────────────────
export function formatAge(ageMonths: number | null, ageDays: number | null): string {
  if (ageDays !== null && ageDays >= 0 && ageDays <= 28) {
    return `${ageDays} hari`;
  }
  if (ageMonths === null) return '-';
  if (ageMonths === 0) return '< 1 bulan';
  if (ageMonths < 12) return `${ageMonths} bulan`;
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  if (months === 0) return `${years} tahun`;
  return `${years} tahun ${months} bulan`;
}

// ── Module colour (for history cards) ────────────────────────────────────────
export function moduleColor(moduleType: ModuleType): string {
  switch (moduleType) {
    case 'child':      return '#02C39A'; // teal
    case 'maternal':   return '#E91E8C'; // pink
    case 'postpartum': return '#9C27B0'; // purple
    case 'neonatal':   return '#FF9800'; // orange
  }
}

export function moduleLabel(moduleType: ModuleType): string {
  switch (moduleType) {
    case 'child':      return 'Posyandu Anak';
    case 'maternal':   return 'Ibu Hamil';
    case 'postpartum': return 'Ibu Nifas';
    case 'neonatal':   return 'Bayi Baru Lahir';
  }
}
