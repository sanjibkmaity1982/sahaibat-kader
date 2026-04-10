"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getIdentity } from "@/lib/auth";
import { runMaternalTriage, type MaternalInput } from "@/lib/maternalEngine";
import { saveCase, getPendingCount, generateLocalId, type QueuedCase } from "@/lib/offlineStore";
import { syncPendingCases } from "@/lib/syncClient";

const C = {
  bg: "#0D1F1C", card: "rgba(255,255,255,0.05)",
  border: "rgba(233,30,140,0.25)", accent: "#E91E8C",
  white: "#FFFFFF", dim: "rgba(255,255,255,0.5)",
  dimmer: "rgba(255,255,255,0.25)", red: "#FF6B6B",
  yellow: "#FFD166", green: "#02C39A",
};

type Step =
  | "name" | "gestasi" | "perdarahan" | "nyeri_perut"
  | "sakit_kepala" | "demam" | "muntah" | "gerak_bayi"
  | "sesak" | "bengkak" | "keputihan" | "td" | "result";

const emptyInput: MaternalInput = {
  gestasi_weeks: null, perdarahan: false, nyeri_perut: false,
  sakit_kepala_kabur: false, demam: false, muntah_hebat: false,
  gerak_bayi_kurang: null, sesak_jantung: false,
  bengkak_mendadak: false, keputihan_abnormal: false,
  td_sys: null, td_dia: null,
};

export default function MaternalTriagePage() {
  const router = useRouter();
  const [identity, setIdentity] = useState<{ name: string; profileId: string; ngoId: string } | null>(null);
  const [step, setStep] = useState<Step>("name");
  const [patientName, setPatientName] = useState("");
  const [input, setInput] = useState<MaternalInput>(emptyInput);
  const [textInput, setTextInput] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<QueuedCase | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const id = getIdentity();
    if (!id) { router.replace("/"); return; }
    setIdentity(id);
    setIsOnline(navigator.onLine);
    window.addEventListener("online", () => setIsOnline(true));
    window.addEventListener("offline", () => setIsOnline(false));
  }, [router]);

  function yesNo(field: keyof MaternalInput, value: boolean, nextStep: Step) {
    setInput(prev => ({ ...prev, [field]: value }));
    setError("");
    setStep(nextStep);
  }

  async function finish(finalInput: MaternalInput) {
    if (!identity) return;
    const engineResult = runMaternalTriage(finalInput, patientName, identity.name);
    const queued: QueuedCase = {
      localId: generateLocalId(),
      profileId: identity.profileId,
      ngoId: identity.ngoId,
      moduleType: 'maternal',
      patientName,
      ageMonths: null,
      ageDays: null,
      gender: 'female',
      payload: { ...finalInput },
      riskLevel: engineResult.riskLevel,
      reportText: engineResult.reportText,
      referNow: engineResult.referNow,
      followUpDays: engineResult.followUpDays,
      createdAt: new Date().toISOString(),
      syncStatus: 'pending',
    };
    await saveCase(queued);
    setResult(queued);
    setStep("result");
  }

  function reset() {
    setStep("name"); setPatientName(""); setInput(emptyInput);
    setTextInput(""); setError(""); setResult(null);
  }

  if (!identity) return null;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
        background: "rgba(0,0,0,0.2)",
      }}>
        <button onClick={() => router.push("/triage")} style={{
          background: "none", border: "none", color: C.dim,
          fontSize: 22, cursor: "pointer", padding: 0,
        }}>←</button>
        <div>
          <div style={{ color: C.accent, fontWeight: 800, fontSize: 15 }}>🤰 Ibu Hamil</div>
          <div style={{ color: C.dim, fontSize: 12 }}>Triase antenatal — KMS Permenkes 2/2020</div>
        </div>
      </div>

      {!isOnline && (
        <div style={{
          background: "rgba(255,209,102,0.15)", borderBottom: `1px solid ${C.yellow}`,
          padding: "8px 20px", color: C.yellow, fontSize: 13, textAlign: "center",
        }}>
          📵 Mode offline — triage tetap berjalan
        </div>
      )}

      <div style={{ flex: 1, maxWidth: 480, width: "100%", margin: "0 auto" }}>

        {/* ── NAME ── */}
        {step === "name" && (
          <QCard title="Nama ibu hamil?" accent={C.accent}>
            <TInput
              placeholder="Contoh: Sari Dewi"
              value={textInput}
              onChange={setTextInput}
              onSubmit={() => {
                if (!textInput.trim()) { setError("Masukkan nama ibu."); return; }
                setPatientName(textInput.trim());
                setTextInput(""); setError("");
                setStep("gestasi");
              }}
              accent={C.accent}
            />
            {error && <Err msg={error} />}
          </QCard>
        )}

        {/* ── GESTASI ── */}
        {step === "gestasi" && (
          <QCard title="Usia kehamilan (minggu)?" hint="Ketik 0 jika tidak tahu" accent={C.accent}>
            <TInput
              placeholder="Contoh: 28"
              value={textInput}
              onChange={setTextInput}
              type="number"
              onSubmit={() => {
                const val = parseInt(textInput.trim());
                const weeks = isNaN(val) || val < 0 ? null : Math.min(val, 45);
                setInput(prev => ({ ...prev, gestasi_weeks: weeks }));
                setTextInput(""); setError("");
                setStep("perdarahan");
              }}
              accent={C.accent}
            />
            {error && <Err msg={error} />}
          </QCard>
        )}

        {/* ── PERDARAHAN ── */}
        {step === "perdarahan" && (
          <QCard title="Ada perdarahan dari jalan lahir?" accent={C.accent}>
            <YNButtons
              onYes={() => {
                // Hard exit — perdarahan is always DARURAT
                const updated = { ...input, perdarahan: true };
                setInput(updated);
                finish(updated);
              }}
              onNo={() => yesNo("perdarahan", false, "nyeri_perut")}
              accent={C.accent}
            />
          </QCard>
        )}

        {/* ── NYERI PERUT ── */}
        {step === "nyeri_perut" && (
          <QCard title="Ada nyeri perut yang hebat?" accent={C.accent}>
            <YNButtons
              onYes={() => yesNo("nyeri_perut", true, "sakit_kepala")}
              onNo={() => yesNo("nyeri_perut", false, "sakit_kepala")}
              accent={C.accent}
            />
          </QCard>
        )}

        {/* ── SAKIT KEPALA ── */}
        {step === "sakit_kepala" && (
          <QCard title="Sakit kepala sangat berat ATAU pandangan kabur?" accent={C.accent}>
            <YNButtons
              onYes={() => yesNo("sakit_kepala_kabur", true, "demam")}
              onNo={() => yesNo("sakit_kepala_kabur", false, "demam")}
              accent={C.accent}
            />
          </QCard>
        )}

        {/* ── DEMAM ── */}
        {step === "demam" && (
          <QCard title="Demam tinggi (>38°C)?" accent={C.accent}>
            <YNButtons
              onYes={() => yesNo("demam", true, "muntah")}
              onNo={() => yesNo("demam", false, "muntah")}
              accent={C.accent}
            />
          </QCard>
        )}

        {/* ── MUNTAH ── */}
        {step === "muntah" && (
          <QCard title="Mual/muntah sangat hebat — tidak bisa makan/minum sama sekali?" accent={C.accent}>
            <YNButtons
              onYes={() => {
                setInput(prev => ({ ...prev, muntah_hebat: true }));
                setStep((input.gestasi_weeks ?? 0) >= 20 ? "gerak_bayi" : "sesak");
              }}
              onNo={() => {
                setInput(prev => ({ ...prev, muntah_hebat: false }));
                setStep((input.gestasi_weeks ?? 0) >= 20 ? "gerak_bayi" : "sesak");
              }}
              accent={C.accent}
            />
          </QCard>
        )}

        {/* ── GERAK BAYI (≥20 weeks only) ── */}
        {step === "gerak_bayi" && (
          <QCard
            title={`Usia ${input.gestasi_weeks} minggu — gerakan bayi normal hari ini?`}
            hint="Normal: minimal 10 kali dalam 12 jam"
            accent={C.accent}
          >
            <ChoiceBtn label="✅ Normal" sub="Bayi bergerak cukup" onClick={() => {
              setInput(prev => ({ ...prev, gerak_bayi_kurang: false }));
              setStep("sesak");
            }} accent={C.accent} />
            <ChoiceBtn label="⚠️ Berkurang" sub="Kurang dari 10 kali" onClick={() => {
              setInput(prev => ({ ...prev, gerak_bayi_kurang: true }));
              setStep("sesak");
            }} accent={C.accent} />
            <ChoiceBtn label="🚨 Tidak terasa sama sekali" sub="Tidak ada gerakan" onClick={() => {
              const updated = { ...input, gerak_bayi_kurang: true };
              setInput(updated);
              finish(updated); // immediate DARURAT
            }} accent={C.accent} />
          </QCard>
        )}

        {/* ── SESAK ── */}
        {step === "sesak" && (
          <QCard title="Sesak napas ATAU jantung berdebar-debar?" accent={C.accent}>
            <YNButtons
              onYes={() => yesNo("sesak_jantung", true, "bengkak")}
              onNo={() => yesNo("sesak_jantung", false, "bengkak")}
              accent={C.accent}
            />
          </QCard>
        )}

        {/* ── BENGKAK ── */}
        {step === "bengkak" && (
          <QCard title="Bengkak mendadak di tangan, wajah, atau kaki?" accent={C.accent}>
            <YNButtons
              onYes={() => yesNo("bengkak_mendadak", true, "keputihan")}
              onNo={() => yesNo("bengkak_mendadak", false, "keputihan")}
              accent={C.accent}
            />
          </QCard>
        )}

        {/* ── KEPUTIHAN ── */}
        {step === "keputihan" && (
          <QCard title="Keputihan berbau, gatal berlebihan, atau keluar cairan tidak biasa?" accent={C.accent}>
            <YNButtons
              onYes={() => yesNo("keputihan_abnormal", true, "td")}
              onNo={() => yesNo("keputihan_abnormal", false, "td")}
              accent={C.accent}
            />
          </QCard>
        )}

        {/* ── TD ── */}
        {step === "td" && (
          <QCard title="Tekanan darah ibu?" hint="Ketik contoh: 120/80 — atau SKIP jika tidak ada alat" accent={C.accent}>
            <TInput
              placeholder="Contoh: 120/80 atau SKIP"
              value={textInput}
              onChange={setTextInput}
              onSubmit={() => {
                const val = textInput.trim().toUpperCase();
                let updated = { ...input };
                if (val === "SKIP" || val === "") {
                  updated = { ...updated, td_sys: null, td_dia: null };
                } else {
                  const match = val.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
                  if (match) {
                    updated = { ...updated, td_sys: parseInt(match[1]), td_dia: parseInt(match[2]) };
                  }
                }
                setInput(updated);
                setTextInput("");
                finish(updated);
              }}
              accent={C.accent}
            />
            <button onClick={() => { setInput(prev => ({ ...prev, td_sys: null, td_dia: null })); finish({ ...input, td_sys: null, td_dia: null }); }} style={{
              width: "100%", padding: 12, borderRadius: 10, marginTop: 8,
              background: "transparent", border: `1px solid ${C.border}`,
              color: C.dim, fontSize: 14, cursor: "pointer",
            }}>SKIP — tidak ada tensimeter</button>
          </QCard>
        )}

        {/* ── RESULT ── */}
        {step === "result" && result && (
          <ResultScreen result={result} onNext={reset} onHome={() => router.push("/triage")} />
        )}

      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function QCard({ title, hint, children, accent }: {
  title: string; hint?: string; children: React.ReactNode; accent: string;
}) {
  return (
    <div style={{ padding: "32px 20px" }}>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 8 }}>Triase Ibu Hamil</p>
      <h2 style={{ color: "#FFFFFF", fontSize: 20, fontWeight: 700, marginBottom: hint ? 8 : 24, lineHeight: 1.4 }}>
        {title}
      </h2>
      {hint && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 24 }}>{hint}</p>}
      {children}
    </div>
  );
}

function TInput({ placeholder, value, onChange, onSubmit, type = "text", accent }: {
  placeholder: string; value: string; onChange: (v: string) => void;
  onSubmit: () => void; type?: string; accent: string;
}) {
  return (
    <div>
      <input
        type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onSubmit()}
        autoFocus
        style={{
          width: "100%", padding: "14px 16px", borderRadius: 10,
          background: "rgba(255,255,255,0.08)",
          border: `1.5px solid ${accent}40`,
          color: "#FFFFFF", fontSize: 18, outline: "none",
          boxSizing: "border-box", marginBottom: 16,
        }}
      />
      <button onClick={onSubmit} style={{
        width: "100%", padding: 14, borderRadius: 10,
        background: value.trim() ? accent : `${accent}40`,
        color: "#FFFFFF", fontSize: 16, fontWeight: 700,
        border: "none", cursor: value.trim() ? "pointer" : "not-allowed",
      }}>Lanjut →</button>
    </div>
  );
}

function YNButtons({ onYes, onNo, accent }: { onYes: () => void; onNo: () => void; accent: string; }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <button onClick={onYes} style={{
        flex: 1, padding: 16, borderRadius: 12,
        background: "rgba(255,107,107,0.15)", border: "1.5px solid rgba(255,107,107,0.5)",
        color: "#FF6B6B", fontSize: 18, fontWeight: 700, cursor: "pointer",
      }}>Ya</button>
      <button onClick={onNo} style={{
        flex: 1, padding: 16, borderRadius: 12,
        background: "rgba(2,195,154,0.1)", border: `1.5px solid ${accent}40`,
        color: "#02C39A", fontSize: 18, fontWeight: 700, cursor: "pointer",
      }}>Tidak</button>
    </div>
  );
}

function ChoiceBtn({ label, sub, onClick, accent }: {
  label: string; sub?: string; onClick: () => void; accent: string;
}) {
  return (
    <button onClick={onClick} style={{
      width: "100%", padding: "14px 16px", borderRadius: 12,
      background: "rgba(255,255,255,0.05)", border: `1.5px solid ${accent}30`,
      color: "#FFFFFF", fontSize: 15, fontWeight: 600,
      cursor: "pointer", marginBottom: 10, textAlign: "left",
    }}>
      {label}
      {sub && <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </button>
  );
}

function Err({ msg }: { msg: string }) {
  return <p style={{ color: "#FF6B6B", fontSize: 13, marginTop: 8 }}>{msg}</p>;
}

function ResultScreen({ result, onNext, onHome }: {
  result: QueuedCase; onNext: () => void; onHome: () => void;
}) {
  const riskColor = result.riskLevel === "HIGH" ? "#FF6B6B"
    : result.riskLevel === "MEDIUM" ? "#FFD166" : "#02C39A";

  const riskLabel = result.riskLevel === "HIGH" ? "🔴 RISIKO TINGGI / DARURAT"
    : result.riskLevel === "MEDIUM" ? "🟡 PERLU PERHATIAN"
    : "🟢 KONDISI STABIL";

  return (
    <div style={{ padding: "24px 20px" }}>
      <div style={{
        background: `${riskColor}20`, border: `2px solid ${riskColor}`,
        borderRadius: 14, padding: "16px 20px", marginBottom: 20, textAlign: "center",
      }}>
        <div style={{ color: riskColor, fontSize: 17, fontWeight: 800 }}>{riskLabel}</div>
        {result.referNow && (
          <div style={{ color: "#FF6B6B", fontSize: 13, marginTop: 6 }}>
            Segera ke Puskesmas/RS
          </div>
        )}
      </div>

      <div style={{
        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(233,30,140,0.25)",
        borderRadius: 12, padding: 16, marginBottom: 20,
      }}>
        <pre style={{
          color: "#FFFFFF", fontSize: 13, lineHeight: 1.7,
          whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit",
        }}>
          {result.reportText}
        </pre>
      </div>

      <div style={{
        background: "rgba(255,209,102,0.1)", border: "1px solid #FFD166",
        borderRadius: 10, padding: 12, marginBottom: 20,
        fontSize: 13, color: "#FFD166",
      }}>
        ⏳ Tersimpan lokal — akan sinkron ke server saat ada sinyal
      </div>

      <button onClick={onNext} style={{
        width: "100%", padding: 14, borderRadius: 12,
        background: "#E91E8C", color: "#FFFFFF",
        fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", marginBottom: 10,
      }}>➕ Triase Ibu Berikutnya</button>

      <button onClick={onHome} style={{
        width: "100%", padding: 13, borderRadius: 12,
        background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)",
        fontSize: 14, fontWeight: 600,
        border: "1px solid rgba(2,195,154,0.25)", cursor: "pointer",
      }}>← Kembali ke Beranda</button>
    </div>
  );
}
