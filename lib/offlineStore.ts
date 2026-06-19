// lib/offlineStore.ts
// IndexedDB queue for offline triage cases — all 4 modules.
// DB_VERSION 5: added beneficiary_directory store for shared register sync.

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
  profileIncomplete?: boolean;
}

// ── Beneficiary directory — shared register imported from backend ─────────────
export interface BeneficiaryRecord {
  localId: string;        // e.g. 'bdir_aplasi_13'
  facilityId: number;
  ngoId: string;
  patientName: string;
  nik?: string | null;
  dob?: string | null;
  ageMonths?: number | null;
  gender?: string;
  moduleType: string;
  motherName?: string | null;
  source: 'register_import';
  syncedAt: string;
}

// ── Legacy support — keep childName as alias for patientName ─────────────────
export function getPatientName(c: QueuedCase): string {
  return c.patientName || (c as any).childName || 'Tidak diketahui';
}

// ── IndexedDB ─────────────────────────────────────────────────────────────────
const DB_NAME = 'sahaibat_kader';
const DB_VERSION = 5;
const STORE_NAME = 'queued_cases';
const DIR_STORE = 'beneficiary_directory';

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

      // v3 → v4: remove cached_cases store (feature removed)
      if (db.objectStoreNames.contains('cached_cases')) {
        db.deleteObjectStore('cached_cases');
      }

      // v4 → v5: add beneficiary_directory store
      if (!db.objectStoreNames.contains(DIR_STORE)) {
        const dirStore = db.createObjectStore(DIR_STORE, { keyPath: 'localId' });
        dirStore.createIndex('facilityId', 'facilityId', { unique: false });
        dirStore.createIndex('patientName', 'patientName', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Queued cases functions ────────────────────────────────────────────────────

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

// ── Beneficiary directory functions ──────────────────────────────────────────

export async function saveBeneficiaries(records: BeneficiaryRecord[]): Promise<void> {
  if (records.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DIR_STORE, 'readwrite');
    const store = tx.objectStore(DIR_STORE);
    for (const r of records) {
      store.put(r);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getBeneficiaryDirectory(facilityId: number): Promise<BeneficiaryRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DIR_STORE, 'readonly');
    const index = tx.objectStore(DIR_STORE).index('facilityId');
    const req = index.getAll(facilityId);
    req.onsuccess = () => resolve(req.result as BeneficiaryRecord[]);
    req.onerror = () => reject(req.error);
  });
}

export async function clearBeneficiaryDirectory(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DIR_STORE, 'readwrite');
    tx.objectStore(DIR_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getBeneficiaryDirectoryCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DIR_STORE, 'readonly');
    const req = tx.objectStore(DIR_STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Search beneficiaries by name (checks local cases + directory) ─────────────
export async function searchBeneficiaries(
  query: string,
  moduleType?: ModuleType,
  facilityId?: number
): Promise<QueuedCase[]> {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();

  // Search local queued cases first
  const all = await getAllCases();
  const matches = all.filter(c => {
    const nameMatch = c.patientName?.toLowerCase().includes(q);
    const moduleMatch = moduleType ? c.moduleType === moduleType : true;
    return nameMatch && moduleMatch;
  });

  // Deduplicate local cases — newest first
  const seen = new Map<string, QueuedCase>();
  for (const c of matches) {
    const key = c.nik && c.nik.length === 16
      ? c.nik
      : c.patientName.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.set(key, c);
    }
  }

  // Also search beneficiary directory if facilityId provided
  if (facilityId) {
    try {
      const directory = await getBeneficiaryDirectory(facilityId);
      const dirMatches = directory.filter(r => {
        const nameMatch = r.patientName?.toLowerCase().includes(q);
        const moduleMatch = moduleType ? r.moduleType === moduleType : true;
        return nameMatch && moduleMatch;
      });

      for (const r of dirMatches) {
        const key = r.nik && r.nik.length === 16
          ? r.nik
          : r.patientName.toLowerCase().trim();
        // Only add if not already found in local cases
        if (!seen.has(key)) {
          seen.set(key, {
            localId: r.localId,
            profileId: '',
            ngoId: r.ngoId,
            moduleType: (r.moduleType as ModuleType) ?? 'child',
            patientName: r.patientName,
            nik: r.nik ?? undefined,
            dob: r.dob ?? null,
            ageMonths: r.ageMonths ?? null,
            ageDays: null,
            gender: (r.gender as 'male' | 'female' | 'unknown') ?? 'unknown',
            riskLevel: 'LOW',
            reportText: '',
            referNow: false,
            followUpDays: 30,
            createdAt: r.syncedAt,
            syncStatus: 'synced',
          });
        }
      }
    } catch {
      // Directory search failure is non-blocking
    }
  }

  return Array.from(seen.values()).slice(0, 5);
}
