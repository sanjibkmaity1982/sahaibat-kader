// lib/beneficiarySync.ts
// Pulls the shared facility beneficiary register into IndexedDB so any kader
// at the facility can search for any child. Full pull on first sign-on,
// incremental (since last sync) thereafter.

import { saveBeneficiaries, type BeneficiaryRecord } from "./offlineStore";

const LAST_SYNC_KEY = "sahaibat_bdir_last_sync";

export async function syncBeneficiaryDirectory(
  facilityId: number | null | undefined,
  ngoId: string | null | undefined
): Promise<{ count: number }> {
  if (!facilityId || !ngoId) return { count: 0 };
  if (!navigator.onLine) return { count: 0 };

  const qs = new URLSearchParams({
    facility_id: String(facilityId),
    ngo_id: ngoId,
  });

  // Incremental after first pull; localStorage key is per-device
  const lastSync = localStorage.getItem(LAST_SYNC_KEY);
  if (lastSync) qs.set("since", lastSync);

  try {
    const res = await fetch(`/api/beneficiaries?${qs.toString()}`);
    if (!res.ok) return { count: 0 };

    const data = await res.json();
    const records: BeneficiaryRecord[] = data.records ?? [];

    if (records.length > 0) {
      await saveBeneficiaries(records);
    }

    // Advance the cursor even on an empty incremental pull, so we don't
    // re-scan the same window next time.
    if (data.synced_at) {
      localStorage.setItem(LAST_SYNC_KEY, data.synced_at);
    }

    return { count: records.length };
  } catch {
    // Non-blocking — search still works on whatever is already cached
    return { count: 0 };
  }
}
