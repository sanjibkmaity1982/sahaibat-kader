// lib/syncClient.ts
// Browser-side sync client — uploads pending IndexedDB cases to server.

import { getPendingCases, markSynced, markSyncFailed } from "./offlineStore";

export async function syncPendingCases(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingCases();
  if (pending.length === 0) return { synced: 0, failed: 0 };

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
    const results: { localId: string; success: boolean; error?: string }[] =
      data.results ?? [];

    for (const r of results) {
      if (r.success) {
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
