// app/api/sync/beneficiaries/route.ts (sahaibat-kader)
// Proxy — forwards beneficiary directory request to main app.
// Same security pattern as /api/sync for case uploads.

import { NextRequest, NextResponse } from "next/server";

const MAIN_APP_URL = process.env.NEXT_PUBLIC_MAIN_APP_URL ?? "https://app.sahaibat.com";
const PWA_SYNC_SECRET = process.env.PWA_SYNC_SECRET ?? "";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const facilityId = searchParams.get("facility_id");
    const ngoId = searchParams.get("ngo_id");
    const since = searchParams.get("since");

    if (!facilityId || !ngoId) {
      return NextResponse.json(
        { error: "facility_id and ngo_id required" },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({ facility_id: facilityId, ngo_id: ngoId });
    if (since) params.set("since", since);

    const res = await fetch(
      `${MAIN_APP_URL}/api/pwa/beneficiaries?${params}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-pwa-sync-secret": PWA_SYNC_SECRET,
        },
      }
    );

    if (!res.ok) {
      console.error("[BDIR_PROXY] main app returned", res.status);
      return NextResponse.json(
        { error: `Main app returned ${res.status}`, records: [] },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);

  } catch (err) {
    console.error("[BDIR_PROXY] error:", err);
    return NextResponse.json(
      { error: "Proxy failed", records: [] },
      { status: 500 }
    );
  }
}
