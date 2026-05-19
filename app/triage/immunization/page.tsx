"use client";

// app/triage/immunization/page.tsx
// Imunisasi & Suplemen — Kemenkes 2023 schedule + Vitamin A + Obat Cacing
// Offline-capable: schedule is deterministic from DOB, records stored in IndexedDB

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getIdentity } from "@/lib/auth";
import {
  getImmunizationStatus,
  getImmunizationSummary,
  type VaccineStatus,
  type ImmunizationRecord,
} from "@/lib/immunization/schedule";
import { saveCase, getPendingCount, generateLocalId, type QueuedCase } from "@/lib/offlineStore";
import { syncPendingCases } from "@/lib/syncClient";

const C = {
  bg: "#0D1F1C", card: "rgba(255,255,255,0.05)",
  border: "rgba(2,195,154,0.25)", accent: "#02C39A",
  white: "#FFFFFF", dim: "rgba(255,255,255,0.5)",
  dimmer: "rgba(255,255,255,0.25)", red: "#FF6B6B",
  yellow: "#FFD166", green: "#02C39A", blue: "#2196F3",
};

type Step = "home" | "child_name" | "child_dob" | "grid" | "confirm" | "done";

interface ChildInfo {
  name: string;
  dob: string; // ISO date
  ageMonths: number;
}

function dobToMonths(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
}

function statusEmoji(s: string) {
  switch (s) {
    case 'done': return '✅';
    case 'overdue': return '🔴';
    case 'due_now': return '🟡';
    case 'upcoming': return '⬜';
    default: return '⚪';
  }
}

function statusLabel(s: string) {
  switch (s) {
    case 'done': return 'Sudah';
    case 'overdue': return 'TERLAMBAT';
    case 'due_now': return 'Waktunya sekarang';
    case 'upcoming': return 'Akan datang';
    default: return '';
  }
}

function statusColor(s: string) {
  switch (s) {
    case 'done': return C.green;
    case 'overdue': return C.red;
    case 'due_now': return C.yellow;
    case 'upcoming': return C.dim;
    default: return C.dim;
  }
}

function categoryLabel(c: string) {
  switch (c) {
    case 'imunisasi': return '💉 IMUNISASI';
    case 'vitamin_a': return '💊 VITAMIN A';
    case 'obat_cacing': return '🪱 OBAT CACING';
    default: return c;
  }
}

export default function ImmunizationPage() {
  const router = useRouter();
  const [identity, setIdentity] = useState<{ name: string; profileId: string; ngoId: string } | null>(null);
  const [step, setStep] = useState<Step>("home");
  const [child, setChild] = useState<ChildInfo | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [statuses, setStatuses] = useState<VaccineStatus[]>([]);
  const [loggedRecords, setLoggedRecords] = useState<ImmunizationRecord[]>([]);
  const [selectedVaccine, setSelectedVaccine] = useState<VaccineStatus | null>(null);
  const [loggedToday, setLoggedToday] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const id = getIdentity();
    if (!id) { router.replace("/"); return; }
    setIdentity(id);
    setIsOnline(navigator.onLine);
    window.addEventListener("online", () => setIsOnline(true));
    window.addEventListener("offline", () => setIsOnline(false));
  }, [router]);

  function start() {
    setChild(null); setInput(""); setError(""); setStatuses([]);
    setLoggedRecords([]); setSelectedVaccine(null); setLoggedToday([]);
    setStep("child_name");
  }

  function submitName() {
    if (!input.trim()) { setError("Masukkan nama anak."); return; }
    setChild(prev => ({ ...prev!, name: input.trim(), dob: '', ageMonths: 0 }));
    setInput(""); setError(""); setStep("child_dob");
  }

  function submitDob() {
    if (!input) { setError("Pilih tanggal lahir."); return; }
    const dob = input;
    const birth = new Date(dob);
    const now = new Date();
    if (birth > now) { setError("Tanggal lahir tidak boleh di masa depan."); return; }
    const ageMonths = dobToMonths(dob);
    if (ageMonths > 72) { setError("Anak lebih dari 6 tahun — di luar jadwal imunisasi dasar."); return; }

    const childInfo: ChildInfo = { name: child?.name ?? '', dob, ageMonths };
    setChild(childInfo);

    // Compute schedule with no existing records (fresh start)
    // In a full implementation, we'd fetch from IndexedDB/server
    const vaccineStatuses = getImmunizationStatus(dob, loggedRecords);
    setStatuses(vaccineStatuses);
    setInput(""); setError(""); setStep("grid");
  }

  function tapVaccine(v: VaccineStatus) {
    if (v.status === 'done' || v.status === 'upcoming') return;
    setSelectedVaccine(v);
    setStep("confirm");
  }

  async function confirmLog() {
    if (!selectedVaccine || !child || !identity) return;

    const today = new Date().toISOString().split('T')[0];
    const newRecord: ImmunizationRecord = {
      vaccine_code: selectedVaccine.code,
      dose_number: selectedVaccine.doseNumber,
      administered_date: today,
    };

    // Add to local records and recompute
    const updatedRecords = [...loggedRecords, newRecord];
    setLoggedRecords(updatedRecords);
    setLoggedToday(prev => [...prev, `${selectedVaccine.code}_${selectedVaccine.doseNumber}`]);

    // Recompute statuses
    const vaccineStatuses = getImmunizationStatus(child.dob, updatedRecords);
    setStatuses(vaccineStatuses);

    // Save as a case for sync
    const queued: QueuedCase = {
      localId: generateLocalId(),
      profileId: identity.profileId,
      ngoId: identity.ngoId,
      moduleType: 'child' as any, // TODO: add 'immunization'
      patientName: child.name,
      ageMonths: child.ageMonths,
      ageDays: null,
      gender: null,
      payload: {
        module: 'immunization',
        action: 'log_vaccine',
        childName: child.name,
        childDob: child.dob,
        vaccineCode: selectedVaccine.code,
        vaccineLabel: selectedVaccine.label,
        doseNumber: selectedVaccine.doseNumber,
        category: selectedVaccine.category,
        administeredDate: today,
      },
      riskLevel: 'LOW',
      reportText: `💉 ${selectedVaccine.label} dicatat untuk ${child.name} — ${today}`,
      referNow: false,
      followUpDays: 30,
      createdAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    await saveCase(queued);
    setSelectedVaccine(null);
    setStep("grid");

    if (navigator.onLine) {
      syncPendingCases().catch(() => {});
    }
  }

  if (!identity) return null;

  const summary = statuses.length > 0 ? getImmunizationSummary(statuses) : null;

  // Group statuses by category
  const grouped: Record<string, VaccineStatus[]> = {};
  statuses.forEach(v => {
    if (!grouped[v.category]) grouped[v.category] = [];
    grouped[v.category].push(v);
  });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: "rgba(0,0,0,0.2)" }}>
        <button onClick={() => router.push("/triage")} style={{ background: "none", border: "none", color: C.dim, fontSize: 22, cursor: "pointer", padding: 0 }}>←</button>
        <div>
          <div style={{ color: C.accent, fontWeight: 800, fontSize: 15 }}>💉 Imunisasi & Suplemen</div>
          <div style={{ color: C.dim, fontSize: 12 }}>{identity.name}</div>
        </div>
      </div>

      {!isOnline && <div style={{ background: "rgba(255,209,102,0.15)", borderBottom: `1px solid ${C.yellow}`, padding: "8px 20px", color: C.yellow, fontSize: 13, textAlign: "center" }}>📵 Mode offline — pencatatan tetap berjalan</div>}

      <div style={{ flex: 1, maxWidth: 480, width: "100%", margin: "0 auto" }}>

        {step === "home" && (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>💉</div>
            <h1 style={{ color: C.accent, fontSize: 22, fontWeight: 800, margin: 0 }}>Imunisasi & Suplemen</h1>
            <p style={{ color: C.dim, fontSize: 14, marginTop: 8 }}>Jadwal Kemenkes 2023 + Vitamin A + Obat Cacing</p>
            <button onClick={start} style={{ width: "100%", padding: 18, borderRadius: 14, background: C.accent, color: C.white, fontSize: 18, fontWeight: 800, border: "none", cursor: "pointer", marginTop: 24 }}>
              ➕ Cek Imunisasi Anak
            </button>
          </div>
        )}

        {step === "child_name" && (
          <div style={{ padding: "32px 20px" }}>
            <p style={{ color: C.dimmer, fontSize: 12, marginBottom: 8 }}>Imunisasi</p>
            <h2 style={{ color: C.white, fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Nama anak?</h2>
            <input type="text" placeholder="Contoh: Ahmad" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && submitName()} autoFocus
              style={{ width: "100%", padding: "14px 16px", borderRadius: 10, background: "rgba(255,255,255,0.08)", border: `1.5px solid ${C.border}`, color: C.white, fontSize: 18, outline: "none", boxSizing: "border-box", marginBottom: 16 }} />
            <button onClick={submitName} style={{ width: "100%", padding: 14, borderRadius: 10, background: input.trim() ? C.accent : `${C.accent}40`, color: C.white, fontSize: 16, fontWeight: 700, border: "none", cursor: input.trim() ? "pointer" : "not-allowed" }}>Lanjut →</button>
            {error && <p style={{ color: C.red, fontSize: 13, marginTop: 8 }}>{error}</p>}
          </div>
        )}

        {step === "child_dob" && (
          <div style={{ padding: "32px 20px" }}>
            <p style={{ color: C.dimmer, fontSize: 12, marginBottom: 8 }}>Imunisasi — {child?.name}</p>
            <h2 style={{ color: C.white, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Tanggal lahir anak?</h2>
            <p style={{ color: C.dim, fontSize: 13, marginBottom: 24 }}>Diperlukan untuk menghitung jadwal imunisasi</p>
            <input type="date" value={input} onChange={e => setInput(e.target.value)} autoFocus
              style={{ width: "100%", padding: "14px 16px", borderRadius: 10, background: "rgba(255,255,255,0.08)", border: `1.5px solid ${C.border}`, color: C.white, fontSize: 18, outline: "none", boxSizing: "border-box", marginBottom: 16 }} />
            {input && <p style={{ color: C.accent, fontSize: 14, marginBottom: 12, textAlign: "center" }}>✓ Usia: {dobToMonths(input)} bulan</p>}
            <button onClick={submitDob} style={{ width: "100%", padding: 14, borderRadius: 10, background: input ? C.accent : `${C.accent}40`, color: C.white, fontSize: 16, fontWeight: 700, border: "none", cursor: input ? "pointer" : "not-allowed" }}>Lihat Jadwal →</button>
            {error && <p style={{ color: C.red, fontSize: 13, marginTop: 8 }}>{error}</p>}
          </div>
        )}

        {step === "grid" && child && (
          <div style={{ padding: "20px" }}>
            {/* Child header */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ color: C.white, fontSize: 18, fontWeight: 700 }}>{child.name}</div>
              <div style={{ color: C.dim, fontSize: 13, marginTop: 4 }}>
                Usia: {child.ageMonths} bulan · Lahir: {new Date(child.dob).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>

            {/* Summary badges */}
            {summary && (
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <Badge label={`✅ ${summary.done} sudah`} color={C.green} />
                {summary.overdue > 0 && <Badge label={`🔴 ${summary.overdue} terlambat`} color={C.red} />}
                {summary.dueNow > 0 && <Badge label={`🟡 ${summary.dueNow} waktunya`} color={C.yellow} />}
                <Badge label={`⬜ ${summary.upcoming} akan datang`} color={C.dim} />
              </div>
            )}

            {loggedToday.length > 0 && (
              <div style={{ background: "rgba(2,195,154,0.1)", border: `1px solid ${C.green}`, borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: C.green }}>
                ✅ {loggedToday.length} imunisasi/suplemen dicatat hari ini
              </div>
            )}

            {/* Vaccine grid by category */}
            {(['imunisasi', 'vitamin_a', 'obat_cacing'] as const).map(cat => {
              const items = grouped[cat];
              if (!items || items.length === 0) return null;
              return (
                <div key={cat} style={{ marginBottom: 20 }}>
                  <p style={{ color: C.dimmer, fontSize: 12, fontWeight: 600, marginBottom: 8, letterSpacing: 1 }}>
                    {categoryLabel(cat)}
                  </p>
                  {items.map((v, i) => (
                    <button
                      key={`${v.code}_${v.doseNumber}`}
                      onClick={() => tapVaccine(v)}
                      disabled={v.status === 'done' || v.status === 'upcoming'}
                      style={{
                        width: "100%", padding: "12px 16px", borderRadius: 10, marginBottom: 6,
                        background: v.status === 'done' ? "rgba(2,195,154,0.08)"
                          : v.status === 'overdue' ? "rgba(255,107,107,0.08)"
                          : v.status === 'due_now' ? "rgba(255,209,102,0.08)"
                          : "rgba(255,255,255,0.03)",
                        border: `1px solid ${statusColor(v.status)}30`,
                        cursor: (v.status === 'done' || v.status === 'upcoming') ? "default" : "pointer",
                        opacity: v.status === 'upcoming' ? 0.5 : 1,
                        textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ color: C.white, fontSize: 14, fontWeight: 600 }}>
                          {statusEmoji(v.status)} {v.label}
                        </div>
                        <div style={{ color: C.dim, fontSize: 12, marginTop: 2 }}>
                          {v.status === 'done'
                            ? `Diberikan: ${v.administeredDate}`
                            : `Jadwal: usia ${v.dueAgeMonths} bulan`
                          }
                        </div>
                      </div>
                      <div style={{ color: statusColor(v.status), fontSize: 11, fontWeight: 700 }}>
                        {statusLabel(v.status)}
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}

            <button onClick={start} style={{ width: "100%", padding: 14, borderRadius: 12, background: C.accent, color: C.white, fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", marginTop: 12, marginBottom: 12 }}>
              ➕ Cek Anak Lain
            </button>
            <button onClick={() => router.push("/triage")} style={{ width: "100%", padding: 14, borderRadius: 12, background: C.card, color: C.dim, fontSize: 15, fontWeight: 600, border: `1px solid ${C.border}`, cursor: "pointer" }}>
              ← Kembali ke Beranda
            </button>
          </div>
        )}

        {step === "confirm" && selectedVaccine && child && (
          <div style={{ padding: "32px 20px" }}>
            <h2 style={{ color: C.white, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Konfirmasi Pencatatan</h2>
            <p style={{ color: C.dim, fontSize: 14, marginBottom: 24 }}>Apakah imunisasi/suplemen ini sudah diberikan hari ini?</p>

            <div style={{ background: C.card, border: `1px solid ${C.accent}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ color: C.accent, fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                {selectedVaccine.label}
              </div>
              <div style={{ color: C.white, fontSize: 14 }}>
                Anak: {child.name}
              </div>
              <div style={{ color: C.dim, fontSize: 13, marginTop: 4 }}>
                Tanggal: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>

            <button onClick={confirmLog} style={{
              width: "100%", padding: 16, borderRadius: 12,
              background: C.accent, color: C.white, fontSize: 16, fontWeight: 700,
              border: "none", cursor: "pointer", marginBottom: 12,
            }}>
              ✅ Ya, Catat Hari Ini
            </button>
            <button onClick={() => { setSelectedVaccine(null); setStep("grid"); }} style={{
              width: "100%", padding: 14, borderRadius: 12,
              background: "transparent", color: C.dim, fontSize: 15, fontWeight: 600,
              border: `1px solid ${C.border}`, cursor: "pointer",
            }}>
              ← Batal
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      background: `${color}15`, color, border: `1px solid ${color}30`,
      borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700,
    }}>{label}</span>
  );
}
