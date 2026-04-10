"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getIdentity } from "@/lib/auth";
import { runNeonatalTriage, type NeonatalInput } from "@/lib/neonatalEngine";
import { saveCase, getPendingCount, generateLocalId, type QueuedCase } from "@/lib/offlineStore";
import { syncPendingCases } from "@/lib/syncClient";

const C = {
  bg: "#0D1F1C", card: "rgba(255,255,255,0.05)",
  border: "rgba(255,152,0,0.25)", accent: "#FF9800",
  white: "#FFFFFF", dim: "rgba(255,255,255,0.5)",
  red: "#FF6B6B", yellow: "#FFD166", green: "#02C39A",
};

type Step =
  | "name" | "age_input" | "tidak_menyusu" | "demam_hipo"
  | "kejang" | "sesak" | "kuning" | "tali_pusat"
  | "diare" | "bblr" | "bab_bak" | "result";

const emptyInput: NeonatalInput = {
  age_days: null, tidak_menyusu: false, demam: false,
  hipotermi: false, kejang: false, sesak_napas: false,
  kuning: false, tali_pusat_infeksi: false, diare_muntah: false,
  bblr: false, tidak_bab_bak: false,
};

export default function NeonatalTriagePage() {
  const router = useRouter();
  const [identity, setIdentity] = useState<{ name: string; profileId: string; ngoId: string } | null>(null);
  const [step, setStep] = useState<Step>("name");
  const [babyName, setBabyName] = useState("");
  const [input, setInput] = useState<NeonatalInput>(emptyInput);
  const [textInput, setTextInput] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<QueuedCase | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const id = getIdentity();
    if (!id) { router.replace("/"); return; }
    setIdentity(id);
    setIsOnline(navigator.onLine);
    window.addEventListener("online", () => setIsOnline(true));
    window.addEventListener("offline", () => setIsOnline(false));
  }, [router]);

  function yn(field: keyof NeonatalInput, value: boolean, nextStep: Step) {
    setInput(prev => ({ ...prev, [field]: value }));
    setError(""); setStep(nextStep);
  }

  async function finish(finalInput: NeonatalInput) {
    if (!identity) return;
    const engineResult = runNeonatalTriage(finalInput, babyName, identity.name);
    const queued: QueuedCase = {
      localId: generateLocalId(),
      profileId: identity.profileId,
      ngoId: identity.ngoId,
      moduleType: 'neonatal',
      patientName: babyName,
      ageMonths: finalInput.age_days !== null && finalInput.age_days <= 28 ? 0 : null,
      ageDays: finalInput.age_days,
      gender: 'unknown',
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

    // Attempt immediate sync if online
    if (navigator.onLine) {
      syncPendingCases().then(({ synced: s }) => {
        if (s > 0) getPendingCount().then(setPendingCount);
      });
    }
  }

  function reset() {
    setStep("name"); setBabyName(""); setInput(emptyInput);
    setTextInput(""); setError(""); setResult(null);
  }

  if (!identity) return null;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>

      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
        background: "rgba(0,0,0,0.2)",
      }}>
        <button onClick={() => router.push("/triage")} style={{ background: "none", border: "none", color: C.dim, fontSize: 22, cursor: "pointer", padding: 0 }}>←</button>
        <div>
          <div style={{ color: C.accent, fontWeight: 800, fontSize: 15 }}>🍼 Bayi Baru Lahir</div>
          <div style={{ color: C.dim, fontSize: 12 }}>Triase neonatal 0–28 hari — KMS Permenkes 2/2020</div>
        </div>
      </div>

      {!isOnline && (
        <div style={{ background: "rgba(255,209,102,0.15)", borderBottom: `1px solid ${C.yellow}`, padding: "8px 20px", color: C.yellow, fontSize: 13, textAlign: "center" }}>
          📵 Mode offline — triage tetap berjalan
        </div>
      )}

      <div style={{ flex: 1, maxWidth: 480, width: "100%", margin: "0 auto" }}>

        {step === "name" && (
          <QCard title="Nama bayi?" hint="Ketik nama bayi, atau 'Bayi Ny. [nama ibu]' jika belum ada nama" accent={C.accent}>
            <TInput placeholder="Contoh: Bayi Ny. Sari" value={textInput} onChange={setTextInput} accent={C.accent}
              onSubmit={() => {
                if (!textInput.trim()) { setError("Masukkan nama bayi."); return; }
                setBabyName(textInput.trim()); setTextInput(""); setError(""); setStep("age_input");
              }} />
            {error && <Err msg={error} />}
          </QCard>
        )}

        {step === "age_input" && (
          <QCard title="Usia bayi (hari)?" hint="Usia dalam hari sejak lahir. Contoh: 3 untuk bayi 3 hari" accent={C.accent}>
            <TInput placeholder="Contoh: 3" value={textInput} onChange={setTextInput} type="number" accent={C.accent}
              onSubmit={() => {
                const val = parseInt(textInput.trim());
                const days = isNaN(val) || val < 0 ? 0 : Math.min(val, 28);
                setInput(prev => ({ ...prev, age_days: days }));
                setTextInput(""); setStep("tidak_menyusu");
              }} />
          </QCard>
        )}

        {step === "tidak_menyusu" && (
          <QCard title="Bayi tidak mau menyusu atau sangat lemah saat menyusu?" hint="Ini tanda bahaya serius pada bayi baru lahir" accent={C.accent}>
            <YNButtons
              onYes={() => { const u = { ...input, tidak_menyusu: true }; setInput(u); finish(u); }}
              onNo={() => yn("tidak_menyusu", false, "demam_hipo")}
              accent={C.accent}
            />
          </QCard>
        )}

        {step === "demam_hipo" && (
          <QCard title="Bayi demam (>37.5°C) ATAU badan terasa dingin?" hint="Suhu normal bayi: 36.5–37.5°C" accent={C.accent}>
            <ChoiceBtn label="🌡️ Demam — badan panas (>37.5°C)" onClick={() => { const u = { ...input, demam: true, hipotermi: false }; setInput(u); setStep("kejang"); }} accent={C.accent} />
            <ChoiceBtn label="🥶 Dingin — badan terasa sangat dingin" onClick={() => { const u = { ...input, hipotermi: true, demam: false }; setInput(u); finish(u); }} accent={C.accent} />
            <ChoiceBtn label="✅ Normal — suhu tubuh normal" onClick={() => yn("demam", false, "kejang")} accent={C.accent} />
          </QCard>
        )}

        {step === "kejang" && (
          <QCard title="Bayi mengalami kejang?" accent={C.accent}>
            <YNButtons
              onYes={() => { const u = { ...input, kejang: true }; setInput(u); finish(u); }}
              onNo={() => yn("kejang", false, "sesak")}
              accent={C.accent}
            />
          </QCard>
        )}

        {step === "sesak" && (
          <QCard title="Bayi sesak napas atau napas sangat cepat?" hint="Normal: 40–60 kali per menit. Sesak jika >60x/menit atau ada tarikan dada" accent={C.accent}>
            <YNButtons
              onYes={() => { const u = { ...input, sesak_napas: true }; setInput(u); finish(u); }}
              onNo={() => yn("sesak_napas", false, "kuning")}
              accent={C.accent}
            />
          </QCard>
        )}

        {step === "kuning" && (
          <QCard
            title="Bayi tampak kuning (ikterus)?"
            hint={`Usia ${input.age_days ?? 0} hari — kuning di wajah, dada, atau telapak tangan/kaki`}
            accent={C.accent}
          >
            <YNButtons
              onYes={() => yn("kuning", true, "tali_pusat")}
              onNo={() => yn("kuning", false, "tali_pusat")}
              accent={C.accent}
            />
          </QCard>
        )}

        {step === "tali_pusat" && (
          <QCard title="Tali pusat merah, berbau, atau bernanah?" accent={C.accent}>
            <YNButtons
              onYes={() => yn("tali_pusat_infeksi", true, "diare")}
              onNo={() => yn("tali_pusat_infeksi", false, "diare")}
              accent={C.accent}
            />
          </QCard>
        )}

        {step === "diare" && (
          <QCard title="Bayi diare atau muntah berulang?" accent={C.accent}>
            <YNButtons
              onYes={() => yn("diare_muntah", true, "bblr")}
              onNo={() => yn("diare_muntah", false, "bblr")}
              accent={C.accent}
            />
          </QCard>
        )}

        {step === "bblr" && (
          <QCard title="Bayi sangat kecil atau prematur (lahir sebelum 37 minggu)?" hint="Berat lahir <2500 gram atau terlihat sangat kecil" accent={C.accent}>
            <YNButtons
              onYes={() => yn("bblr", true, "bab_bak")}
              onNo={() => yn("bblr", false, "bab_bak")}
              accent={C.accent}
            />
          </QCard>
        )}

        {step === "bab_bak" && (
          <QCard
            title={`Bayi belum BAB dalam 24 jam pertama atau belum BAK dalam 12 jam?`}
            hint="Berlaku untuk bayi usia 0-3 hari"
            accent={C.accent}
          >
            <YNButtons
              onYes={() => { const u = { ...input, tidak_bab_bak: true }; setInput(u); finish(u); }}
              onNo={() => { const u = { ...input, tidak_bab_bak: false }; setInput(u); finish(u); }}
              accent={C.accent}
            />
          </QCard>
        )}

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
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 8 }}>Triase Bayi Baru Lahir</p>
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

function ChoiceBtn({ label, sub, onClick, accent }: { label: string; sub?: string; onClick: () => void; accent: string; }) {
  return (
    <button onClick={onClick} style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: `1.5px solid ${accent}30`, color: "#FFFFFF", fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 10, textAlign: "left" }}>
      {label}
      {sub && <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </button>
  );
}

function Err({ msg }: { msg: string }) { return <p style={{ color: "#FF6B6B", fontSize: 13, marginTop: 8 }}>{msg}</p>; }

function ResultScreen({ result, accent, onNext, onHome }: { result: QueuedCase; accent: string; onNext: () => void; onHome: () => void; }) {
  const rc = result.riskLevel === "HIGH" ? "#FF6B6B" : result.riskLevel === "MEDIUM" ? "#FFD166" : "#02C39A";
  const rl = result.riskLevel === "HIGH" ? "🔴 RISIKO TINGGI / DARURAT" : result.riskLevel === "MEDIUM" ? "🟡 PERLU PERHATIAN" : "🟢 BAYI SEHAT";
  return (
    <div style={{ padding: "24px 20px" }}>
      <div style={{ background: `${rc}20`, border: `2px solid ${rc}`, borderRadius: 14, padding: "16px 20px", marginBottom: 20, textAlign: "center" }}>
        <div style={{ color: rc, fontSize: 17, fontWeight: 800 }}>{rl}</div>
        {result.referNow && <div style={{ color: "#FF6B6B", fontSize: 13, marginTop: 6 }}>Segera ke Puskesmas/RS</div>}
      </div>
      <div style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${accent}30`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <pre style={{ color: "#FFFFFF", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{result.reportText}</pre>
      </div>
      <div style={{ background: "rgba(255,209,102,0.1)", border: "1px solid #FFD166", borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 13, color: "#FFD166" }}>
        ⏳ Tersimpan lokal — akan sinkron ke server saat ada sinyal
      </div>
      <button onClick={onNext} style={{ width: "100%", padding: 14, borderRadius: 12, background: accent, color: "#FFFFFF", fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", marginBottom: 10 }}>➕ Triase Bayi Berikutnya</button>
      <button onClick={onHome} style={{ width: "100%", padding: 13, borderRadius: 12, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: 600, border: "1px solid rgba(2,195,154,0.25)", cursor: "pointer" }}>← Kembali ke Beranda</button>
    </div>
  );
}
