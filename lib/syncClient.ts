// lib/syncClient.ts
// Browser-side sync client — uploads pending IndexedDB cases to server.
// v2: added syncBeneficiaryDirectory() for shared register sync.

import {
  getPendingCases,
  markSynced,
  markSyncFailed,
  saveBeneficiaries,
  getBeneficiaryDirectoryCount,
  type BeneficiaryRecord,
} from "./offlineStore";

interface SyncResult {
  synced: number;
  failed: number;
}

interface DirectorySyncResult {
  count: number;
  source: 'server' | 'cached' | 'skipped';
}

// ── Upload pending triage cases to server ─────────────────────────────────────
export async function syncPendingCases(): Promise<SyncResult> {
  const pending = await getPendingCases();
  if (pending.length === 0) {
    return { synced: 0, failed: 0 };
  }
  let synced = 0;
  let failed = 0;
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cases: pending }),
    });
    if (!res.ok) {
      for (const c of pending) {
        await markSyncFailed(c.localId, `HTTP ${res.status}`);
        failed++;
      }
      return { synced: 0, failed };
    }
    const data = await res.json();
    // ── Process upload results ──────────────────────────────────────
    const results: { localId: string; ok?: boolean; success?: boolean; error?: string }[] =
      data.results ?? [];
    for (const r of results) {
      if (r.ok || r.success) {
        await markSynced(r.localId);
        synced++;
      } else {
        await markSyncFailed(r.localId, r.error ?? "Unknown error");
        failed++;
      }
    }
  } catch {
    for (const c of pending) {
      await markSyncFailed(c.localId, "Network error");
      failed++;
    }
  }
  return { synced, failed };
}

// ── Sync beneficiary directory from server ────────────────────────────────────
// Fetches shared register records for this kader's facility.
// Runs once on login — non-blocking, silent on failure.
// Uses lastSyncedAt in localStorage to avoid re-downloading on every login.
export async function syncBeneficiaryDirectory(
  facilityId: number,
  ngoId: string
): Promise<DirectorySyncResult> {
  if (!facilityId || !ngoId) return { count: 0, source: 'skipped' };

  try {
    // Check if we already have directory data — skip if synced in last 24hrs
    const lastSyncKey = `bdir_sync_${facilityId}`;
    const lastSync = localStorage.getItem(lastSyncKey);
    const existingCount = await getBeneficiaryDirectoryCount();

    if (lastSync && existingCount > 0) {
      const lastSyncDate = new Date(lastSync);
      const hoursSinceSync = (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60);
      if (hoursSinceSync < 24) {
        return { count: existingCount, source: 'cached' };
      }
    }

    // Fetch from server via kader proxy
    const params = new URLSearchParams({
      facility_id: String(facilityId),
      ngo_id: ngoId,
    });

    const res = await fetch(`/api/sync/beneficiaries?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      console.warn('[BDIR_SYNC] server returned', res.status);
      return { count: existingCount, source: 'cached' };
    }

    const data = await res.json();
    const records: BeneficiaryRecord[] = data.records ?? [];

    if (records.length === 0) {
      return { count: 0, source: 'server' };
    }

    // Save to IndexedDB
    await saveBeneficiaries(records);

    // Update last sync timestamp
    localStorage.setItem(lastSyncKey, new Date().toISOString());

    console.log(`[BDIR_SYNC] synced ${records.length} beneficiaries for facility ${facilityId}`);
    return { count: records.length, source: 'server' };

  } catch (err) {
    // Non-blocking — never crash login flow
    console.warn('[BDIR_SYNC] failed (non-blocking):', err);
    return { count: 0, source: 'skipped' };
  }
}
