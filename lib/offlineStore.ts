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

// ── Cached case (server-derived, read-only history view) ─────────────────────
// Mirrors the shape returned by GET /api/pwa/cases and the recent_cases
// field of POST /api/pwa/sync. These records are NOT created locally — they
// arrive from the server and are cached here for offline viewing only.
export interface CachedCase {
  case_id: string;             // padded "000847"
  created_at: string;          // ISO UTC
  module_type: string | null;  // "Posyandu" | "Bayi Baru Lahir" | etc.
  patient_name: string | null;
  risk_level: string | null;
  patient_age_label: string;   // "8 bulan" / "Hamil 23 mgg"
  risk_visual: 'red' | 'amber' | 'green' | 'gray';
  primary_finding: string;
  primary_action: string;
}

// ── Legacy support — keep childName as alias for patientName ─────────────────
export function getPatientName(c: QueuedCase): string {
  return c.patientName || (c as any).childName || 'Tidak diketahui';
}

// ── IndexedDB ─────────────────────────────────────────────────────────────────
const DB_NAME = 'sahaibat_kader';
const DB_VERSION = 3;
const STORE_NAME = 'queued_cases';
const CACHE_STORE_NAME = 'cached_cases';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      const oldVersion = e.oldVersion;

      // v1 → v2 (and fresh installs): queued_cases store
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('moduleType', 'moduleType', { unique: false });
      } else if (oldVersion < 2) {
        const tx = (e.target as IDBOpenDBRequest).transaction!;
        const store = tx.objectStore(STORE_NAME);
        if (!store.indexNames.contains('moduleType')) {
          store.createIndex('moduleType', 'moduleType', { unique: false });
        }
      }

      // v2 → v3: add cached_cases store for the Riwayat (history) tab
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        const cacheStore = db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'case_id' });
        cacheStore.createIndex('created_at', 'created_at', { unique: false });
        cacheStore.createIndex('module_type', 'module_type', { unique: false });
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

// ── Returns both 'pending' AND 'failed' cases so failed cases are retried ────
export async function getPendingCases(): Promise<QueuedCase[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const all = req.result as QueuedCase[];
      resolve(all.filter(c => c.syncStatus === 'pending' || c.syncStatus === 'failed'));
    };
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

// ── Count includes both 'pending' and 'failed' ────────────────────────────────
export async function getPendingCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const all = req.result as QueuedCase[];
      resolve(all.filter(c => c.syncStatus === 'pending' || c.syncStatus === 'failed').length);
    };
    req.onerror = () => reject(req.error);
  });
}

export function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Age display helper ────────────────────────────────────────────────────────
export function formatAge(ageMonths: number | null, ageDays: number | null): string {
  if (ageDays !== null && ageDays >= 0 && ageDays <= 28) return `${ageDays} hari`;
  if (ageMonths === null) return '-';
  if (ageMonths === 0) return '< 1 bulan';
  if (ageMonths < 12) return `${ageMonths} bulan`;
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  if (months === 0) return `${years} tahun`;
  return `${years} tahun ${months} bulan`;
}

// ── Module colour ─────────────────────────────────────────────────────────────
export function moduleColor(moduleType: ModuleType): string {
  switch (moduleType) {
    case 'child':      return '#02C39A';
    case 'maternal':   return '#E91E8C';
    case 'postpartum': return '#9C27B0';
    case 'neonatal':   return '#FF9800';
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

// ── Cached cases (Riwayat tab) ────────────────────────────────────────────────
// These functions manage the read-only cache of server-derived case summaries.
// They are independent of the queued_cases store — pending uploads and the
// history cache are never mixed.

// Replace the entire cache atomically. Called after a successful sync that
// returned a fresh recent_cases array. Wipes the old cache first so we don't
// accumulate stale records, then inserts the new ones in one transaction.
export async function replaceCachedCases(cases: CachedCase[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CACHE_STORE_NAME);
    store.clear();
    for (const c of cases) {
      store.put(c);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Get all cached cases, sorted newest-first.
export async function getCachedCases(): Promise<CachedCase[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE_NAME, 'readonly');
    const req = tx.objectStore(CACHE_STORE_NAME).getAll();
    req.onsuccess = () => {
      const all = (req.result ?? []) as CachedCase[];
      resolve(all.sort((a, b) => b.created_at.localeCompare(a.created_at)));
    };
    req.onerror = () => reject(req.error);
  });
}

// Wipe the cache. Called on logout to ensure the next Kader on a shared
// device cannot see the previous Kader's history.
export async function clearCachedCases(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
    tx.objectStore(CACHE_STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
