"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getIdentity, clearIdentity } from "@/lib/auth";
import { runGrowthTriage } from "@/lib/offlineEngine";
import {
  saveCase,
  getAllCases,
  getPendingCount,
  generateLocalId,
  type QueuedCase,
} from "@/lib/offlineStore";

// ── Types ─────────────────────────────────────────────────────────────────────
type Step =
  | "home"
  | "child_name"
  | "age"
  | "gender"
  | "weight"
  | "height"
  | "muac"
  | "feeding"
  | "milestone"
  | "result"
  | "history";

interface TriageState {
  childName: string;
  ageMonths: number | null;
  gender: "male" | "female" | null;
  weightKg: number | null;
  heightCm: number | null;
  muacCm: number | null;
  feedingFreq: "1" | "2" | "3" | null;
  milestoneScore: "1" | "2" | "3" | null;
}

const emptyState: TriageState = {
  childName: "",
  ageMonths: null,
  gender: null,
  weightKg: null,
  heightCm: null,
  muacCm: null,
  feedingFreq: null,
  milestoneScore: null,
};

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#0D1F1C",
  card: "rgba(255,255,255,0.05)",
  border: "rgba(2,195,154,0.25)",
  teal: "#02C39A",
  tealDark: "#017367",
  white: "#FFFFFF",
  dim: "rgba(255,255,255,0.5)",
  dimmer: "rgba(255,255,255,0.25)",
  red: "#FF6B6B",
  yellow: "#FFD166",
  green: "#02C39A",
};

// ── Reusable components ───────────────────────────────────────────────────────
function Header({ name, onLogout, pendingCount }: {
  name: string;
  onLogout: () => void;
  pendingCount: number;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px 20px",
      borderBottom: `1px solid ${C.border}`,
      background: "rgba(0,0,0,0.2)",
    }}>
      <div>
        <div style={{ color: C.teal, fontWeight: 800, fontSize: 16 }}>SahAIbat Kader</div>
        <div style={{ color: C.dim, fontSize: 12 }}>{name}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {pendingCount > 0 && (
          <div style={{
            background: C.yellow, color: "#000", borderRadius: 12,
            padding: "2px 10px", fontSize: 12, fontWeight: 700,
          }}>
            {pendingCount} belum sinkron
          </div>
        )}
        <button onClick={onLogout} style={{
          background: "none", border: `1px solid ${C.border}`,
          color: C.dim, borderRadius: 8, padding: "6px 12px",
          fontSize: 12, cursor: "pointer",
        }}>
          Keluar
        </button>
      </div>
    </div>
  );
}

function QuestionCard({ question, hint, children }: {
  question: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ padding: "32px 20px" }}>
      <p style={{ color: C.dim, fontSize: 13, marginBottom: 8 }}>Posyandu Triage</p>
      <h2 style={{ color: C.white, fontSize: 22, fontWeight: 700, marginBottom: hint ? 8 : 24, lineHeight: 1.4 }}>
        {question}
      </h2>
      {hint && <p style={{ color: C.dim, fontSize: 14, marginBottom: 24 }}>{hint}</p>}
      {children}
    </div>
  );
}

function TextInput({ placeholder, value, onChange, onSubmit, type = "text" }: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  type?: string;
}) {
  return (
    <div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        autoFocus
        style={{
          width: "100%", padding: "14px 16px", borderRadius: 10,
          background: "rgba(255,255,255,0.08)",
          border: `1.5px solid ${C.border}`,
          color: C.white, fontSize: 18, outline: "none",
          boxSizing: "border-box", marginBottom: 16,
        }}
      />
      <button onClick={onSubmit} style={{
        width: "100%", padding: 14, borderRadius: 10,
        background: value.trim() ? C.teal : "rgba(2,195,154,0.3)",
        color: C.white, fontSize: 16, fontWeight: 700,
        border: "none", cursor: value.trim() ? "pointer" : "not-allowed",
      }}>
        Lanjut →
      </button>
    </div>
  );
}

function ChoiceButton({ label, sub, onClick }: {
  label: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      width: "100%", padding: "16px 20px", borderRadius: 12,
      background: C.card, border: `1.5px solid ${C.border}`,
      color: C.white, fontSize: 16, fontWeight: 600,
      cursor: "pointer", marginBottom: 12, textAlign: "left",
    }}>
      {label}
      {sub && <div style={{ color: C.dim, fontSize: 13, fontWeight: 400, marginTop: 2 }}>{sub}</div>}
    </button>
  );
}

// ── Risk colours ──────────────────────────────────────────────────────────────
function riskColor(level: string) {
  if (level === "HIGH") return C.red;
  if (level === "MEDIUM") return C.yellow;
  return C.green;
}

function riskLabel(level: string) {
  if (level === "HIGH") return "🔴 RISIKO TINGGI — Rujuk Sekarang";
  if (level === "MEDIUM") return "🟡 PERLU PERHATIAN";
  return "🟢 TUMBUH KEMBANG BAIK";
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TriagePage() {
  const router = useRouter();
  const [identity, setIdentity] = useState<{ name: string; profileId: string; ngoId: string } | null>(null);
  const [step, setStep] = useState<Step>("home");
  const [triage, setTriage] = useState<TriageState>(emptyState);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<QueuedCase | null>(null);
  const [history, setHistory] = useState<QueuedCase[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const id = getIdentity();
    if (!id) { router.replace("/"); return; }
    setIdentity(id);
    setIsOnline(navigator.onLine);
    window.addEventListener("online", () => {
      setIsOnline(true);
      // Auto-sync when connection returns
      import("@/lib/syncClient").then(({ syncPendingCases }) => {
        syncPendingCases().then(({ synced }) => {
          if (synced > 0) getPendingCount().then(setPendingCount);
        });
      });
    });
    window.addEventListener("offline", () => setIsOnline(false));
    getPendingCount().then(setPendingCount);
  }, [router]);

  function handleLogout() {
    clearIdentity();
    router.replace("/");
  }

  function startTriage() {
    setTriage(emptyState);
    setInput("");
    setError("");
    setStep("child_name");
  }

  async function showHistory() {
    const cases = await getAllCases();
    setHistory(cases);
    setStep("history");
  }

  function next(updates: Partial<TriageState>, nextStep: Step) {
    setTriage(prev => ({ ...prev, ...updates }));
    setInput("");
    setError("");
    setStep(nextStep);
  }

  // ── Step handlers ────────────────────────────────────────────────────────
  function submitName() {
    if (!input.trim()) { setError("Masukkan nama anak."); return; }
    next({ childName: input.trim() }, "age");
  }

  function submitAge() {
    const val = parseInt(input.trim());
    if (isNaN(val) || val < 0 || val > 60) {
      setError("Masukkan usia dalam bulan (0–60).");
      return;
    }
    next({ ageMonths: val }, "gender");
  }

  function submitWeight() {
    const raw = input.trim().replace(",", ".");
    const val = parseFloat(raw);
    if (isNaN(val) || val < 1 || val > 30) {
      setError("Masukkan berat badan yang valid (kg). Contoh: 8.5");
      return;
    }
    next({ weightKg: val }, "height");
  }

  function submitHeight() {
    const raw = input.trim().replace(",", ".");
    const val = parseFloat(raw);
    if (isNaN(val) || val < 40 || val > 130) {
      setError("Masukkan tinggi badan yang valid (cm). Contoh: 72.5");
      return;
    }
    next({ heightCm: val }, "muac");
  }

  function submitMUAC() {
    if (input.trim().toLowerCase() === "skip" || input.trim() === "") {
      next({ muacCm: null }, "feeding");
      return;
    }
    const raw = input.trim().replace(",", ".");
    const val = parseFloat(raw);
    if (isNaN(val) || val < 6 || val > 25) {
      setError("Masukkan LILA yang valid (cm) atau ketik SKIP.");
      return;
    }
    next({ muacCm: val }, "feeding");
  }

  async function finishTriage(milestoneScore: "1" | "2" | "3") {
    const t = { ...triage, milestoneScore };
    if (!t.ageMonths || !t.gender || !t.weightKg || !t.heightCm || !t.feedingFreq) return;

    const engineResult = runGrowthTriage({
      weightKg: t.weightKg,
      heightCm: t.heightCm,
      muacCm: t.muacCm,
      ageMonths: t.ageMonths,
      gender: t.gender,
      feedingFreq: t.feedingFreq,
      milestoneScore,
      childName: t.childName,
      chwName: identity?.name,
    });

    const queued: QueuedCase = {
      localId: generateLocalId(),
      profileId: identity?.profileId ?? "",
      ngoId: identity?.ngoId ?? "",
      childName: t.childName,
      ageMonths: t.ageMonths,
      gender: t.gender,
      weightKg: t.weightKg,
      heightCm: t.heightCm,
      muacCm: t.muacCm,
      feedingFreq: t.feedingFreq,
      milestoneScore,
      riskLevel: engineResult.riskLevel,
      reportText: engineResult.reportText,
      referNow: engineResult.referNow,
      followUpDays: engineResult.followUpDays,
      createdAt: new Date().toISOString(),
      syncStatus: "pending",
    };

    await saveCase(queued);
    setPendingCount(await getPendingCount());
    setResult(queued);
    setStep("result");
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (!identity) return null;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>
      <Header name={identity.name} onLogout={handleLogout} pendingCount={pendingCount} />

      {/* Online/offline indicator */}
      {!isOnline && (
        <div style={{
          background: "rgba(255,209,102,0.15)", borderBottom: `1px solid ${C.yellow}`,
          padding: "8px 20px", color: C.yellow, fontSize: 13, textAlign: "center",
        }}>
          📵 Mode offline — triage tetap berjalan, data tersimpan lokal
        </div>
      )}

      <div style={{ flex: 1, maxWidth: 480, width: "100%", margin: "0 auto" }}>

        {/* ── HOME ── */}
        {step === "home" && (
          <div style={{ padding: "40px 20px" }}>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🌿</div>
              <h1 style={{ color: C.teal, fontSize: 24, fontWeight: 800, margin: 0 }}>
                Selamat datang
              </h1>
              <p style={{ color: C.dim, fontSize: 15, marginTop: 8 }}>
                {identity.name}
              </p>
            </div>

            <button onClick={startTriage} style={{
              width: "100%", padding: 18, borderRadius: 14,
              background: C.teal, color: C.white,
              fontSize: 18, fontWeight: 800, border: "none", cursor: "pointer",
              marginBottom: 16,
            }}>
              ➕ Mulai Triage Posyandu
            </button>

            <button onClick={showHistory} style={{
              width: "100%", padding: 16, borderRadius: 14,
              background: C.card, color: C.white,
              fontSize: 16, fontWeight: 600,
              border: `1.5px solid ${C.border}`, cursor: "pointer",
            }}>
              📋 Riwayat Kasus
            </button>

            {pendingCount > 0 && (
              <div style={{
                marginTop: 24, padding: 16, borderRadius: 12,
                background: "rgba(255,209,102,0.1)",
                border: `1px solid ${C.yellow}`,
              }}>
                <p style={{ color: C.yellow, fontSize: 14, margin: 0 }}>
                  ⏳ {pendingCount} kasus menunggu sinkronisasi ke server.
                  {isOnline ? " Sinkronisasi akan segera dilakukan." : " Akan sinkron saat ada sinyal."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── CHILD NAME ── */}
        {step === "child_name" && (
          <QuestionCard question="Nama anak?">
            <TextInput
              placeholder="Contoh: Ahmad Fauzi"
              value={input}
              onChange={setInput}
              onSubmit={submitName}
            />
            {error && <p style={{ color: C.red, fontSize: 13, marginTop: 8 }}>{error}</p>}
          </QuestionCard>
        )}

        {/* ── AGE ── */}
        {step === "age" && (
          <QuestionCard
            question="Usia anak (bulan)?"
            hint="Masukkan usia dalam bulan. Contoh: 18 untuk 1,5 tahun"
          >
            <TextInput
              placeholder="Contoh: 18"
              value={input}
              onChange={setInput}
              onSubmit={submitAge}
              type="number"
            />
            {error && <p style={{ color: C.red, fontSize: 13, marginTop: 8 }}>{error}</p>}
          </QuestionCard>
        )}

        {/* ── GENDER ── */}
        {step === "gender" && (
          <QuestionCard question="Jenis kelamin anak?">
            <ChoiceButton label="👦 Laki-laki" onClick={() => next({ gender: "male" }, "weight")} />
            <ChoiceButton label="👧 Perempuan" onClick={() => next({ gender: "female" }, "weight")} />
          </QuestionCard>
        )}

        {/* ── WEIGHT ── */}
        {step === "weight" && (
          <QuestionCard
            question="Berat badan anak (kg)?"
            hint="Timbang anak dan masukkan angka. Contoh: 8.5 atau 8,5"
          >
            <TextInput
              placeholder="Contoh: 8.5"
              value={input}
              onChange={setInput}
              onSubmit={submitWeight}
              type="decimal"
            />
            {error && <p style={{ color: C.red, fontSize: 13, marginTop: 8 }}>{error}</p>}
          </QuestionCard>
        )}

        {/* ── HEIGHT ── */}
        {step === "height" && (
          <QuestionCard
            question="Tinggi/panjang badan anak (cm)?"
            hint="Ukur tinggi badan dan masukkan angka. Contoh: 72.5"
          >
            <TextInput
              placeholder="Contoh: 72.5"
              value={input}
              onChange={setInput}
              onSubmit={submitHeight}
              type="decimal"
            />
            {error && <p style={{ color: C.red, fontSize: 13, marginTop: 8 }}>{error}</p>}
          </QuestionCard>
        )}

        {/* ── MUAC ── */}
        {step === "muac" && (
          <QuestionCard
            question="LILA anak (cm)?"
            hint="Lingkar Lengan Atas. Ketik SKIP jika tidak diukur."
          >
            <TextInput
              placeholder="Contoh: 13.5 atau SKIP"
              value={input}
              onChange={setInput}
              onSubmit={submitMUAC}
            />
            {error && <p style={{ color: C.red, fontSize: 13, marginTop: 8 }}>{error}</p>}
          </QuestionCard>
        )}

        {/* ── FEEDING ── */}
        {step === "feeding" && (
          <QuestionCard
            question="Frekuensi makan/menyusu dalam 24 jam terakhir?"
          >
            <ChoiceButton
              label="1 — Kurang"
              sub={triage.ageMonths !== null && triage.ageMonths < 6 ? "Kurang dari 8 kali menyusu" : "Kurang dari 3 kali makan"}
              onClick={() => next({ feedingFreq: "1" }, "milestone")}
            />
            <ChoiceButton
              label="2 — Cukup"
              sub={triage.ageMonths !== null && triage.ageMonths < 6 ? "8–12 kali menyusu" : "3–4 kali makan"}
              onClick={() => next({ feedingFreq: "2" }, "milestone")}
            />
            <ChoiceButton
              label="3 — Baik"
              sub={triage.ageMonths !== null && triage.ageMonths < 6 ? "Lebih dari 12 kali" : "5 kali atau lebih"}
              onClick={() => next({ feedingFreq: "3" }, "milestone")}
            />
          </QuestionCard>
        )}

        {/* ── MILESTONE ── */}
        {step === "milestone" && (
          <QuestionCard
            question="Perkembangan anak sesuai usia?"
            hint="Berdasarkan SDIDTK untuk usia ini"
          >
            <ChoiceButton
              label="1 — Sudah semua"
              sub="Semua perkembangan sesuai usia"
              onClick={() => finishTriage("1")}
            />
            <ChoiceButton
              label="2 — Beberapa belum"
              sub="Sebagian perkembangan belum tercapai"
              onClick={() => finishTriage("2")}
            />
            <ChoiceButton
              label="3 — Banyak yang belum"
              sub="Banyak perkembangan belum tercapai"
              onClick={() => finishTriage("3")}
            />
          </QuestionCard>
        )}

        {/* ── RESULT ── */}
        {step === "result" && result && (
          <div style={{ padding: "24px 20px" }}>
            {/* Risk banner */}
            <div style={{
              background: `${riskColor(result.riskLevel)}20`,
              border: `2px solid ${riskColor(result.riskLevel)}`,
              borderRadius: 14, padding: "16px 20px", marginBottom: 20,
              textAlign: "center",
            }}>
              <div style={{ color: riskColor(result.riskLevel), fontSize: 18, fontWeight: 800 }}>
                {riskLabel(result.riskLevel)}
              </div>
              {result.referNow && (
                <div style={{ color: C.red, fontSize: 14, marginTop: 6 }}>
                  Bawa ke Puskesmas hari ini
                </div>
              )}
            </div>

            {/* Report */}
            <div style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 12, padding: 16, marginBottom: 20,
            }}>
              <pre style={{
                color: C.white, fontSize: 13, lineHeight: 1.7,
                whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit",
              }}>
                {result.reportText}
              </pre>
            </div>

            {/* Sync status */}
            <div style={{
              background: "rgba(255,209,102,0.1)",
              border: `1px solid ${C.yellow}`,
              borderRadius: 10, padding: 12, marginBottom: 20,
              fontSize: 13, color: C.yellow,
            }}>
              ⏳ Tersimpan lokal — akan sinkron ke server saat ada sinyal
            </div>

            <button onClick={startTriage} style={{
              width: "100%", padding: 16, borderRadius: 12,
              background: C.teal, color: C.white,
              fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer",
              marginBottom: 12,
            }}>
              ➕ Triage Anak Berikutnya
            </button>
            <button onClick={() => setStep("home")} style={{
              width: "100%", padding: 14, borderRadius: 12,
              background: C.card, color: C.dim,
              fontSize: 15, fontWeight: 600,
              border: `1px solid ${C.border}`, cursor: "pointer",
            }}>
              Kembali ke Beranda
            </button>
          </div>
        )}

        {/* ── HISTORY ── */}
        {step === "history" && (
          <div style={{ padding: "24px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ color: C.white, fontSize: 20, fontWeight: 700, margin: 0 }}>
                Riwayat Kasus
              </h2>
              <button onClick={() => setStep("home")} style={{
                background: "none", border: `1px solid ${C.border}`,
                color: C.dim, borderRadius: 8, padding: "6px 12px",
                fontSize: 13, cursor: "pointer",
              }}>
                ← Kembali
              </button>
            </div>

            {history.length === 0 ? (
              <p style={{ color: C.dim, textAlign: "center", marginTop: 40 }}>
                Belum ada kasus tersimpan.
              </p>
            ) : (
              history.map((c) => (
                <div key={c.localId} style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: 16, marginBottom: 12,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ color: C.white, fontWeight: 700 }}>{c.childName}</span>
                    <span style={{
                      color: riskColor(c.riskLevel), fontSize: 12, fontWeight: 700,
                      background: `${riskColor(c.riskLevel)}20`,
                      padding: "2px 8px", borderRadius: 8,
                    }}>
                      {c.riskLevel}
                    </span>
                  </div>
                  <div style={{ color: C.dim, fontSize: 13 }}>
                    {c.ageMonths} bulan · {c.weightKg} kg · {c.heightCm} cm
                  </div>
                  <div style={{ color: C.dimmer, fontSize: 12, marginTop: 4 }}>
                    {new Date(c.createdAt).toLocaleDateString("id-ID", {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit"
                    })}
                    {" · "}
                    <span style={{ color: c.syncStatus === "synced" ? C.green : C.yellow }}>
                      {c.syncStatus === "synced" ? "✓ Tersinkron" : "⏳ Belum sinkron"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}
