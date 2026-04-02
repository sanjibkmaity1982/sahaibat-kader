"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getIdentity, clearIdentity } from "@/lib/auth";
import { getPendingCount, getAllCases, type QueuedCase, moduleColor, moduleLabel, getPatientName, formatAge } from "@/lib/offlineStore";

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#0D1F1C",
  card: "rgba(255,255,255,0.05)",
  border: "rgba(2,195,154,0.25)",
  teal: "#02C39A",
  white: "#FFFFFF",
  dim: "rgba(255,255,255,0.5)",
  dimmer: "rgba(255,255,255,0.25)",
  red: "#FF6B6B",
  yellow: "#FFD166",
  green: "#02C39A",
  pink: "#E91E8C",
  purple: "#9C27B0",
  orange: "#FF9800",
};

function riskColor(level: string) {
  if (level === "HIGH") return C.red;
  if (level === "MEDIUM") return C.yellow;
  return C.green;
}

type View = "home" | "history";

export default function TriagePage() {
  const router = useRouter();
  const [identity, setIdentity] = useState<{ name: string; profileId: string; ngoId: string } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [view, setView] = useState<View>("home");
  const [history, setHistory] = useState<QueuedCase[]>([]);

  useEffect(() => {
    const id = getIdentity();
    if (!id) { router.replace("/"); return; }
    setIdentity(id);
    setIsOnline(navigator.onLine);
    window.addEventListener("online", () => {
      setIsOnline(true);
      import("@/lib/syncClient").then(({ syncPendingCases }) => {
        syncPendingCases().then(({ synced }) => {
          if (synced > 0) getPendingCount().then(setPendingCount);
        });
      });
    });
    window.addEventListener("offline", () => setIsOnline(false));
    getPendingCount().then(setPendingCount);
  }, [router]);

  async function showHistory() {
    const cases = await getAllCases();
    setHistory(cases);
    setView("history");
  }

  function handleLogout() {
    clearIdentity();
    router.replace("/");
  }

  if (!identity) return null;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
        background: "rgba(0,0,0,0.2)",
      }}>
        <div>
          <div style={{ color: C.teal, fontWeight: 800, fontSize: 16 }}>SahAIbat Kader</div>
          <div style={{ color: C.dim, fontSize: 12 }}>{identity.name}</div>
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
          <button onClick={handleLogout} style={{
            background: "none", border: `1px solid ${C.border}`,
            color: C.dim, borderRadius: 8, padding: "6px 12px",
            fontSize: 12, cursor: "pointer",
          }}>Keluar</button>
        </div>
      </div>

      {/* Offline banner */}
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
        {view === "home" && (
          <div style={{ padding: "32px 20px" }}>

            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🌿</div>
              <h1 style={{ color: C.teal, fontSize: 22, fontWeight: 800, margin: 0 }}>
                Selamat datang
              </h1>
              <p style={{ color: C.dim, fontSize: 14, marginTop: 6 }}>
                {identity.name} — Pilih modul triase
              </p>
            </div>

            {/* Module cards */}
            <div style={{ marginBottom: 8 }}>
              <p style={{ color: C.dimmer, fontSize: 12, fontWeight: 600, marginBottom: 12, letterSpacing: 1 }}>
                TRIAGE ANAK
              </p>
              <ModuleCard
                emoji="👶"
                title="Posyandu Anak"
                subtitle="Tumbuh kembang balita 0–60 bulan"
                color={C.teal}
                onClick={() => router.push("/triage/child")}
              />
            </div>

            <div style={{ marginBottom: 8 }}>
              <p style={{ color: C.dimmer, fontSize: 12, fontWeight: 600, marginBottom: 12, letterSpacing: 1, marginTop: 20 }}>
                TRIAGE IBU
              </p>
              <ModuleCard
                emoji="🤰"
                title="Ibu Hamil"
                subtitle="Triase antenatal — tanda bahaya kehamilan"
                color={C.pink}
                onClick={() => router.push("/triage/maternal")}
              />
              <ModuleCard
                emoji="🌸"
                title="Ibu Nifas"
                subtitle="Setelah melahirkan — 0 sampai 42 hari"
                color={C.purple}
                onClick={() => router.push("/triage/postpartum")}
              />
              <ModuleCard
                emoji="🍼"
                title="Bayi Baru Lahir"
                subtitle="Neonatal — 0 sampai 28 hari"
                color={C.orange}
                onClick={() => router.push("/triage/neonatal")}
              />
            </div>

            {/* History + pending */}
            <div style={{ marginTop: 24 }}>
              <button onClick={showHistory} style={{
                width: "100%", padding: 14, borderRadius: 12,
                background: C.card, color: C.white,
                fontSize: 15, fontWeight: 600,
                border: `1.5px solid ${C.border}`, cursor: "pointer",
              }}>
                📋 Riwayat Kasus
              </button>
            </div>

            {pendingCount > 0 && (
              <div style={{
                marginTop: 16, padding: 14, borderRadius: 12,
                background: "rgba(255,209,102,0.1)",
                border: `1px solid ${C.yellow}`,
              }}>
                <p style={{ color: C.yellow, fontSize: 13, margin: 0 }}>
                  ⏳ {pendingCount} kasus menunggu sinkronisasi.
                  {isOnline ? " Sinkronisasi akan segera dilakukan." : " Akan sinkron saat ada sinyal."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY ── */}
        {view === "history" && (
          <div style={{ padding: "24px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ color: C.white, fontSize: 20, fontWeight: 700, margin: 0 }}>
                Riwayat Kasus
              </h2>
              <button onClick={() => setView("home")} style={{
                background: "none", border: `1px solid ${C.border}`,
                color: C.dim, borderRadius: 8, padding: "6px 12px",
                fontSize: 13, cursor: "pointer",
              }}>← Kembali</button>
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
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: C.white, fontWeight: 700 }}>{getPatientName(c)}</span>
                    <span style={{
                      color: riskColor(c.riskLevel), fontSize: 12, fontWeight: 700,
                      background: `${riskColor(c.riskLevel)}20`,
                      padding: "2px 8px", borderRadius: 8,
                    }}>
                      {c.riskLevel}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                      background: `${moduleColor(c.moduleType)}20`,
                      color: moduleColor(c.moduleType),
                    }}>
                      {moduleLabel(c.moduleType)}
                    </span>
                    <span style={{ color: C.dim, fontSize: 12 }}>
                      {formatAge(c.ageMonths, c.ageDays)}
                    </span>
                  </div>
                  <div style={{ color: C.dimmer, fontSize: 12 }}>
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

// ── Module card component ──────────────────────────────────────────────────────
function ModuleCard({ emoji, title, subtitle, color, onClick }: {
  emoji: string;
  title: string;
  subtitle: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      width: "100%", padding: "16px 20px", borderRadius: 14,
      background: `${color}10`,
      border: `1.5px solid ${color}40`,
      cursor: "pointer", marginBottom: 12, textAlign: "left",
      display: "flex", alignItems: "center", gap: 16,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: `${color}20`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, flexShrink: 0,
      }}>
        {emoji}
      </div>
      <div>
        <div style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700 }}>{title}</div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ marginLeft: "auto", color: `${color}80`, fontSize: 18 }}>›</div>
    </button>
  );
}
