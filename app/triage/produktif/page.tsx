"use client";

// app/triage/produktif/page.tsx
// Usia Produktif (18–59) & Lanjut Usia (60+) triage — Kemenkes Group 5

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getIdentity } from "@/lib/auth";
import { runProduktifLansiaTriage, type ProduktifLansiaInput } from "@/lib/produktifLansiaEngine";
import { saveCase, getPendingCount, generateLocalId, type QueuedCase } from "@/lib/offlineStore";
import { syncPendingCases } from "@/lib/syncClient";

const C = {
  bg: "#0D1F1C", card: "rgba(255,255,255,0.05)",
  border: "rgba(0,150,136,0.25)", accent: "#009688",
  white: "#FFFFFF", dim: "rgba(255,255,255,0.5)",
  red: "#FF6B6B", yellow: "#FFD166", green: "#02C39A",
};

type Step =
  | "home" | "name" | "nik" | "age" | "gender"
  | "weight" | "height" | "waist" | "bp" | "gds"
  | "smoking" | "activity" | "eating" | "kb"
  | "tb1" | "tb2" | "ppok"
  | "mh1" | "mh2" | "mh3"
  | "geriatri_adl" | "geriatri_memory"
  | "result";

interface State {
  patientName: string; nik: string; age_years: number | null;
  gender: "male" | "female" | null;
  weight_kg: number | null; height_cm: number | null;
  waist_cm: number | null; bp_sys: number | null; bp_dia: number | null;
  gds: number | null; smoking: "1" | "2" | "3" | null;
  activity: "1" | "2" | "3" | null; eating: "1" | "2" | "3" | null;
  kb_status: "1" | "2" | "3" | null;
  tb_cough_2wk: boolean; tb_night_sweats: boolean; tb_weight_loss: boolean;
  ppok_chronic_cough: boolean;
  mh_sleep_difficulty: boolean; mh_sad_hopeless: boolean; mh_lost_interest: boolean;
  geriatri_adl: "1" | "2" | "3" | null; geriatri_memory: "1" | "2" | "3" | null;
}

const empty: State = {
  patientName: "", nik: "", age_years: null, gender: null,
  weight_kg: null, height_cm: null, waist_cm: null, bp_sys: null, bp_dia: null,
  gds: null, smoking: null, activity: null, eating: null, kb_status: null,
  tb_cough_2wk: false, tb_night_sweats: false, tb_weight_loss: false,
  ppok_chronic_cough: false,
  mh_sleep_difficulty: false, mh_sad_hopeless: false, mh_lost_interest: false,
  geriatri_adl: null, geriatri_memory: null,
};

function riskColor(l: string) { return l === "HIGH" ? C.red : l === "MEDIUM" ? C.yellow : C.green; }

export default function ProduktifTriagePage() {
  const router = useRouter();
  const [identity, setIdentity] = useState<{ name: string; profileId: string; ngoId: string } | null>(null);
  const [step, setStep] = useState<Step>("home");
  const [s, setS] = useState<State>(empty);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<QueuedCase | null>(null);
  const [synced, setSynced] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const id = getIdentity();
    if (!id) { router.replace("/"); return; }
    setIdentity(id);
    setIsOnline(navigator.onLine);
    window.addEventListener("online", () => setIsOnline(true));
    window.addEventListener("offline", () => setIsOnline(false));
  }, [router]);

  function start() { setS(empty); setInput(""); setError(""); setSynced(false); setStep("name"); }

  function next(updates: Partial<State>, nextStep: Step) {
    setS(prev => ({ ...prev, ...updates }));
    setInput(""); setError(""); setStep(nextStep);
  }

  // Determine next step after eating based on gender/age
  function afterEating(st: State): Step {
    // KB for WUS (women 15-49)
    if (st.gender === 'female' && (st.age_years ?? 0) >= 15 && (st.age_years ?? 0) <= 49) return "kb";
    return "tb1";
  }

  function afterKB(): Step { return "tb1"; }

  function afterTB2(st: State): Step { return "ppok"; }
  function afterPPOK(): Step { return "mh1"; }
  function afterMH3(st: State): Step {
    if ((st.age_years ?? 0) >= 60) return "geriatri_adl";
    return "done" as any; // will call finish
  }

  async function finish(finalState: State) {
    if (!identity || !finalState.age_years || !finalState.gender ||
        !finalState.weight_kg || !finalState.height_cm) return;

    const engineInput: ProduktifLansiaInput = {
      patientName: finalState.patientName,
      nik: finalState.nik,
      age_years: finalState.age_years,
      gender: finalState.gender,
      weight_kg: finalState.weight_kg,
      height_cm: finalState.height_cm,
      waist_cm: finalState.waist_cm,
      bp_sys: finalState.bp_sys,
      bp_dia: finalState.bp_dia,
      gds: finalState.gds,
      smoking: finalState.smoking ?? '3',
      activity: finalState.activity ?? '3',
      eating: finalState.eating ?? '3',
      kb_status: finalState.kb_status,
      tb_cough_2wk: finalState.tb_cough_2wk,
      tb_night_sweats: finalState.tb_night_sweats,
      tb_weight_loss: finalState.tb_weight_loss,
      ppok_chronic_cough: finalState.ppok_chronic_cough,
      mh_sleep_difficulty: finalState.mh_sleep_difficulty,
      mh_sad_hopeless: finalState.mh_sad_hopeless,
      mh_lost_interest: finalState.mh_lost_interest,
      geriatri_adl: finalState.geriatri_adl,
      geriatri_memory: finalState.geriatri_memory,
    };

    const res = runProduktifLansiaTriage(engineInput, identity.name);
    const queued: QueuedCase = {
      localId: generateLocalId(),
      profileId: identity.profileId, ngoId: identity.ngoId,
      moduleType: 'child' as any, // TODO: add 'produktif'/'lansia' to ModuleType
      patientName: finalState.patientName,
      nik: finalState.nik || undefined,
      ageMonths: (finalState.age_years ?? 0) * 12,
      ageDays: null, gender: finalState.gender,
      payload: { module: res.isLansia ? 'lansia' : 'produktif', ...finalState,
        bmi: res.bmi, bmiCategory: res.bmiCategory, bpCategory: res.bpCategory,
        gdsCategory: res.gdsCategory, waistFlag: res.waistFlag,
        tbSuspect: res.tbSuspect, ppokSuspect: res.ppokSuspect,
        mhFlag: res.mhFlag, geriatriFlag: res.geriatriFlag,
      },
      riskLevel: res.riskLevel, reportText: res.reportText,
      referNow: res.referNow, followUpDays: res.followUpDays,
      createdAt: new Date().toISOString(), syncStatus: 'pending',
    };

    await saveCase(queued);
    setResult(queued); setSynced(false); setStep("result");
    if (navigator.onLine) {
      syncPendingCases().then(({ synced: sc }) => { if (sc > 0) setSynced(true); });
    }
  }

  if (!identity) return null;
  const isLansia = (s.age_years ?? 0) >= 60;
  const titleEmoji = isLansia ? "👴" : "🏥";
  const titleText = isLansia ? "Lanjut Usia" : "Usia Produktif";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: "rgba(0,0,0,0.2)" }}>
        <button onClick={() => router.push("/triage")} style={{ background: "none", border: "none", color: C.dim, fontSize: 22, cursor: "pointer", padding: 0 }}>←</button>
        <div>
          <div style={{ color: C.accent, fontWeight: 800, fontSize: 15 }}>{titleEmoji} {step === "home" ? "Usia Produktif & Lansia" : titleText}</div>
          <div style={{ color: C.dim, fontSize: 12 }}>{identity.name}</div>
        </div>
      </div>

      {!isOnline && (
        <div style={{ background: "rgba(255,209,102,0.15)", borderBottom: `1px solid ${C.yellow}`, padding: "8px 20px", color: C.yellow, fontSize: 13, textAlign: "center" }}>
          📵 Mode offline — skrining tetap berjalan
        </div>
      )}

      <div style={{ flex: 1, maxWidth: 480, width: "100%", margin: "0 auto" }}>

        {step === "home" && (
          <div style={{ padding: "40px 20px" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🏥</div>
              <h1 style={{ color: C.accent, fontSize: 22, fontWeight: 800, margin: 0 }}>Usia Produktif & Lansia</h1>
              <p style={{ color: C.dim, fontSize: 14, marginTop: 8 }}>Deteksi dini PTM — usia 18 tahun ke atas</p>
            </div>
            <button onClick={start} style={{ width: "100%", padding: 18, borderRadius: 14, background: C.accent, color: C.white, fontSize: 18, fontWeight: 800, border: "none", cursor: "pointer" }}>
              ➕ Mulai Skrining
            </button>
          </div>
        )}

        {step === "name" && <Q q="Nama?" a={C.accent}><TI p="Contoh: Budi Santoso" v={input} o={setInput} s={() => { if (!input.trim()) { setError("Masukkan nama."); return; } next({ patientName: input.trim() }, "nik"); }} a={C.accent} />{error && <Err m={error} />}</Q>}
        {step === "nik" && <Q q="NIK?" h="16 digit — atau SKIP" a={C.accent}><TI p="16 digit atau SKIP" v={input} o={setInput} s={() => { const v = input.trim().toUpperCase(); if (v === "" || v === "SKIP" || v === "S") { next({ nik: "" }, "age"); return; } if (!/^\d{16}$/.test(v)) { setError("NIK harus 16 digit."); return; } next({ nik: v }, "age"); }} a={C.accent} /><SB o={() => next({ nik: "" }, "age")} />{error && <Err m={error} />}</Q>}
        {step === "age" && <Q q="Usia (tahun)?" h="18 tahun ke atas" a={C.accent}><TI p="Contoh: 45" v={input} o={setInput} t="number" s={() => { const v = parseInt(input.trim()); if (isNaN(v) || v < 18 || v > 110) { setError("Usia harus 18 tahun ke atas."); return; } next({ age_years: v }, "gender"); }} a={C.accent} />{error && <Err m={error} />}</Q>}
        {step === "gender" && <Q q="Jenis kelamin?" a={C.accent}><CB l="👨 Laki-laki" o={() => next({ gender: "male" }, "weight")} a={C.accent} /><CB l="👩 Perempuan" o={() => next({ gender: "female" }, "weight")} a={C.accent} /></Q>}
        {step === "weight" && <Q q="Berat badan (kg)?" a={C.accent}><TI p="Contoh: 65" v={input} o={setInput} t="decimal" s={() => { const v = parseFloat(input.trim().replace(",", ".")); if (isNaN(v) || v < 25 || v > 200) { setError("Berat badan tidak valid."); return; } next({ weight_kg: v }, "height"); }} a={C.accent} />{error && <Err m={error} />}</Q>}
        {step === "height" && <Q q="Tinggi badan (cm)?" a={C.accent}><TI p="Contoh: 165" v={input} o={setInput} t="decimal" s={() => { const v = parseFloat(input.trim().replace(",", ".")); if (isNaN(v) || v < 120 || v > 210) { setError("Tinggi badan tidak valid."); return; } next({ height_cm: v }, "waist"); }} a={C.accent} />{error && <Err m={error} />}</Q>}
        {step === "waist" && <Q q="Lingkar perut (cm)?" h="Pria >90cm / Wanita >80cm = obesitas sentral. SKIP jika tidak diukur." a={C.accent}><TI p="Contoh: 85 atau SKIP" v={input} o={setInput} s={() => { const v = input.trim().toUpperCase(); if (v === "SKIP" || v === "" || v === "S") { next({ waist_cm: null }, "bp"); return; } const n = parseFloat(v.replace(",", ".")); if (isNaN(n) || n < 40 || n > 180) { setError("Tidak valid."); return; } next({ waist_cm: n }, "bp"); }} a={C.accent} /><SB o={() => next({ waist_cm: null }, "bp")} />{error && <Err m={error} />}</Q>}
        {step === "bp" && <Q q="Tekanan darah?" h="Contoh: 130/85 — SKIP jika tidak ada tensimeter" a={C.accent}><TI p="Contoh: 130/85 atau SKIP" v={input} o={setInput} s={() => { const v = input.trim().toUpperCase(); if (v === "SKIP" || v === "") { next({ bp_sys: null, bp_dia: null }, "gds"); return; } const m = v.match(/(\d{2,3})\s*\/\s*(\d{2,3})/); if (m) { next({ bp_sys: parseInt(m[1]), bp_dia: parseInt(m[2]) }, "gds"); } else { setError("Format: 130/85"); } }} a={C.accent} /><SB o={() => next({ bp_sys: null, bp_dia: null }, "gds")} />{error && <Err m={error} />}</Q>}
        {step === "gds" && <Q q="Gula darah sewaktu (mg/dL)?" h="Hasil rapid test. SKIP jika tidak diperiksa." a={C.accent}><TI p="Contoh: 150 atau SKIP" v={input} o={setInput} s={() => { const v = input.trim().toUpperCase(); if (v === "SKIP" || v === "" || v === "S") { next({ gds: null }, "smoking"); return; } const n = parseInt(v); if (isNaN(n) || n < 30 || n > 600) { setError("Tidak valid."); return; } next({ gds: n }, "smoking"); }} a={C.accent} /><SB o={() => next({ gds: null }, "smoking")} />{error && <Err m={error} />}</Q>}

        {step === "smoking" && <Q q="Apakah merokok?" a={C.accent}><CB l="🚬 Ya, aktif" o={() => next({ smoking: "1" }, "activity")} a={C.accent} /><CB l="⚠️ Pernah, sudah berhenti" o={() => next({ smoking: "2" }, "activity")} a={C.accent} /><CB l="✅ Tidak" o={() => next({ smoking: "3" }, "activity")} a={C.accent} /></Q>}
        {step === "activity" && <Q q="Aktivitas fisik 150 menit per minggu?" h="Jalan kaki, senam, berkebun, bersepeda" a={C.accent}><CB l="🏃 Ya, rutin" o={() => next({ activity: "1" }, "eating")} a={C.accent} /><CB l="⚠️ Kadang-kadang" o={() => next({ activity: "2" }, "eating")} a={C.accent} /><CB l="❌ Jarang" o={() => next({ activity: "3" }, "eating")} a={C.accent} /></Q>}
        {step === "eating" && <Q q="Makan sesuai Isi Piringku?" h="Batasi gula <4 sdm, garam <1 sdt, lemak <5 sdm per hari" a={C.accent}><CB l="✅ Ya" o={() => { const updated = { ...s, eating: "1" as const }; setS(updated); setStep(afterEating(updated)); }} a={C.accent} /><CB l="⚠️ Kadang" o={() => { const updated = { ...s, eating: "2" as const }; setS(updated); setStep(afterEating(updated)); }} a={C.accent} /><CB l="❌ Tidak" o={() => { const updated = { ...s, eating: "3" as const }; setS(updated); setStep(afterEating(updated)); }} a={C.accent} /></Q>}

        {step === "kb" && <Q q="Apakah menggunakan alat kontrasepsi / KB?" a={C.accent}><CB l="✅ Ya, menggunakan KB" o={() => next({ kb_status: "1" }, "tb1")} a={C.accent} /><CB l="⚠️ Belum, tapi ingin" sub="Ingin KB tapi belum dapat" o={() => next({ kb_status: "2" }, "tb1")} a={C.accent} /><CB l="ℹ️ Tidak perlu" sub="Tidak aktif / sudah menopause" o={() => next({ kb_status: "3" }, "tb1")} a={C.accent} /></Q>}

        {step === "tb1" && <Q q="Apakah batuk lebih dari 2 minggu?" a={C.accent}><YN y={() => next({ tb_cough_2wk: true }, "tb2")} n={() => next({ tb_cough_2wk: false }, "ppok")} a={C.accent} /></Q>}
        {step === "tb2" && <Q q="Apakah keringat malam ATAU berat badan turun tanpa sebab?" a={C.accent}><YN y={() => next({ tb_night_sweats: true, tb_weight_loss: true }, "ppok")} n={() => next({ tb_night_sweats: false, tb_weight_loss: false }, "ppok")} a={C.accent} /></Q>}
        {step === "ppok" && <Q q="Apakah batuk berdahak hampir setiap hari selama ≥3 bulan dalam 2 tahun berturut-turut?" a={C.accent}><YN y={() => next({ ppok_chronic_cough: true }, "mh1")} n={() => next({ ppok_chronic_cough: false }, "mh1")} a={C.accent} /></Q>}

        {step === "mh1" && <Q q="Apakah sering sulit tidur?" a={C.accent}><YN y={() => next({ mh_sleep_difficulty: true }, "mh2")} n={() => next({ mh_sleep_difficulty: false }, "mh2")} a={C.accent} /></Q>}
        {step === "mh2" && <Q q="Apakah sering merasa sedih atau putus asa?" a={C.accent}><YN y={() => next({ mh_sad_hopeless: true }, "mh3")} n={() => next({ mh_sad_hopeless: false }, "mh3")} a={C.accent} /></Q>}
        {step === "mh3" && <Q q="Apakah kehilangan minat pada hal yang biasa dinikmati?" a={C.accent}><YN y={() => {
          const updated = { ...s, mh_lost_interest: true };
          setS(updated);
          if ((updated.age_years ?? 0) >= 60) { setStep("geriatri_adl"); } else { finish(updated); }
        }} n={() => {
          const updated = { ...s, mh_lost_interest: false };
          setS(updated);
          if ((updated.age_years ?? 0) >= 60) { setStep("geriatri_adl"); } else { finish(updated); }
        }} a={C.accent} /></Q>}

        {step === "geriatri_adl" && <Q q="Tingkat kemandirian lansia?" h="Apakah bisa mandi, makan, berpakaian, ke toilet sendiri?" a={C.accent}>
          <CB l="✅ Mandiri penuh" sub="Semua bisa sendiri" o={() => next({ geriatri_adl: "1" }, "geriatri_memory")} a={C.accent} />
          <CB l="⚠️ Perlu bantuan sebagian" sub="Beberapa hal perlu dibantu" o={() => next({ geriatri_adl: "2" }, "geriatri_memory")} a={C.accent} />
          <CB l="🔴 Sangat tergantung" sub="Hampir semua perlu bantuan" o={() => next({ geriatri_adl: "3" }, "geriatri_memory")} a={C.accent} />
        </Q>}

        {step === "geriatri_memory" && <Q q="Bagaimana daya ingat lansia?" h="Apakah sering lupa nama orang, tempat, atau kejadian baru?" a={C.accent}>
          <CB l="✅ Baik" sub="Ingatan masih tajam" o={() => { const u = { ...s, geriatri_memory: "1" as const }; setS(u); finish(u); }} a={C.accent} />
          <CB l="⚠️ Kadang lupa" sub="Sesekali lupa hal kecil" o={() => { const u = { ...s, geriatri_memory: "2" as const }; setS(u); finish(u); }} a={C.accent} />
          <CB l="🔴 Sering lupa / bingung" sub="Sering tidak ingat, bingung tempat/waktu" o={() => { const u = { ...s, geriatri_memory: "3" as const }; setS(u); finish(u); }} a={C.accent} />
        </Q>}

        {step === "result" && result && (
          <div style={{ padding: "24px 20px" }}>
            <div style={{ background: `${riskColor(result.riskLevel)}20`, border: `2px solid ${riskColor(result.riskLevel)}`, borderRadius: 14, padding: "16px 20px", marginBottom: 20, textAlign: "center" }}>
              <div style={{ color: riskColor(result.riskLevel), fontSize: 18, fontWeight: 800 }}>
                {result.riskLevel === "HIGH" ? "🔴 RISIKO TINGGI" : result.riskLevel === "MEDIUM" ? "🟡 PERLU PERHATIAN" : "🟢 SEHAT"}
              </div>
              {result.referNow && <div style={{ color: C.red, fontSize: 14, marginTop: 6 }}>Rujuk ke Puskesmas</div>}
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <pre style={{ color: C.white, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{result.reportText}</pre>
            </div>
            {synced ? (
              <div style={{ background: "rgba(2,195,154,0.1)", border: `1px solid ${C.green}`, borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 13, color: C.green }}>✅ Data berhasil disinkron ke server</div>
            ) : (
              <div style={{ background: "rgba(255,209,102,0.1)", border: `1px solid ${C.yellow}`, borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 13, color: C.yellow }}>⏳ Tersimpan lokal — akan sinkron saat ada sinyal</div>
            )}
            <button onClick={start} style={{ width: "100%", padding: 16, borderRadius: 12, background: C.accent, color: C.white, fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer", marginBottom: 12 }}>➕ Skrining Berikutnya</button>
            <button onClick={() => router.push("/triage")} style={{ width: "100%", padding: 14, borderRadius: 12, background: C.card, color: C.dim, fontSize: 15, fontWeight: 600, border: `1px solid ${C.border}`, cursor: "pointer" }}>← Kembali ke Beranda</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Compact sub-components ────────────────────────────────────────────────────
function Q({ q, h, children, a }: { q: string; h?: string; children: React.ReactNode; a: string }) {
  return <div style={{ padding: "32px 20px" }}><p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 8 }}>Skrining Dewasa</p><h2 style={{ color: "#FFF", fontSize: 20, fontWeight: 700, marginBottom: h ? 8 : 24, lineHeight: 1.4 }}>{q}</h2>{h && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 24 }}>{h}</p>}{children}</div>;
}
function TI({ p, v, o, s, t = "text", a }: { p: string; v: string; o: (v: string) => void; s: () => void; t?: string; a: string }) {
  return <div><input type={t} placeholder={p} value={v} onChange={e => o(e.target.value)} onKeyDown={e => e.key === "Enter" && s()} autoFocus style={{ width: "100%", padding: "14px 16px", borderRadius: 10, background: "rgba(255,255,255,0.08)", border: `1.5px solid ${a}40`, color: "#FFF", fontSize: 18, outline: "none", boxSizing: "border-box", marginBottom: 16 }} /><button onClick={s} style={{ width: "100%", padding: 14, borderRadius: 10, background: v.trim() ? a : `${a}40`, color: "#FFF", fontSize: 16, fontWeight: 700, border: "none", cursor: v.trim() ? "pointer" : "not-allowed" }}>Lanjut →</button></div>;
}
function CB({ l, sub, o, a }: { l: string; sub?: string; o: () => void; a: string }) {
  return <button onClick={o} style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: `1.5px solid ${a}30`, color: "#FFF", fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 10, textAlign: "left" }}>{l}{sub && <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 }}>{sub}</div>}</button>;
}
function YN({ y, n, a }: { y: () => void; n: () => void; a: string }) {
  return <div style={{ display: "flex", gap: 12 }}><button onClick={y} style={{ flex: 1, padding: 16, borderRadius: 12, background: "rgba(255,107,107,0.15)", border: "1.5px solid rgba(255,107,107,0.5)", color: "#FF6B6B", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>Ya</button><button onClick={n} style={{ flex: 1, padding: 16, borderRadius: 12, background: "rgba(2,195,154,0.1)", border: `1.5px solid ${a}40`, color: "#02C39A", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>Tidak</button></div>;
}
function SB({ o }: { o: () => void }) { return <button onClick={o} style={{ width: "100%", padding: 12, borderRadius: 10, marginTop: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.4)", fontSize: 14, cursor: "pointer" }}>SKIP</button>; }
function Err({ m }: { m: string }) { return <p style={{ color: "#FF6B6B", fontSize: 13, marginTop: 8 }}>{m}</p>; }
