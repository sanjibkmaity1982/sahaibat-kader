"use client";

// app/triage/malaria/page.tsx
// Malaria screening module — WHO danger signs + Kemenkes P2 Malaria

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getIdentity } from "@/lib/auth";
import { runMalariaTriage, type MalariaInput } from "@/lib/malariaEngine";
import { saveCase, getPendingCount, generateLocalId, type QueuedCase } from "@/lib/offlineStore";
import { syncPendingCases } from "@/lib/syncClient";

const C = {
  bg: "#0D1F1C", card: "rgba(255,255,255,0.05)",
  border: "rgba(255,152,0,0.25)", accent: "#FF9800",
  white: "#FFFFFF", dim: "rgba(255,255,255,0.5)",
  red: "#FF6B6B", yellow: "#FFD166", green: "#02C39A",
};

type Step =
  | "home" | "name" | "age" | "gender" | "endemic"
  | "fever_days" | "fever_pattern" | "symptoms" | "danger_signs"
  | "rdt" | "pregnant" | "under5" | "result";

interface State {
  patientName: string; age_years: number | null; gender: "male" | "female" | null;
  endemic_area: "1" | "2" | "3" | null;
  fever_days: number | null; fever_pattern: "1" | "2" | "3" | null;
  symptoms: string[]; danger_signs: string[];
  rdt_result: "1" | "2" | "3" | null;
  is_pregnant: boolean; is_under5: boolean;
}

const empty: State = {
  patientName: "", age_years: null, gender: null, endemic_area: null,
  fever_days: null, fever_pattern: null, symptoms: [], danger_signs: [],
  rdt_result: null, is_pregnant: false, is_under5: false,
};

function riskColor(l: string) { return l === "HIGH" ? C.red : l === "MEDIUM" ? C.yellow : C.green; }

export default function MalariaTriagePage() {
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
  function next(updates: Partial<State>, nextStep: Step) {
    setS(prev => ({ ...prev, ...updates })); setInput(""); setError(""); setSelectedItems([]); setStep(nextStep);
  }

  function toggleItem(item: string) {
    setSelectedItems(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  }

  async function finish(finalState: State) {
    if (!identity || !finalState.age_years || !finalState.gender || !finalState.endemic_area ||
        finalState.fever_days == null || !finalState.fever_pattern || !finalState.rdt_result) return;

    const engineInput: MalariaInput = {
      patientName: finalState.patientName,
      age_years: finalState.age_years,
      gender: finalState.gender,
      endemic_area: finalState.endemic_area,
      fever_days: finalState.fever_days,
      fever_pattern: finalState.fever_pattern,
      symptoms: finalState.symptoms,
      danger_signs: finalState.danger_signs,
      rdt_result: finalState.rdt_result,
      is_pregnant: finalState.is_pregnant,
      is_under5: finalState.is_under5,
    };

    const res = runMalariaTriage(engineInput, identity.name);
    const queued: QueuedCase = {
      localId: generateLocalId(),
      profileId: identity.profileId, ngoId: identity.ngoId,
      moduleType: 'child' as any, // TODO: add 'malaria' to ModuleType
      patientName: finalState.patientName,
      ageMonths: (finalState.age_years ?? 0) * 12,
      ageDays: null, gender: finalState.gender,
      payload: { module: 'malaria', ...finalState },
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

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: "rgba(0,0,0,0.2)" }}>
        <button onClick={() => router.push("/triage")} style={{ background: "none", border: "none", color: C.dim, fontSize: 22, cursor: "pointer", padding: 0 }}>←</button>
        <div>
          <div style={{ color: C.accent, fontWeight: 800, fontSize: 15 }}>🦟 Malaria</div>
          <div style={{ color: C.dim, fontSize: 12 }}>{identity.name}</div>
        </div>
      </div>

      {!isOnline && <div style={{ background: "rgba(255,209,102,0.15)", borderBottom: `1px solid ${C.yellow}`, padding: "8px 20px", color: C.yellow, fontSize: 13, textAlign: "center" }}>📵 Mode offline</div>}

      <div style={{ flex: 1, maxWidth: 480, width: "100%", margin: "0 auto" }}>

        {step === "home" && (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🦟</div>
            <h1 style={{ color: C.accent, fontSize: 22, fontWeight: 800, margin: 0 }}>Skrining Malaria</h1>
            <p style={{ color: C.dim, fontSize: 14, marginTop: 8 }}>Daerah endemis — NTT, Papua, Maluku</p>
            <button onClick={start} style={{ width: "100%", padding: 18, borderRadius: 14, background: C.accent, color: C.white, fontSize: 18, fontWeight: 800, border: "none", cursor: "pointer", marginTop: 24 }}>➕ Mulai Skrining</button>
          </div>
        )}

        {step === "name" && <Q q="Nama pasien?" a={C.accent}><TI p="Contoh: Ahmad" v={input} o={setInput} s={() => { if (!input.trim()) { setError("Masukkan nama."); return; } next({ patientName: input.trim() }, "age"); }} a={C.accent} />{error && <Err m={error} />}</Q>}
        {step === "age" && <Q q="Usia (tahun)?" a={C.accent}><TI p="Contoh: 30" v={input} o={setInput} t="number" s={() => { const v = parseInt(input.trim()); if (isNaN(v) || v < 0 || v > 110) { setError("Usia tidak valid."); return; } next({ age_years: v, is_under5: v < 5 }, "gender"); }} a={C.accent} />{error && <Err m={error} />}</Q>}
        {step === "gender" && <Q q="Jenis kelamin?" a={C.accent}><CB l="👨 Laki-laki" o={() => next({ gender: "male" }, "endemic")} a={C.accent} /><CB l="👩 Perempuan" o={() => next({ gender: "female" }, "endemic")} a={C.accent} /></Q>}

        {step === "endemic" && <Q q="Apakah pasien tinggal atau baru kembali dari daerah malaria?" a={C.accent}>
          <CB l="🔴 Ya, tinggal di daerah endemis" o={() => next({ endemic_area: "1" }, "fever_days")} a={C.accent} />
          <CB l="🟡 Baru kembali (<4 minggu)" sub="Bepergian ke daerah malaria" o={() => next({ endemic_area: "2" }, "fever_days")} a={C.accent} />
          <CB l="🟢 Tidak" o={() => next({ endemic_area: "3" }, "fever_days")} a={C.accent} />
        </Q>}

        {step === "fever_days" && <Q q="Berapa hari demam?" a={C.accent}><TI p="Contoh: 3" v={input} o={setInput} t="number" s={() => { const v = parseInt(input.trim()); if (isNaN(v) || v < 0) { setError("Tidak valid."); return; } next({ fever_days: v }, "fever_pattern"); }} a={C.accent} />{error && <Err m={error} />}</Q>}

        {step === "fever_pattern" && <Q q="Pola demam?" a={C.accent}>
          <CB l="🌡️ Terus-menerus" sub="Demam tidak turun" o={() => next({ fever_pattern: "1" }, "symptoms")} a={C.accent} />
          <CB l="🔄 Naik turun teratur" sub="Tiap 2–3 hari — khas malaria" o={() => next({ fever_pattern: "2" }, "symptoms")} a={C.accent} />
          <CB l="❓ Tidak teratur" o={() => next({ fever_pattern: "3" }, "symptoms")} a={C.accent} />
        </Q>}

        {step === "symptoms" && <Q q="Gejala lain? (pilih semua yang ada)" a={C.accent}>
          {[
            { id: 'menggigil', label: '🥶 Menggigil / keringat dingin' },
            { id: 'sakit_kepala', label: '🤕 Sakit kepala hebat' },
            { id: 'mual', label: '🤢 Mual / muntah' },
            { id: 'nyeri_otot', label: '💪 Nyeri otot / sendi' },
          ].map(item => (
            <button key={item.id} onClick={() => toggleItem(item.id)} style={{
              width: "100%", padding: "12px 16px", borderRadius: 12, marginBottom: 8,
              background: selectedItems.includes(item.id) ? `${C.accent}20` : "rgba(255,255,255,0.05)",
              border: `1.5px solid ${selectedItems.includes(item.id) ? C.accent : 'rgba(255,255,255,0.15)'}`,
              color: C.white, fontSize: 15, fontWeight: 600, cursor: "pointer", textAlign: "left",
            }}>{selectedItems.includes(item.id) ? '✅ ' : '⬜ '}{item.label}</button>
          ))}
          <button onClick={() => next({ symptoms: selectedItems }, "danger_signs")} style={{ width: "100%", padding: 14, borderRadius: 10, background: C.accent, color: C.white, fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer", marginTop: 8 }}>
            {selectedItems.length === 0 ? 'Tidak ada gejala → Lanjut' : `${selectedItems.length} gejala dipilih → Lanjut`}
          </button>
        </Q>}

        {step === "danger_signs" && <Q q="Tanda bahaya? (pilih semua yang ada)" h="⚠️ Jika ada tanda bahaya → DARURAT" a={C.accent}>
          {[
            { id: 'kesadaran', label: '😵 Kesadaran menurun / bingung' },
            { id: 'kejang', label: '⚡ Kejang' },
            { id: 'lemas', label: '😰 Sangat lemas, tidak bisa duduk' },
            { id: 'kuning', label: '🟡 Kuning pada mata / kulit' },
            { id: 'kencing_sedikit', label: '💧 Kencing sangat sedikit / gelap' },
            { id: 'sesak', label: '😮‍💨 Sesak napas' },
          ].map(item => (
            <button key={item.id} onClick={() => toggleItem(item.id)} style={{
              width: "100%", padding: "12px 16px", borderRadius: 12, marginBottom: 8,
              background: selectedItems.includes(item.id) ? "rgba(255,107,107,0.2)" : "rgba(255,255,255,0.05)",
              border: `1.5px solid ${selectedItems.includes(item.id) ? C.red : 'rgba(255,255,255,0.15)'}`,
              color: C.white, fontSize: 15, fontWeight: 600, cursor: "pointer", textAlign: "left",
            }}>{selectedItems.includes(item.id) ? '🔴 ' : '⬜ '}{item.label}</button>
          ))}
          <button onClick={() => next({ danger_signs: selectedItems }, "rdt")} style={{ width: "100%", padding: 14, borderRadius: 10, background: selectedItems.length > 0 ? C.red : C.accent, color: C.white, fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer", marginTop: 8 }}>
            {selectedItems.length === 0 ? 'Tidak ada tanda bahaya → Lanjut' : `${selectedItems.length} tanda bahaya → Lanjut`}
          </button>
        </Q>}

        {step === "rdt" && <Q q="Apakah sudah dilakukan tes RDT (tes malaria cepat)?" a={C.accent}>
          <CB l="🔴 Ya, POSITIF" o={() => next({ rdt_result: "1" }, s.gender === "female" ? "pregnant" : "under5")} a={C.accent} />
          <CB l="🟢 Ya, Negatif" o={() => next({ rdt_result: "2" }, s.gender === "female" ? "pregnant" : "under5")} a={C.accent} />
          <CB l="⚪ Belum dilakukan" o={() => next({ rdt_result: "3" }, s.gender === "female" ? "pregnant" : "under5")} a={C.accent} />
        </Q>}

        {step === "pregnant" && <Q q="Apakah pasien sedang hamil?" a={C.accent}>
          <YN y={() => next({ is_pregnant: true }, "under5")} n={() => next({ is_pregnant: false }, "under5")} a={C.accent} />
        </Q>}

        {step === "under5" && <Q q="Apakah pasien berusia di bawah 5 tahun?" a={C.accent}>
          <YN y={() => { const u = { ...s, is_under5: true }; setS(u); finish(u); }} n={() => { const u = { ...s, is_under5: false }; setS(u); finish(u); }} a={C.accent} />
        </Q>}

        {step === "result" && result && (
          <div style={{ padding: "24px 20px" }}>
            <div style={{ background: `${riskColor(result.riskLevel)}20`, border: `2px solid ${riskColor(result.riskLevel)}`, borderRadius: 14, padding: "16px 20px", marginBottom: 20, textAlign: "center" }}>
              <div style={{ color: riskColor(result.riskLevel), fontSize: 18, fontWeight: 800 }}>
                {result.riskLevel === "HIGH" ? "🔴 MALARIA BERAT / DARURAT" : result.riskLevel === "MEDIUM" ? "🟡 SUSPEK MALARIA" : "🟢 RISIKO RENDAH"}
              </div>
              {result.referNow && <div style={{ color: C.red, fontSize: 14, marginTop: 6 }}>Rujuk ke RS/Puskesmas SEGERA</div>}
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
  return <div style={{ padding: "32px 20px" }}><p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 8 }}>Skrining Malaria</p><h2 style={{ color: "#FFF", fontSize: 20, fontWeight: 700, marginBottom: h ? 8 : 24, lineHeight: 1.4 }}>{q}</h2>{h && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 24 }}>{h}</p>}{children}</div>;
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
