"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getIdentity } from "@/lib/auth";
import { runPostpartumTriage, type PostpartumInput } from "@/lib/postpartumEngine";
import { saveCase, getPendingCount, generateLocalId, type QueuedCase } from "@/lib/offlineStore";
import { syncPendingCases } from "@/lib/syncClient";
import BeneficiarySearch, { type BeneficiaryProfile } from "@/components/BeneficiarySearch";

const C = {
  bg: "#0D1F1C", card: "rgba(255,255,255,0.05)",
  border: "rgba(156,39,176,0.25)", accent: "#9C27B0",
  white: "#FFFFFF", dim: "rgba(255,255,255,0.5)",
  dimmer: "rgba(255,255,255,0.25)", red: "#FF6B6B",
  yellow: "#FFD166", green: "#02C39A",
};

type Step =
  | "home" | "search" | "name" | "days_pp" | "perdarahan" | "demam"
  | "cairan_berbau" | "nyeri_ulu_hati" | "payudara"
  | "depresi" | "asi"
  | "ispa_batuk" | "ispa_sesak" | "ispa_mata" | "ispa_paparan"
  | "result";

const emptyInput: PostpartumInput = {
  days_postpartum: null, perdarahan: false, demam: false,
  cairan_berbau: false, nyeri_ulu_hati: false,
  payudara_bengkak: false, depresi: false, asi_masalah: false,
  ispa_batuk: 'tidak', ispa_sesak: false, ispa_mata: false,
  ispa_paparan: false, ispa_durasi: null,
};

export default function PostpartumTriagePage() {
  const router = useRouter();
  const [identity, setIdentity] = useState<{ name: string; profileId: string; ngoId: string } | null>(null);
  const [step, setStep] = useState<Step>("home");
  const [patientName, setPatientName] = useState("");
  const [input, setInput] = useState<PostpartumInput>(emptyInput);
  const [textInput, setTextInput] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<QueuedCase | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [isReturning, setIsReturning] = useState(false);
  const [isWalkIn, setIsWalkIn] = useState(false);

  useEffect(() => {
    const id = getIdentity();
    if (!id) { router.replace("/"); return; }
    setIdentity(id);
    setIsOnline(navigator.onLine);
    window.addEventListener("online", () => setIsOnline(true));
    window.addEventListener("offline", () => setIsOnline(false));
  }, [router]);

  // ── Start flows ────────────────────────────────────────────────────────────

  function goToSearch() {
    setPatientName(""); setInput(emptyInput);
    setTextInput(""); setError(""); setResult(null);
    setIsReturning(false); setIsWalkIn(false);
    setStep("search");
  }

  function handleSelectBeneficiary(profile: BeneficiaryProfile) {
    setPatientName(profile.patientName);
    setIsReturning(true); setIsWalkIn(false);
    setTextInput(""); setError("");
    setStep("days_pp"); // always need fresh days postpartum
  }

  function handleNewFull() {
    setPatientName(""); setInput(emptyInput);
    setIsReturning(false); setIsWalkIn(false);
    setTextInput(""); setError("");
    setStep("name");
  }

  function handleWalkIn() {
    setPatientName(""); setInput(emptyInput);
    setIsReturning(false); setIsWalkIn(true);
    setTextInput(""); setError("");
    setStep("name");
  }

  function yesNo(field: keyof PostpartumInput, value: boolean, nextStep: Step) {
    setInput(prev => ({ ...prev, [field]: value }));
    setError(""); setStep(nextStep);
  }

  async function finish(finalInput: PostpartumInput) {
    if (!identity) return;
    const engineResult = runPostpartumTriage(finalInput, patientName, identity.name);
    const queued: QueuedCase = {
      localId: generateLocalId(),
      profileId: identity.profileId,
      ngoId: identity.ngoId,
      moduleType: 'postpartum',
      patientName,
      ageMonths: null,
      ageDays: finalInput.days_postpartum,
      gender: 'female',
      payload: { ...finalInput },
      riskLevel: engineResult.riskLevel,
      reportText: engineResult.reportText,
      referNow: engineResult.referNow,
      followUpDays: engineResult.followUpDays,
      profileIncomplete: isWalkIn,
      createdAt: new Date().toISOString(),
      syncStatus: 'pending',
    };
    await saveCase(queued);
    setResult(queued);
    setStep("result");

    if (navigator.onLine) {
      syncPendingCases().then(({ synced: s }) => {
        if (s > 0) getPendingCount().then(setPendingCount);
      });
    }
  }

  function reset() {
    setStep("home"); setPatientName(""); setInput(emptyInput);
    setTextInput(""); setError(""); setResult(null);
    setIsReturning(false); setIsWalkIn(false);
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
          <div style={{ color: C.accent, fontWeight: 800, fontSize: 15 }}>🌸 Ibu Nifas</div>
          <div style={{ color: C.dim, fontSize: 12 }}>Triase pasca melahirkan — KMS Permenkes 2/2020</div>
        </div>
      </div>

      {!isOnline && (
        <div style={{ background: "rgba(255,209,102,0.15)", borderBottom: `1px solid ${C.yellow}`, padding: "8px 20px", color: C.yellow, fontSize: 13, textAlign: "center" }}>
          📵 Mode offline — triage tetap berjalan
        </div>
      )}

      <div style={{ flex: 1, maxWidth: 480, width: "100%", margin: "0 auto" }}>

        {/* ── HOME ── */}
        {step === "home" && (
          <div style={{ padding: "40px 20px" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🌸</div>
              <h1 style={{ color: C.accent, fontSize: 22, fontWeight: 800, margin: 0 }}>Ibu Nifas</h1>
              <p style={{ color: C.dim, fontSize: 14, marginTop: 8 }}>Triase pasca melahirkan — 0 sampai 42 hari</p>
            </div>
            <button onClick={goToSearch} style={{
              width: "100%", padding: 18, borderRadius: 14,
              background: C.accent, color: C.white,
              fontSize: 18, fontWeight: 800, border: "none", cursor: "pointer",
            }}>
              ➕ Mulai Triase Ibu Nifas
            </button>
          </div>
        )}

        {/* ── SEARCH ── */}
        {step === "search" && (
          <BeneficiarySearch
            moduleType="postpartum"
            moduleEmoji="🌸"
            moduleTitle="Ibu Nifas"
            facilityId={identity?.facilityId}
            onSelect={handleSelectBeneficiary}
            onNew={handleNewFull}
            onWalkIn={handleWalkIn}
          />
        )}

        {/* Returning banner */}
        {isReturning && showBanner && (
          <div style={{
            margin: "12px 20px 0", padding: "10px 14px", borderRadius: 10,
            background: "rgba(156,39,176,0.08)", border: `1px solid rgba(156,39,176,0.3)`,
            color: C.accent, fontSize: 13,
          }}>
            ✓ Data {patientName} dimuat — masukkan data kunjungan ini
          </div>
        )}

        {/* Walk-in banner */}
        {isWalkIn && showBanner && (
          <div style={{
            margin: "12px 20px 0", padding: "10px 14px", borderRadius: 10,
            background: "rgba(255,209,102,0.08)", border: `1px solid rgba(255,209,102,0.3)`,
            color: C.yellow, fontSize: 13,
          }}>
            ⚡ Triage cepat — lengkapi data lengkap setelah sesi selesai
          </div>
        )}

        {/* ── NAME ── */}
        {step === "name" && (
          <QCard title="Nama ibu?" accent={C.accent}>
            <TInput placeholder="Contoh: Sari Dewi" value={textInput} onChange={setTextInput} accent={C.accent}
              onSubmit={() => {
                if (!textInput.trim()) { setError("Masukkan nama ibu."); return; }
                setPatientName(textInput.trim()); setTextInput(""); setError(""); setStep("days_pp");
              }} />
            {error && <Err msg={error} />}
          </QCard>
        )}

        {/* ── DAYS PP ── */}
        {step === "days_pp" && (
          <QCard title="Hari ke berapa setelah melahirkan?" hint="Ketik angka hari. Contoh: 3 (untuk hari ke-3)" accent={C.accent}>
            <TInput placeholder="Contoh: 7" value={textInput} onChange={setTextInput} type="number" accent={C.accent}
              onSubmit={() => {
                const val = parseInt(textInput.trim());
                const days = isNaN(val) || val < 0 ? null : Math.min(val, 42);
                setInput(prev => ({ ...prev, days_postpartum: days }));
                setTextInput(""); setStep("perdarahan");
              }} />
          </QCard>
        )}

        {/* ── PERDARAHAN ── */}
        {step === "perdarahan" && (
          <QCard title="Ada perdarahan lewat jalan lahir?" hint="Perdarahan lebih banyak dari biasa atau berbau" accent={C.accent}>
            <YNButtons onYes={() => { const u = { ...input, perdarahan: true }; setInput(u); finish(u); }} onNo={() => yesNo("perdarahan", false, "demam")} accent={C.accent} />
          </QCard>
        )}

        {/* ── DEMAM ── */}
        {step === "demam" && (
          <QCard title="Demam lebih dari 2 hari?" accent={C.accent}>
            <YNButtons onYes={() => yesNo("demam", true, "cairan_berbau")} onNo={() => yesNo("demam", false, "cairan_berbau")} accent={C.accent} />
          </QCard>
        )}

        {/* ── CAIRAN BERBAU ── */}
        {step === "cairan_berbau" && (
          <QCard title="Keluar cairan berbau dari jalan lahir?" accent={C.accent}>
            <YNButtons onYes={() => yesNo("cairan_berbau", true, "nyeri_ulu_hati")} onNo={() => yesNo("cairan_berbau", false, "nyeri_ulu_hati")} accent={C.accent} />
          </QCard>
        )}

        {/* ── NYERI ULU HATI ── */}
        {step === "nyeri_ulu_hati" && (
          <QCard title="Nyeri ulu hati, sakit kepala berat, pandangan kabur, bengkak, atau kejang?" hint="Tanda preeklampsia pasca melahirkan" accent={C.accent}>
            <YNButtons onYes={() => { const u = { ...input, nyeri_ulu_hati: true }; setInput(u); finish(u); }} onNo={() => yesNo("nyeri_ulu_hati", false, "payudara")} accent={C.accent} />
          </QCard>
        )}

        {/* ── PAYUDARA ── */}
        {step === "payudara" && (
          <QCard title="Payudara bengkak, merah, dan terasa sakit?" hint="Tanda mastitis atau sumbatan ASI" accent={C.accent}>
            <YNButtons onYes={() => yesNo("payudara_bengkak", true, "depresi")} onNo={() => yesNo("payudara_bengkak", false, "depresi")} accent={C.accent} />
          </QCard>
        )}

        {/* ── DEPRESI ── */}
        {step === "depresi" && (
          <QCard title="Ibu tampak sangat sedih, murung, atau menangis tanpa sebab?" hint="Berlangsung lebih dari beberapa hari" accent={C.accent}>
            <YNButtons onYes={() => yesNo("depresi", true, "asi")} onNo={() => yesNo("depresi", false, "asi")} accent={C.accent} />
          </QCard>
        )}

        {/* ── ASI ── */}
        {step === "asi" && (
          <QCard title="Ada kesulitan menyusui?" hint="Bayi tidak mau menyusu, ASI tidak keluar, atau ibu kesakitan saat menyusui" accent={C.accent}>
            <YNButtons
              onYes={() => { setInput(prev => ({ ...prev, asi_masalah: true })); setStep("ispa_batuk"); }}
              onNo={() => { setInput(prev => ({ ...prev, asi_masalah: false })); setStep("ispa_batuk"); }}
              accent={C.accent}
            />
          </QCard>
        )}

        {/* ── ISPA ── */}
        {step === "ispa_batuk" && (
          <QCard title="Apakah ibu batuk?" hint="Batuk kering atau batuk berdahak?" accent={C.accent}>
            <YNButtons onYes={() => { setInput(prev => ({ ...prev, ispa_batuk: 'kering' as const })); setStep("ispa_sesak"); }} onNo={() => { setInput(prev => ({ ...prev, ispa_batuk: 'tidak' as const })); setStep("ispa_sesak"); }} accent={C.accent} />
          </QCard>
        )}

        {step === "ispa_sesak" && (
          <QCard title="Apakah sesak napas?" hint="Napas terasa berat, sulit bernapas dalam" accent={C.accent}>
            <YNButtons onYes={() => { setInput(prev => ({ ...prev, ispa_sesak: true })); setStep("ispa_mata"); }} onNo={() => { setInput(prev => ({ ...prev, ispa_sesak: false })); setStep("ispa_mata"); }} accent={C.accent} />
          </QCard>
        )}

        {step === "ispa_mata" && (
          <QCard title="Apakah mata perih atau berair?" accent={C.accent}>
            <YNButtons onYes={() => { setInput(prev => ({ ...prev, ispa_mata: true })); setStep("ispa_paparan"); }} onNo={() => { setInput(prev => ({ ...prev, ispa_mata: false })); setStep("ispa_paparan"); }} accent={C.accent} />
          </QCard>
        )}

        {step === "ispa_paparan" && (
          <QCard title="Apakah ibu tinggal dekat gunung berapi aktif atau area kebakaran hutan?" hint="Terpapar asap tebal, abu vulkanik, atau debu" accent={C.accent}>
            <YNButtons
              onYes={() => { const u = { ...input, ispa_paparan: true }; setInput(u); finish(u); }}
              onNo={() => { const u = { ...input, ispa_paparan: false }; setInput(u); finish(u); }}
              accent={C.accent}
            />
          </QCard>
        )}

        {/* ── RESULT ── */}
        {step === "result" && result && (
          <ResultScreen result={result} accent={C.accent} onNext={reset} onHome={() => router.push("/triage")} />
        )}

      </div>
    </div>
  );
}

function QCard({ title, hint, children, accent }: { title: string; hint?: string; children: React.ReactNode; accent: string; }) {
  return (
    <div style={{ padding: "32px 20px" }}>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 8 }}>Triase Ibu Nifas</p>
      <h2 style={{ color: "#FFFFFF", fontSize: 20, fontWeight: 700, marginBottom: hint ? 8 : 24, lineHeight: 1.4 }}>{title}</h2>
      {hint && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 24 }}>{hint}</p>}
      {children}
    </div>
  );
}

function TInput({ placeholder, value, onChange, onSubmit, type = "text", accent }: { placeholder: string; value: string; onChange: (v: string) => void; onSubmit: () => void; type?: string; accent: string; }) {
  return (
    <div>
      <input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => e.key === "Enter" && onSubmit()} autoFocus
        style={{ width: "100%", padding: "14px 16px", borderRadius: 10, background: "rgba(255,255,255,0.08)", border: `1.5px solid ${accent}40`, color: "#FFFFFF", fontSize: 18, outline: "none", boxSizing: "border-box", marginBottom: 16 }} />
      <button onClick={onSubmit} style={{ width: "100%", padding: 14, borderRadius: 10, background: value.trim() ? accent : `${accent}40`, color: "#FFFFFF", fontSize: 16, fontWeight: 700, border: "none", cursor: value.trim() ? "pointer" : "not-allowed" }}>Lanjut →</button>
    </div>
  );
}

function YNButtons({ onYes, onNo, accent }: { onYes: () => void; onNo: () => void; accent: string; }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <button onClick={onYes} style={{ flex: 1, padding: 16, borderRadius: 12, background: "rgba(255,107,107,0.15)", border: "1.5px solid rgba(255,107,107,0.5)", color: "#FF6B6B", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>Ya</button>
      <button onClick={onNo} style={{ flex: 1, padding: 16, borderRadius: 12, background: "rgba(2,195,154,0.1)", border: `1.5px solid ${accent}40`, color: "#02C39A", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>Tidak</button>
    </div>
  );
}

function Err({ msg }: { msg: string }) { return <p style={{ color: "#FF6B6B", fontSize: 13, marginTop: 8 }}>{msg}</p>; }

function ResultScreen({ result, accent, onNext, onHome }: { result: QueuedCase; accent: string; onNext: () => void; onHome: () => void; }) {
  const rc = result.riskLevel === "HIGH" ? "#FF6B6B" : result.riskLevel === "MEDIUM" ? "#FFD166" : "#02C39A";
  const rl = result.riskLevel === "HIGH" ? "🔴 RISIKO TINGGI / DARURAT" : result.riskLevel === "MEDIUM" ? "🟡 PERLU PERHATIAN" : "🟢 KONDISI STABIL";
  return (
    <div style={{ padding: "24px 20px" }}>
      <div style={{ background: `${rc}20`, border: `2px solid ${rc}`, borderRadius: 14, padding: "16px 20px", marginBottom: 20, textAlign: "center" }}>
        <div style={{ color: rc, fontSize: 17, fontWeight: 800 }}>{rl}</div>
        {result.referNow && <div style={{ color: "#FF6B6B", fontSize: 13, marginTop: 6 }}>Segera ke Puskesmas/RS</div>}
      </div>

      {result.profileIncomplete && (
        <div style={{ background: "rgba(255,209,102,0.1)", border: `1px solid #FFD166`, borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: "#FFD166" }}>
          ⚠️ <strong>Profil belum lengkap</strong> — mohon lengkapi data {result.patientName} setelah sesi selesai
        </div>
      )}

      <div style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${accent}30`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <pre style={{ color: "#FFFFFF", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{result.reportText}</pre>
      </div>
      <div style={{ background: "rgba(255,209,102,0.1)", border: "1px solid #FFD166", borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 13, color: "#FFD166" }}>
        ⏳ Tersimpan lokal — akan sinkron ke server saat ada sinyal
      </div>
      <button onClick={onNext} style={{ width: "100%", padding: 14, borderRadius: 12, background: accent, color: "#FFFFFF", fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", marginBottom: 10 }}>➕ Triase Ibu Berikutnya</button>
      <button onClick={onHome} style={{ width: "100%", padding: 13, borderRadius: 12, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: 600, border: "1px solid rgba(2,195,154,0.25)", cursor: "pointer" }}>← Kembali ke Beranda</button>
    </div>
  );
}
