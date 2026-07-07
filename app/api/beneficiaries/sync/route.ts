// app/api/sync/beneficiaries/route.ts (sahaibat-kader)
// Proxy — injects PWA_SYNC_SECRET server-side and forwards the beneficiary
// directory request to the main app. Mirrors /api/sync's security pattern
// so the secret is never exposed to the browser.

import { NextRequest, NextResponse } from "next/server";

const MAIN_APP_URL = process.env.NEXT_PUBLIC_MAIN_APP_URL ?? "https://app.sahaibat.com";
const SYNC_SECRET = process.env.PWA_SYNC_SECRET ?? "";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const facilityId = searchParams.get("facility_id");
    const ngoId = searchParams.get("ngo_id");
    const since = searchParams.get("since");

    if (!facilityId || !ngoId) {
      return NextResponse.json(
        { error: "facility_id and ngo_id required", records: [] },
        { status: 400 }
      );
    }

    const qs = new URLSearchParams({ facility_id: facilityId, ngo_id: ngoId });
    if (since) qs.set("since", since);

    const res = await fetch(`${MAIN_APP_URL}/api/pwa/beneficiaries?${qs.toString()}`, {
      method: "GET",
      headers: { "x-pwa-sync-secret": SYNC_SECRET },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Directory fetch failed", records: [] },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[KADER_BENEFICIARIES_ERROR]", e);
    return NextResponse.json({ error: "Directory error", records: [] }, { status: 500 });
  }
}
