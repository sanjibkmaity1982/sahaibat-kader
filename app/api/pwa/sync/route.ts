// app/api/pwa/sync/route.ts (sahaibat-healthcare)
// Receives synced cases from kader PWA and saves to Supabase.

import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "../../../../lib/supabaseAdmin";

const PWA_SYNC_SECRET = process.env.PWA_SYNC_SECRET ?? "";

interface IncomingCase {
  localId: string;
  profileId: string;
  ngoId: string;
  childName: string;
  ageMonths: number;
  gender: "male" | "female";
  weightKg: number;
  heightCm: number;
  muacCm: number | null;
  feedingFreq: "1" | "2" | "3";
  milestoneScore: "1" | "2" | "3";
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  reportText: string;
  referNow: boolean;
  followUpDays: number;
  createdAt: string;
}

export async function POST(req: NextRequest) {
  // Validate secret
  const secret = req.headers.get("x-pwa-sync-secret");
  if (!secret || secret !== PWA_SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { cases }: { cases: IncomingCase[] } = await req.json();
    if (!Array.isArray(cases) || cases.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const supabase = getAdminSupabase();
    const results = [];

    for (const c of cases) {
      try {
        // Map risk level to triage_result format
        const triageResult = c.riskLevel === "HIGH" ? "high"
          : c.riskLevel === "MEDIUM" ? "medium" : "low";

        const triagePayload = {
          weight_kg: c.weightKg,
          height_cm: c.heightCm,
          muac_cm: c.muacCm,
          age_months: c.ageMonths,
          gender: c.gender,
          feeding_freq: c.feedingFreq,
          milestone_score: c.milestoneScore,
          growth_flags: {
            refer_now: c.referNow,
            follow_up_days: c.followUpDays,
          },
          pwa_local_id: c.localId,
          report_text: c.reportText,
          synced_from_pwa: true,
          synced_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("sahai_cases")
          .insert({
            ngo_id: c.ngoId,
            chw_profile_id: c.profileId,
            patient_name: c.childName,
            triage_result: triageResult,
            module_type: "Posyandu-PWA",
            triage_payload: triagePayload,
            created_at: c.createdAt,
            status: c.referNow ? "refer_now" : "monitored",
          });

        if (error) {
          console.error("[PWA_SYNC_INSERT_ERROR]", error);
          results.push({ localId: c.localId, success: false, error: error.message });
        } else {
          results.push({ localId: c.localId, success: true });
        }
      } catch (err) {
        console.error("[PWA_SYNC_CASE_ERROR]", err);
        results.push({ localId: c.localId, success: false, error: "Insert failed" });
      }
    }

    return NextResponse.json({ results });
  } catch (e) {
    console.error("[PWA_SYNC_ERROR]", e);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
