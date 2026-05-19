// app/api/version/route.ts
// Returns the current build ID so the client can detect stale service workers.
// Vercel sets NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA on every deployment.
// Falls back to a timestamp-based ID if not on Vercel.

import { NextResponse } from 'next/server';

const BUILD_ID =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ??
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ??
  'dev';

export async function GET() {
  return NextResponse.json(
    { version: BUILD_ID },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'CDN-Cache-Control': 'no-store',
      },
    }
  );
}
