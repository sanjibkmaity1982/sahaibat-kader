"use client";

// app/triage/remaja/page.tsx
// Usia Sekolah & Remaja triage module — v2 with beneficiary search

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getIdentity, type KaderIdentity } from "@/lib/auth";
import { runRemajaTriage, type RemajaInput } from "@/lib/remajaEngine";
import { saveCase, getPendingCount, generateLocalId, type QueuedCase } from "@/lib/offlineStore";
import { syncPendingCases } from "@/lib/syncClient";
import BeneficiarySearch, { type BeneficiaryProfile } from "@/components/BeneficiarySearch";

const C = {
  bg: "#0D1F1C", card: "rgba(255,255,255,0.05)",
  border: "rgba(33,150,243,0.25)", accent: "#2196F3",
  white: "#FFFFFF", dim: "rgba(255,255,255,0.5)",
  dimmer: "rgba(255,255,255,0.25)", red: "#FF6B6B",
  yellow: "#FFD166", green: "#02C39A",
};

type Step =
  | "home" | "search" | "name" | "nik" | "age" | "gender"
  | "weight" | "height" | "waist" | "bp"
  | "ttd" | "hb"
  | "activity" | "eating" | "smoking"
  | "ispa_batuk" | "ispa_sesak" | "ispa_mata" | "ispa_paparan"
  | "result";

interface TriageState {
  patientName: string;
  nik: string;
  age_years: number | null;
  gender: "male" | "female" | null;
  weight_kg: number | null;
  height_cm: number | null;
  waist_cm: number | null;
  bp_sys: number | null;
  bp_dia: number | null;
  ttd_adherence: "1" | "2" | "3" | null;
  hb_screening: "1" | "2" | "3" | null;
  activity_level: "1" | "2" | "3" | null;
  eating_pattern: "1" | "2" | "3" | null;
  smoking: "1" | "2" | "3" | null;
  ispa_batuk: "kering" | "berdahak" | "tidak" | null;
  ispa_sesak: boolean;
  ispa_mata: boolean;
  ispa_paparan: boolean;
  isWalkIn: boolean;
  isReturning: boolean;
}

const emptyState: TriageState = {
  patientName: "", nik: "", age_years: null, gender: null,
  weight_kg: null, height_cm: null, waist_cm: null,
  bp_sys: null, bp_dia: null,
  ttd_adherence: null, hb_screening: null,
  activity_level: null, eating_pattern: null, smoking: null,
  ispa_batuk: null, ispa_sesak: false, ispa_mata: false, ispa_paparan: false,
  isWalkIn: false, isReturning: false,
};

function riskColor(level: string) {
  if (level === "HIGH") return C.red;
  if (level === "MEDIUM") return C.yellow;
  return C.green;
}

export default function RemajaTriagePage() {
  const router = useRouter();
  const [identity, setIdentity] = useState<KaderIdentity | null>(null);
  const [step, setStep] = useState<Step>("home");
  const [triage, setTriage] = useState<TriageState>(emptyState);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<QueuedCase | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [synced, setSynced] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const id = getIdentity();
    if (!id) { router.replace("/"); return; }
    setIdentity(id);
    setIsOnline(navigator.onLine);
    getPendingCount().then(setPendingCount);
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingCases().then(({ synced: s }) => {
        if (s > 0) getPendingCount().then(setPendingCount);
      });
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", () => setIsOnline(false));
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", () => setIsOnline(false));
    };
  }, [router]);

  // ── Start flows ────────────────────────────────────────────────────────────

  function goToSearch() {
    setTriage(emptyState); setInput(""); setError("");
    setSynced(false); setStep("search");
  }

  function handleSelectBeneficiary(profile: BeneficiaryProfile) {
    const ageYears = profile.ageMonths ? Math.floor(profile.ageMonths / 12) : null;
    setTriage({
      ...emptyState,
      patientName: profile.patientName,
      nik: profile.nik ?? "",
      age_years: ageYears,
      gender: (profile.gender === "male" || profile.gender === "female") ? profile.gender : null,
      isReturning: true,
      isWalkIn: false,
    });
    setInput(""); setError("");
    // Skip to weight if we have age and gender, else age
    if (ageYears && (profile.gender === "male" || profile.gender === "female")) {
      setStep("weight");
    } else if (ageYears) {
      setStep("gender");
    } else {
      setStep("age");
    }
  }

  function handleNewFull() {
    setTriage({ ...emptyState, isWalkIn: false, isReturning: false });
    setInput(""); setError(""); setStep("name");
  }

  function handleWalkIn() {
    setTriage({ ...emptyState, isWalkIn: true, isReturning: false });
    setInput(""); setError(""); setStep("name");
  }

  function next(updates: Partial<TriageState>, nextStep: Step) {
    setTriage(prev => ({ ...prev, ...updates }));
    setInput(""); setError(""); setStep(nextStep);
  }

  async function finish(finalState: TriageState) {
    if (!identity || !finalState.age_years || !finalState.gender ||
        !finalState.weight_kg || !finalState.height_cm ||
        !finalState.activity_level || !finalState.eating_pattern || !finalState.smoking) return;

    const engineInput: RemajaInput = {
      patientName: finalState.patientName,
      nik: finalState.nik,
      age_years: finalState.age_years,
      gender: finalState.gender,
      weight_kg: finalState.weight_kg,
      height_cm: finalState.height_cm,
      waist_cm: finalState.waist_cm,
      bp_sys: finalState.bp_sys,
      bp_dia: finalState.bp_dia,
      ttd_adherence: finalState.ttd_adherence,
      hb_screening: finalState.hb_screening,
      activity_level: finalState.activity_level,
      eating_pattern: finalState.eating_pattern,
      smoking: finalState.smoking,
      ispa_batuk: finalState.ispa_batuk ?? 'tidak',
      ispa_sesak: finalState.ispa_sesak,
      ispa_mata: finalState.ispa_mata,
      ispa_paparan: finalState.ispa_paparan,
      ispa_durasi: null,
    };

    const engineResult = runRemajaTriage(engineInput, identity.name);

    const queued: QueuedCase = {
      localId: generateLocalId(),
      profileId: identity.profileId,
      ngoId: identity.ngoId,
      moduleType: 'child' as any,
      patientName: finalState.patientName,
      nik: finalState.nik || undefined,
      ageMonths: (finalState.age_years ?? 0) * 12,
      ageDays: null,
      gender: finalState.gender,
      payload: {
        module: 'remaja',
        ...finalState,
        bmi: engineResult.bmi,
        bmiCategory: engineResult.bmiCategory,
        bpCategory: engineResult.bpCategory,
        waistFlag: engineResult.waistFlag,
      },
      riskLevel: engineResult.riskLevel,
      reportText: engineResult.reportText,
      referNow: engineResult.referNow,
      followUpDays: engineResult.followUpDays,
      profileIncomplete: finalState.isWalkIn,
      createdAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    await saveCase(queued);
    setPendingCount(await getPendingCount());
    setResult(queued);
    setSynced(false);
    setStep("result");

    if (navigator.onLine) {
      syncPendingCases().then(({ synced: s }) => {
        if (s > 0) { getPendingCount().then(setPendingCount); setSynced(true); }
      });
    }
  }

  if (!identity) return null;

  const showBanner = !["home", "search", "result"].includes(step);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
        background: "rgba(0,0,0,0.2)",
      }}>
        <button
          onClick={() => step === "home" ? router.push("/triage") : setStep("home")}
          style={{ background: "none", border: "none", color: C.dim, fontSize: 22, cursor: "pointer", padding: 0 }}
        >←</button>
        <div>
          <div style={{ color: C.accent, fontWeight: 800, fontSize: 15 }}>🎒 Usia Sekolah & Remaja</div>
          <div style={{ color: C.dim, fontSize: 12 }}>{identity.name}</div>
        </div>
        {pendingCount > 0 && (
          <div style={{ marginLeft: "auto", background: C.yellow, color: "#000", borderRadius: 12, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>
            {pendingCount} belum sinkron
          </div>
        )}
      </div>

      {!isOnline && (
        <div style={{ background: "rgba(255,209,102,0.15)", borderBottom: `1px solid ${C.yellow}`, padding: "8px 20px", color: C.yellow, fontSize: 13, textAlign: "center" }}>
          📵 Mode offline — skrining tetap berjalan
        </div>
      )}

      <div style={{ flex: 1, maxWidth: 480, width: "100%", margin: "0 auto" }}>

        {/* ── HOME ── */}
        {step === "home" && (
          <div style={{ padding: "40px 20px" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🎒</div>
              <h1 style={{ color: C.accent, fontSize: 22, fontWeight: 800, margin: 0 }}>Usia Sekolah & Remaja</h1>
              <p style={{ color: C.dim, fontSize: 14, marginTop: 8 }}>Skrining kesehatan usia 6–18 tahun</p>
            </div>
            <button onClick={goToSearch} style={{
              width: "100%", padding: 18, borderRadius: 14,
              background: C.accent, color: C.white,
              fontSize: 18, fontWeight: 800, border: "none", cursor: "pointer",
            }}>
              ➕ Mulai Skrining
            </button>
          </div>
        )}

        {/* ── SEARCH ── */}
        {step === "search" && (
          <BeneficiarySearch
            moduleType="remaja"
            moduleEmoji="🎒"
            moduleTitle="Usia Sekolah & Remaja"
            facilityId={identity?.facilityId}
            onSelect={handleSelectBeneficiary}
            onNew={handleNewFull}
            onWalkIn={handleWalkIn}
          />
        )}

        {/* Returning banner */}
        {triage.isReturning && showBanner && (
          <div style={{
            margin: "12px 20px 0", padding: "10px 14px", borderRadius: 10,
            background: "rgba(33,150,243,0.08)", border: `1px solid rgba(33,150,243,0.3)`,
            color: C.accent, fontSize: 13,
          }}>
            ✓ Data {triage.patientName} dimuat — masukkan pengukuran hari ini
          </div>
        )}

        {/* Walk-in banner */}
        {triage.isWalkIn && showBanner && (
          <div style={{
            margin: "12px 20px 0", padding: "10px 14px", borderRadius: 10,
            background: "rgba(255,209,102,0.08)", border: `1px solid rgba(255,209,102,0.3)`,
            color: C.yellow, fontSize: 13,
          }}>
            ⚡ Triage cepat — lengkapi NIK & data setelah sesi selesai
          </div>
        )}

        {/* ── NAME ── */}
        {step === "name" && (
          <QCard q="Nama?" accent={C.accent}>
            <TInput placeholder="Contoh: Rina Kartika" value={input} onChange={setInput} onSubmit={() => {
              if (!input.trim()) { setError("Masukkan nama."); return; }
              next({ patientName: input.trim() }, triage.isWalkIn ? "age" : "nik");
            }} accent={C.accent} />
            {error && <Err msg={error} />}
          </QCard>
        )}

        {/* ── NIK ── */}
        {step === "nik" && (
          <QCard q="NIK?" hint="16 digit — atau SKIP jika belum ada" accent={C.accent}>
            <TInput placeholder="16 digit atau SKIP" value={input} onChange={setInput} onSubmit={() => {
              const val = input.trim().toUpperCase();
              if (val === "" || val === "SKIP" || val === "S") { next({ nik: "" }, "age"); return; }
              if (!/^\d{16}$/.test(val)) { setError("NIK harus 16 digit."); return; }
              next({ nik: val }, "age");
            }} accent={C.accent} />
            <SkipBtn onClick={() => next({ nik: "" }, "age")} />
            {error && <Err msg={error} />}
          </QCard>
        )}

        {/* ── AGE ── */}
        {step === "age" && (
          <QCard q="Usia (tahun)?" hint="6–18 tahun" accent={C.accent}>
            <TInput placeholder="Contoh: 14" value={input} onChange={setInput} type="number" onSubmit={() => {
              const val = parseInt(input.trim());
              if (isNaN(val) || val < 6 || val > 18) { setError("Usia harus 6–18 tahun."); return; }
              next({ age_years: val }, "gender");
            }} accent={C.accent} />
            {error && <Err msg={error} />}
          </QCard>
        )}

        {/* ── GENDER ── */}
        {step === "gender" && (
          <QCard q="Jenis kelamin?" accent={C.accent}>
            <CBtn label="👦 Laki-laki" onClick={() => next({ gender: "male" }, "weight")} accent={C.accent} />
            <CBtn label="👧 Perempuan" onClick={() => next({ gender: "female" }, "weight")} accent={C.accent} />
          </QCard>
        )}

        {/* ── WEIGHT ── */}
        {step === "weight" && (
          <QCard q="Berat badan (kg)?" hint={triage.isReturning ? `${triage.patientName} · ${triage.age_years} tahun` : undefined} accent={C.accent}>
            <TInput placeholder="Contoh: 45" value={input} onChange={setInput} type="decimal" onSubmit={() => {
              const val = parseFloat(input.trim().replace(",", "."));
              if (isNaN(val) || val < 15 || val > 120) { setError("Berat badan tidak valid."); return; }
              next({ weight_kg: val }, "height");
            }} accent={C.accent} />
            {error && <Err msg={error} />}
          </QCard>
        )}

        {/* ── HEIGHT ── */}
        {step === "height" && (
          <QCard q="Tinggi badan (cm)?" accent={C.accent}>
            <TInput placeholder="Contoh: 155" value={input} onChange={setInput} type="decimal" onSubmit={() => {
              const val = parseFloat(input.trim().replace(",", "."));
              if (isNaN(val) || val < 90 || val > 200) { setError("Tinggi badan tidak valid."); return; }
              next({ height_cm: val }, "waist");
            }} accent={C.accent} />
            {error && <Err msg={error} />}
          </QCard>
        )}

        {/* ── WAIST ── */}
        {step === "waist" && (
          <QCard q="Lingkar perut (cm)?" hint="Ketik SKIP jika tidak diukur" accent={C.accent}>
            <TInput placeholder="Contoh: 70 atau SKIP" value={input} onChange={setInput} onSubmit={() => {
              const val = input.trim().toUpperCase();
              if (val === "SKIP" || val === "" || val === "S") { next({ waist_cm: null }, "bp"); return; }
              const num = parseFloat(val.replace(",", "."));
              if (isNaN(num) || num < 40 || num > 150) { setError("Lingkar perut tidak valid."); return; }
              next({ waist_cm: num }, "bp");
            }} accent={C.accent} />
            <SkipBtn onClick={() => next({ waist_cm: null }, "bp")} />
            {error && <Err msg={error} />}
          </QCard>
        )}

        {/* ── BP ── */}
        {step === "bp" && (
          <QCard q="Tekanan darah?" hint="Contoh: 120/80 — atau SKIP" accent={C.accent}>
            <TInput placeholder="Contoh: 120/80 atau SKIP" value={input} onChange={setInput} onSubmit={() => {
              const val = input.trim().toUpperCase();
              if (val === "SKIP" || val === "") {
                next({ bp_sys: null, bp_dia: null }, triage.gender === "female" ? "ttd" : "activity");
                return;
              }
              const match = val.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
              if (match) {
                next({ bp_sys: parseInt(match[1]), bp_dia: parseInt(match[2]) }, triage.gender === "female" ? "ttd" : "activity");
              } else {
                setError("Format: 120/80");
              }
            }} accent={C.accent} />
            <SkipBtn onClick={() => next({ bp_sys: null, bp_dia: null }, triage.gender === "female" ? "ttd" : "activity")} />
            {error && <Err msg={error} />}
          </QCard>
        )}

        {/* ── TTD (remaja putri only) ── */}
        {step === "ttd" && (
          <QCard q="Apakah adik rutin minum Tablet Tambah Darah (TTD)?" hint="TTD dari sekolah atau Puskesmas — 1x per minggu" accent={C.accent}>
            <CBtn label="💊 Ya, rutin" sub="1x per minggu" onClick={() => next({ ttd_adherence: "1" }, "hb")} accent={C.accent} />
            <CBtn label="⚠️ Kadang-kadang" sub="Tidak setiap minggu" onClick={() => next({ ttd_adherence: "2" }, "hb")} accent={C.accent} />
            <CBtn label="❌ Tidak / tidak dapat" sub="Tidak minum atau tidak mendapat TTD" onClick={() => next({ ttd_adherence: "3" }, "hb")} accent={C.accent} />
          </QCard>
        )}

        {/* ── HB ── */}
        {step === "hb" && (
          <QCard q="Kapan terakhir skrining Hb (cek darah)?" accent={C.accent}>
            <CBtn label="✅ Bulan ini" onClick={() => next({ hb_screening: "1" }, "activity")} accent={C.accent} />
            <CBtn label="📋 Lebih dari 3 bulan lalu" onClick={() => next({ hb_screening: "2" }, "activity")} accent={C.accent} />
            <CBtn label="❌ Belum pernah" onClick={() => next({ hb_screening: "3" }, "activity")} accent={C.accent} />
          </QCard>
        )}

        {/* ── ACTIVITY ── */}
        {step === "activity" && (
          <QCard q="Apakah melakukan aktivitas fisik minimal 60 menit per hari?" hint="Jalan kaki, lari, olahraga, bermain aktif" accent={C.accent}>
            <CBtn label="🏃 Ya, setiap hari" onClick={() => next({ activity_level: "1" }, "eating")} accent={C.accent} />
            <CBtn label="⚠️ Kadang-kadang" sub="Tidak setiap hari" onClick={() => next({ activity_level: "2" }, "eating")} accent={C.accent} />
            <CBtn label="❌ Jarang / tidak pernah" onClick={() => next({ activity_level: "3" }, "eating")} accent={C.accent} />
          </QCard>
        )}

        {/* ── EATING ── */}
        {step === "eating" && (
          <QCard q="Apakah makan sesuai Isi Piringku?" hint="⅓ karbohidrat, ⅓ sayur+buah, ⅓ lauk — 3x sehari" accent={C.accent}>
            <CBtn label="✅ Ya, seimbang" onClick={() => next({ eating_pattern: "1" }, "smoking")} accent={C.accent} />
            <CBtn label="⚠️ Kadang-kadang" onClick={() => next({ eating_pattern: "2" }, "smoking")} accent={C.accent} />
            <CBtn label="❌ Tidak seimbang" sub="Sering jajan, jarang sayur/buah" onClick={() => next({ eating_pattern: "3" }, "smoking")} accent={C.accent} />
          </QCard>
        )}

        {/* ── SMOKING ── */}
        {step === "smoking" && (
          <QCard q="Apakah merokok atau menggunakan vape?" accent={C.accent}>
            <CBtn label="🚬 Ya, aktif merokok/vape" onClick={() => next({ smoking: "1" }, "ispa_batuk")} accent={C.accent} />
            <CBtn label="⚠️ Pernah, tapi sudah berhenti" onClick={() => next({ smoking: "2" }, "ispa_batuk")} accent={C.accent} />
            <CBtn label="✅ Tidak pernah" onClick={() => next({ smoking: "3" }, "ispa_batuk")} accent={C.accent} />
          </QCard>
        )}

        {/* ── ISPA ── */}
        {step === "ispa_batuk" && (
          <QCard q="Apakah batuk?" hint="Batuk kering (tanpa dahak) atau batuk berdahak?" accent={C.accent}>
            <CBtn label="😷 Ya, batuk kering" onClick={() => next({ ispa_batuk: "kering" }, "ispa_sesak")} accent={C.accent} />
            <CBtn label="🤧 Ya, batuk berdahak" onClick={() => next({ ispa_batuk: "berdahak" }, "ispa_sesak")} accent={C.accent} />
            <CBtn label="✅ Tidak batuk" onClick={() => next({ ispa_batuk: "tidak" }, "ispa_sesak")} accent={C.accent} />
          </QCard>
        )}

        {step === "ispa_sesak" && (
          <QCard q="Apakah sesak napas?" hint="Napas terasa berat, sulit bernapas dalam" accent={C.accent}>
            <CBtn label="⚠️ Ya" onClick={() => next({ ispa_sesak: true }, "ispa_mata")} accent={C.accent} />
            <CBtn label="✅ Tidak" onClick={() => next({ ispa_sesak: false }, "ispa_mata")} accent={C.accent} />
          </QCard>
        )}

        {step === "ispa_mata" && (
          <QCard q="Apakah mata perih atau berair?" hint="Terasa pedas, gatal, atau sering berair" accent={C.accent}>
            <CBtn label="⚠️ Ya" onClick={() => next({ ispa_mata: true }, "ispa_paparan")} accent={C.accent} />
            <CBtn label="✅ Tidak" onClick={() => next({ ispa_mata: false }, "ispa_paparan")} accent={C.accent} />
          </QCard>
        )}

        {step === "ispa_paparan" && (
          <QCard q="Apakah tinggal atau bekerja dekat gunung berapi aktif atau area kebakaran hutan?" hint="Terpapar asap tebal, abu vulkanik, atau debu" accent={C.accent}>
            <CBtn label="🌋 Ya" onClick={() => { const u = { ...triage, ispa_paparan: true }; setTriage(u); finish(u); }} accent={C.accent} />
            <CBtn label="✅ Tidak" onClick={() => { const u = { ...triage, ispa_paparan: false }; setTriage(u); finish(u); }} accent={C.accent} />
          </QCard>
        )}

        {/* ── RESULT ── */}
        {step === "result" && result && (
          <div style={{ padding: "24px 20px" }}>
            <div style={{
              background: `${riskColor(result.riskLevel)}20`,
              border: `2px solid ${riskColor(result.riskLevel)}`,
              borderRadius: 14, padding: "16px 20px", marginBottom: 20, textAlign: "center",
            }}>
              <div style={{ color: riskColor(result.riskLevel), fontSize: 18, fontWeight: 800 }}>
                {result.riskLevel === "HIGH" ? "🔴 RISIKO TINGGI" :
                 result.riskLevel === "MEDIUM" ? "🟡 PERLU PERHATIAN" : "🟢 SEHAT"}
              </div>
              {result.referNow && <div style={{ color: C.red, fontSize: 14, marginTop: 6 }}>Rujuk ke Puskesmas</div>}
            </div>

            {result.profileIncomplete && (
              <div style={{ background: "rgba(255,209,102,0.1)", border: `1px solid ${C.yellow}`, borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: C.yellow }}>
                ⚠️ <strong>Profil belum lengkap</strong> — mohon lengkapi NIK {result.patientName} setelah sesi selesai
              </div>
            )}

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <pre style={{ color: C.white, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{result.reportText}</pre>
            </div>

            {synced ? (
              <div style={{ background: "rgba(2,195,154,0.1)", border: `1px solid ${C.green}`, borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 13, color: C.green }}>
                ✅ Data berhasil disinkron ke server
              </div>
            ) : (
              <div style={{ background: "rgba(255,209,102,0.1)", border: `1px solid ${C.yellow}`, borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 13, color: C.yellow }}>
                ⏳ Tersimpan lokal — akan sinkron saat ada sinyal
              </div>
            )}

            <button onClick={goToSearch} style={{ width: "100%", padding: 16, borderRadius: 12, background: C.accent, color: C.white, fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer", marginBottom: 12 }}>
              ➕ Skrining Berikutnya
            </button>
            <button onClick={() => router.push("/triage")} style={{ width: "100%", padding: 14, borderRadius: 12, background: C.card, color: C.dim, fontSize: 15, fontWeight: 600, border: `1px solid ${C.border}`, cursor: "pointer" }}>
              ← Kembali ke Beranda
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

function QCard({ q, hint, children, accent }: { q: string; hint?: string; children: React.ReactNode; accent: string }) {
  return (
    <div style={{ padding: "32px 20px" }}>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 8 }}>Skrining Remaja</p>
      <h2 style={{ color: "#FFF", fontSize: 20, fontWeight: 700, marginBottom: hint ? 8 : 24, lineHeight: 1.4 }}>{q}</h2>
      {hint && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 24 }}>{hint}</p>}
      {children}
    </div>
  );
}

function TInput({ placeholder, value, onChange, onSubmit, type = "text", accent }: {
  placeholder: string; value: string; onChange: (v: string) => void; onSubmit: () => void; type?: string; accent: string;
}) {
  return (
    <div>
      <input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onSubmit()} autoFocus
        style={{ width: "100%", padding: "14px 16px", borderRadius: 10, background: "rgba(255,255,255,0.08)", border: `1.5px solid ${accent}40`, color: "#FFF", fontSize: 18, outline: "none", boxSizing: "border-box", marginBottom: 16 }} />
      <button onClick={onSubmit} style={{ width: "100%", padding: 14, borderRadius: 10, background: value.trim() ? accent : `${accent}40`, color: "#FFF", fontSize: 16, fontWeight: 700, border: "none", cursor: value.trim() ? "pointer" : "not-allowed" }}>Lanjut →</button>
    </div>
  );
}

function CBtn({ label, sub, onClick, accent }: { label: string; sub?: string; onClick: () => void; accent: string }) {
  return (
    <button onClick={onClick} style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: `1.5px solid ${accent}30`, color: "#FFF", fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 10, textAlign: "left" }}>
      {label}
      {sub && <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </button>
  );
}

function SkipBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: "100%", padding: 12, borderRadius: 10, marginTop: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.4)", fontSize: 14, cursor: "pointer" }}>
      SKIP
    </button>
  );
}

function Err({ msg }: { msg: string }) { return <p style={{ color: "#FF6B6B", fontSize: 13, marginTop: 8 }}>{msg}</p>; }
