// lib/syncClient.ts
// Browser-side sync client — uploads pending IndexedDB cases to server,
// and refreshes the local cached_cases store from the server's response.

import {
  getPendingCases,
  markSynced,
  markSyncFailed,
  replaceCachedCases,
  CachedCase,
} from "./offlineStore";

interface SyncResult {
  synced: number;
  failed: number;
  cachedCount: number;  // how many cases we wrote to local cache, 0 if none
}

export async function syncPendingCases(): Promise<SyncResult> {
  const pending = await getPendingCases();

  // Even if there's nothing to upload, we still want to refresh the cache.
  // POST /api/sync with an empty cases array returns { results: [] } — but
  // also no recent_cases. So an empty pending state = no cache refresh.
  // That's fine: the cache will refresh on the next real sync.
  if (pending.length === 0) {
    return { synced: 0, failed: 0, cachedCount: 0 };
  }

  let synced = 0;
  let failed = 0;
  let cachedCount = 0;

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
      return { synced: 0, failed, cachedCount: 0 };
    }

    const data = await res.json();

    // ── Process upload results ────────────────────────────────────────
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

    // ── Refresh local cache from server response ──────────────────────
    // Non-blocking: a cache refresh failure must not break sync.
    if (Array.isArray(data.recent_cases) && data.recent_cases.length > 0) {
      try {
        await replaceCachedCases(data.recent_cases as CachedCase[]);
        cachedCount = data.recent_cases.length;
      } catch (cacheErr) {
        console.warn("[sync] cache refresh failed:", cacheErr);
      }
    }
  } catch {
    for (const c of pending) {
      await markSyncFailed(c.localId, "Network error");
      failed++;
    }
  }

  return { synced, failed, cachedCount };
}
