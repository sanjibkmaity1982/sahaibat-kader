// app/api/sync/route.ts (sahaibat-kader)
// Proxy — forwards cases from browser to main app with secret.

import { NextRequest, NextResponse } from "next/server";

const MAIN_APP_URL = process.env.NEXT_PUBLIC_MAIN_APP_URL ?? "https://app.sahaibat.com";
const PWA_SYNC_SECRET = process.env.PWA_SYNC_SECRET ?? "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cases } = body;

    if (!Array.isArray(cases) || cases.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const res = await fetch(`${MAIN_APP_URL}/api/pwa/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pwa-sync-secret": PWA_SYNC_SECRET,
      },
      body: JSON.stringify({ cases }),
    });

    if (!res.ok) {
      const results = cases.map((c: { localId: string }) => ({
        localId: c.localId,
        success: false,
        error: `Main app returned ${res.status}`,
      }));
      return NextResponse.json({ results });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[SYNC_PROXY_ERROR]", e);
    return NextResponse.json(
      { error: "Sync proxy failed" },
      { status: 500 }
    );
  }
}
