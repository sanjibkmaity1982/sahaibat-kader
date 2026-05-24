"use client";

// app/triage/tb/page.tsx
// Advanced TB screening — symptoms, treatment, MDR-TB, contact tracing

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getIdentity } from "@/lib/auth";
import { runTBTriage, type TBInput } from "@/lib/tbEngine";
import { saveCase, getPendingCount, generateLocalId, type QueuedCase } from "@/lib/offlineStore";
import { syncPendingCases } from "@/lib/syncClient";

const C = {
  bg: "#0D1F1C", card: "rgba(255,255,255,0.05)",
  border: "rgba(121,85,72,0.3)", accent: "#795548",
  white: "#FFFFFF", dim: "rgba(255,255,255,0.5)",
  red: "#FF6B6B", yellow: "#FFD166", green: "#02C39A",
};

type Step =
  | "home" | "name" | "age" | "gender"
  | "cough_2wk" | "cough_blood" | "night_sweats" | "weight_loss" | "fever_2wk" | "fatigue"
  | "hiv" | "diabetes" | "smoking_tb" | "close_contact"
  | "treatment_status" | "oat_month" | "oat_adherence" | "oat_side"
  | "household_contacts" | "household_u5" | "household_cough"
  | "result";

interface State {
  patientName: string; age_years: number | null; gender: "male" | "female" | null;
  cough_2wk: boolean; cough_blood: boolean; night_sweats: boolean;
  weight_loss: boolean; fever_2wk: boolean; fatigue: boolean;
  hiv_positive: boolean; diabetes: boolean; smoking: boolean; close_contact: boolean;
  treatment_status: "1" | "2" | "3" | "4" | null;
  oat_month: number | null; oat_adherence: "1" | "2" | "3" | null;
  oat_side_effects: string[];
  household_contacts: number | null; household_children_u5: number | null;
  household_cough: boolean;
}

const empty: State = {
  patientName: "", age_years: null, gender: null,
  cough_2wk: false, cough_blood: false, night_sweats: false,
  weight_loss: false, fever_2wk: false, fatigue: false,
  hiv_positive: false, diabetes: false, smoking: false, close_contact: false,
  treatment_status: null, oat_month: null, oat_adherence: null, oat_side_effects: [],
  household_contacts: null, household_children_u5: null, household_cough: false,
};

function riskColor(l: string) { return l === "HIGH" ? C.red : l === "MEDIUM" ? C.yellow : C.green; }

export default function TBTriagePage() {
  const router = useRouter();
  const [identity, setIdentity] = useState<{ name: string; profileId: string; ngoId: string } | null>(null);
  const [step, setStep] = useState<Step>("home");
  const [s, setS] = useState<State>(empty);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<QueuedCase | null>(null);
  const [synced, setSynced] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  useEffect(() => {
    const id = getIdentity();
    if (!id) { router.replace("/"); return; }
    setIdentity(id);
    setIsOnline(navigator.onLine);
    window.addEventListener("online", () => setIsOnline(true));
    window.addEventListener("offline", () => setIsOnline(false));
  }, [router]);

  function start() { setS(empty); setInput(""); setError(""); setSynced(false); setSelectedItems([]); setStep("name"); }
  function next(updates: Partial<State>, nextStep: Step) { setS(prev => ({ ...prev, ...updates })); setInput(""); setError(""); setSelectedItems([]); setStep(nextStep); }

  function toggleItem(item: string) { setSelectedItems(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]); }

  // After treatment_status, route to OAT questions or contact tracing
  function afterTreatment(status: "1" | "2" | "3" | "4") {
    if (status === "2") return "oat_month";
    return "household_contacts";
  }

  // After OAT side effects, go to contact tracing
  function afterOatSide() { return "household_contacts"; }

  async function finish(finalState: State) {
    if (!identity || !finalState.age_years || !finalState.gender || !finalState.treatment_status) return;

    const engineInput: TBInput = {
      patientName: finalState.patientName,
      age_years: finalState.age_years,
      gender: finalState.gender,
      cough_2wk: finalState.cough_2wk,
      cough_blood: finalState.cough_blood,
      night_sweats: finalState.night_sweats,
      weight_loss: finalState.weight_loss,
      fever_2wk: finalState.fever_2wk,
      fatigue: finalState.fatigue,
      hiv_positive: finalState.hiv_positive,
      diabetes: finalState.diabetes,
      smoking: finalState.smoking,
      close_contact: finalState.close_contact,
      treatment_status: finalState.treatment_status,
      oat_month: finalState.oat_month,
      oat_adherence: finalState.oat_adherence,
      oat_side_effects: finalState.oat_side_effects,
      household_contacts: finalState.household_contacts,
      household_children_u5: finalState.household_children_u5,
      household_cough: finalState.household_cough,
      paparan_asap: false,
    };

    const res = runTBTriage(engineInput, identity.name);
    const queued: QueuedCase = {
      localId: generateLocalId(),
      profileId: identity.profileId, ngoId: identity.ngoId,
      moduleType: 'child' as any,
      patientName: finalState.patientName,
      ageMonths: (finalState.age_years ?? 0) * 12,
      ageDays: null, gender: finalState.gender,
      payload: { module: 'tb', ...finalState, tbSuspect: res.tbSuspect, mdrFlag: res.mdrFlag },
      riskLevel: res.riskLevel, reportText: res.reportText,
      referNow: res.referNow, followUpDays: res.followUpDays,
      createdAt: new Date().toISOString(), syncStatus: 'pending',
    };

    await saveCase(queued);
    setResult(queued); setSynced(false); setStep("result");
    if (navigator.onLine) { syncPendingCases().then(({ synced: sc }) => { if (sc > 0) setSynced(true); }); }
  }

  if (!identity) return null;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: "rgba(0,0,0,0.2)" }}>
        <button onClick={() => router.push("/triage")} style={{ background: "none", border: "none", color: C.dim, fontSize: 22, cursor: "pointer", padding: 0 }}>←</button>
        <div>
          <div style={{ color: C.accent, fontWeight: 800, fontSize: 15 }}>🫁 Skrining TBC</div>
          <div style={{ color: C.dim, fontSize: 12 }}>{identity.name}</div>
        </div>
      </div>

      {!isOnline && <div style={{ background: "rgba(255,209,102,0.15)", borderBottom: `1px solid ${C.yellow}`, padding: "8px 20px", color: C.yellow, fontSize: 13, textAlign: "center" }}>📵 Mode offline</div>}

      <div style={{ flex: 1, maxWidth: 480, width: "100%", margin: "0 auto" }}>

        {step === "home" && (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🫁</div>
            <h1 style={{ color: C.accent, fontSize: 22, fontWeight: 800, margin: 0 }}>Skrining TBC</h1>
            <p style={{ color: C.dim, fontSize: 14, marginTop: 8 }}>Deteksi dini, pengobatan, kontak tracing</p>
            <button onClick={start} style={{ width: "100%", padding: 18, borderRadius: 14, background: C.accent, color: C.white, fontSize: 18, fontWeight: 800, border: "none", cursor: "pointer", marginTop: 24 }}>➕ Mulai Skrining</button>
          </div>
        )}

        {step === "name" && <Q q="Nama pasien?" a={C.accent}><TI p="Contoh: Budi" v={input} o={setInput} s={() => { if (!input.trim()) { setError("Masukkan nama."); return; } next({ patientName: input.trim() }, "age"); }} a={C.accent} />{error && <Err m={error} />}</Q>}
        {step === "age" && <Q q="Usia (tahun)?" a={C.accent}><TI p="Contoh: 35" v={input} o={setInput} t="number" s={() => { const v = parseInt(input.trim()); if (isNaN(v) || v < 0 || v > 110) { setError("Tidak valid."); return; } next({ age_years: v }, "gender"); }} a={C.accent} />{error && <Err m={error} />}</Q>}
        {step === "gender" && <Q q="Jenis kelamin?" a={C.accent}><CB l="👨 Laki-laki" o={() => next({ gender: "male" }, "cough_2wk")} a={C.accent} /><CB l="👩 Perempuan" o={() => next({ gender: "female" }, "cough_2wk")} a={C.accent} /></Q>}

        {/* Symptoms */}
        {step === "cough_2wk" && <Q q="Apakah batuk selama 2 minggu atau lebih?" a={C.accent}><YN y={() => next({ cough_2wk: true }, "cough_blood")} n={() => next({ cough_2wk: false }, "cough_blood")} a={C.accent} /></Q>}
        {step === "cough_blood" && <Q q="Apakah pernah batuk darah?" a={C.accent}><YN y={() => next({ cough_blood: true }, "night_sweats")} n={() => next({ cough_blood: false }, "night_sweats")} a={C.accent} /></Q>}
        {step === "night_sweats" && <Q q="Apakah sering berkeringat di malam hari (tanpa aktivitas)?" a={C.accent}><YN y={() => next({ night_sweats: true }, "weight_loss")} n={() => next({ night_sweats: false }, "weight_loss")} a={C.accent} /></Q>}
        {step === "weight_loss" && <Q q="Apakah berat badan turun tanpa sebab yang jelas?" a={C.accent}><YN y={() => next({ weight_loss: true }, "fever_2wk")} n={() => next({ weight_loss: false }, "fever_2wk")} a={C.accent} /></Q>}
        {step === "fever_2wk" && <Q q="Apakah demam ≥2 minggu?" a={C.accent}><YN y={() => next({ fever_2wk: true }, "fatigue")} n={() => next({ fever_2wk: false }, "fatigue")} a={C.accent} /></Q>}
        {step === "fatigue" && <Q q="Apakah lemas terus-menerus?" a={C.accent}><YN y={() => next({ fatigue: true }, "hiv")} n={() => next({ fatigue: false }, "hiv")} a={C.accent} /></Q>}

        {/* Risk factors */}
        {step === "hiv" && <Q q="Apakah HIV positif?" h="Informasi ini membantu penilaian risiko" a={C.accent}><YN y={() => next({ hiv_positive: true }, "diabetes")} n={() => next({ hiv_positive: false }, "diabetes")} a={C.accent} /></Q>}
        {step === "diabetes" && <Q q="Apakah menderita diabetes?" a={C.accent}><YN y={() => next({ diabetes: true }, "smoking_tb")} n={() => next({ diabetes: false }, "smoking_tb")} a={C.accent} /></Q>}
        {step === "smoking_tb" && <Q q="Apakah merokok?" a={C.accent}><YN y={() => next({ smoking: true }, "close_contact")} n={() => next({ smoking: false }, "close_contact")} a={C.accent} /></Q>}
        {step === "close_contact" && <Q q="Apakah tinggal serumah dengan pasien TBC?" a={C.accent}><YN y={() => next({ close_contact: true }, "treatment_status")} n={() => next({ close_contact: false }, "treatment_status")} a={C.accent} /></Q>}

        {/* Treatment status */}
        {step === "treatment_status" && <Q q="Status pengobatan TBC?" a={C.accent}>
          <CB l="ℹ️ Belum pernah" o={() => next({ treatment_status: "1" }, "household_contacts")} a={C.accent} />
          <CB l="💊 Sedang minum OAT" sub="Dalam pengobatan saat ini" o={() => next({ treatment_status: "2" }, "oat_month")} a={C.accent} />
          <CB l="✅ Pernah — sudah selesai" o={() => next({ treatment_status: "3" }, "household_contacts")} a={C.accent} />
          <CB l="🔴 Pernah — TIDAK selesai" sub="Berhenti sebelum 6 bulan" o={() => next({ treatment_status: "4" }, "household_contacts")} a={C.accent} />
        </Q>}

        {/* OAT questions (only if on treatment) */}
        {step === "oat_month" && <Q q="Pengobatan OAT bulan ke berapa?" a={C.accent}>
          <TI p="Contoh: 3" v={input} o={setInput} t="number" s={() => { const v = parseInt(input.trim()); if (isNaN(v) || v < 1 || v > 24) { setError("1–24 bulan."); return; } next({ oat_month: v }, "oat_adherence"); }} a={C.accent} />
          {error && <Err m={error} />}
        </Q>}

        {step === "oat_adherence" && <Q q="Apakah minum OAT teratur setiap hari?" a={C.accent}>
          <CB l="✅ Ya, rutin setiap hari" o={() => next({ oat_adherence: "1" }, "oat_side")} a={C.accent} />
          <CB l="⚠️ Kadang lupa" o={() => next({ oat_adherence: "2" }, "oat_side")} a={C.accent} />
          <CB l="🔴 Sering lupa / pernah berhenti" o={() => next({ oat_adherence: "3" }, "oat_side")} a={C.accent} />
        </Q>}

        {step === "oat_side" && <Q q="Efek samping OAT? (pilih semua yang ada)" a={C.accent}>
          {[
            { id: 'mual', label: '🤢 Mual / tidak nafsu makan' },
            { id: 'kuning', label: '🟡 Kuning pada mata/kulit (BAHAYA)' },
            { id: 'gatal', label: '😣 Gatal-gatal / ruam kulit' },
            { id: 'gangguan_penglihatan', label: '👁️ Gangguan penglihatan (BAHAYA)' },
            { id: 'kesemutan', label: '🖐️ Kesemutan tangan/kaki' },
          ].map(item => (
            <button key={item.id} onClick={() => toggleItem(item.id)} style={{
              width: "100%", padding: "12px 16px", borderRadius: 12, marginBottom: 8,
              background: selectedItems.includes(item.id) ? `${C.accent}20` : "rgba(255,255,255,0.05)",
              border: `1.5px solid ${selectedItems.includes(item.id) ? (item.id === 'kuning' || item.id === 'gangguan_penglihatan' ? C.red : C.accent) : 'rgba(255,255,255,0.15)'}`,
              color: C.white, fontSize: 15, fontWeight: 600, cursor: "pointer", textAlign: "left",
            }}>{selectedItems.includes(item.id) ? '✅ ' : '⬜ '}{item.label}</button>
          ))}
          <button onClick={() => next({ oat_side_effects: selectedItems }, "household_contacts")} style={{ width: "100%", padding: 14, borderRadius: 10, background: C.accent, color: C.white, fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer", marginTop: 8 }}>
            {selectedItems.length === 0 ? 'Tidak ada efek samping → Lanjut' : `${selectedItems.length} dipilih → Lanjut`}
          </button>
        </Q>}

        {/* Contact tracing */}
        {step === "household_contacts" && <Q q="Berapa orang tinggal serumah?" h="Termasuk pasien" a={C.accent}>
          <TI p="Contoh: 5" v={input} o={setInput} t="number" s={() => { const v = parseInt(input.trim()); if (isNaN(v) || v < 1) { setError("Min 1."); return; } next({ household_contacts: v }, "household_u5"); }} a={C.accent} />
          {error && <Err m={error} />}
        </Q>}

        {step === "household_u5" && <Q q="Berapa anak di bawah 5 tahun di rumah?" a={C.accent}>
          <TI p="Contoh: 1 atau 0" v={input} o={setInput} t="number" s={() => { const v = parseInt(input.trim()); if (isNaN(v) || v < 0) { setError("Min 0."); return; } next({ household_children_u5: v }, "household_cough"); }} a={C.accent} />
          {error && <Err m={error} />}
        </Q>}

        {step === "household_cough" && <Q q="Apakah ada orang lain di rumah yang batuk lama?" a={C.accent}>
          <YN y={() => { const u = { ...s, household_cough: true }; setS(u); finish(u); }} n={() => { const u = { ...s, household_cough: false }; setS(u); finish(u); }} a={C.accent} />
        </Q>}

        {step === "result" && result && (
          <div style={{ padding: "24px 20px" }}>
            <div style={{ background: `${riskColor(result.riskLevel)}20`, border: `2px solid ${riskColor(result.riskLevel)}`, borderRadius: 14, padding: "16px 20px", marginBottom: 20, textAlign: "center" }}>
              <div style={{ color: riskColor(result.riskLevel), fontSize: 18, fontWeight: 800 }}>
                {result.riskLevel === "HIGH" ? "🔴 RISIKO TINGGI" : result.riskLevel === "MEDIUM" ? "🟡 SUSPEK TBC" : "🟢 RISIKO RENDAH"}
              </div>
              {result.referNow && <div style={{ color: C.red, fontSize: 14, marginTop: 6 }}>Rujuk ke Puskesmas SEGERA</div>}
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <pre style={{ color: C.white, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{result.reportText}</pre>
            </div>
            {synced ? (
              <div style={{ background: "rgba(2,195,154,0.1)", border: `1px solid ${C.green}`, borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 13, color: C.green }}>✅ Disinkron</div>
            ) : (
              <div style={{ background: "rgba(255,209,102,0.1)", border: `1px solid ${C.yellow}`, borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 13, color: C.yellow }}>⏳ Tersimpan lokal</div>
            )}
            <button onClick={start} style={{ width: "100%", padding: 16, borderRadius: 12, background: C.accent, color: C.white, fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer", marginBottom: 12 }}>➕ Skrining Berikutnya</button>
            <button onClick={() => router.push("/triage")} style={{ width: "100%", padding: 14, borderRadius: 12, background: C.card, color: C.dim, fontSize: 15, fontWeight: 600, border: `1px solid ${C.border}`, cursor: "pointer" }}>← Kembali ke Beranda</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Q({ q, h, children, a }: { q: string; h?: string; children: React.ReactNode; a: string }) {
  return <div style={{ padding: "32px 20px" }}><p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 8 }}>Skrining TBC</p><h2 style={{ color: "#FFF", fontSize: 20, fontWeight: 700, marginBottom: h ? 8 : 24, lineHeight: 1.4 }}>{q}</h2>{h && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 24 }}>{h}</p>}{children}</div>;
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
function Err({ m }: { m: string }) { return <p style={{ color: "#FF6B6B", fontSize: 13, marginTop: 8 }}>{m}</p>; }
