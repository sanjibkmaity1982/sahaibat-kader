import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if (!phone || typeof phone !== "string") {
      return NextResponse.json(
        { found: false, error: "No phone provided" },
        { status: 400 }
      );
    }

    // Normalise to +62 format
    let normalised = phone.trim().replace(/\s+/g, "");
    if (normalised.startsWith("0")) normalised = "+62" + normalised.slice(1);
    if (normalised.startsWith("62") && !normalised.startsWith("+62"))
      normalised = "+" + normalised;
    if (!normalised.startsWith("+")) normalised = "+62" + normalised;

    const { data, error } = await supabase
      .from("sahai_profiles")
      .select("id, full_name, ngo_id, role, is_active, whatsapp_number")
      .eq("whatsapp_number", normalised)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("[KADER_LOOKUP_ERROR]", error);
      return NextResponse.json(
        { found: false, error: "Lookup failed" },
        { status: 500 }
      );
    }

    if (!data?.id) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      profileId: String(data.id),
      name: data.full_name ?? "Kader",
      ngoId: data.ngo_id ?? null,
      phone: normalised,
    });
  } catch (e) {
    console.error("[KADER_LOOKUP_EXCEPTION]", e);
    return NextResponse.json(
      { found: false, error: "Server error" },
      { status: 500 }
    );
  }
}
