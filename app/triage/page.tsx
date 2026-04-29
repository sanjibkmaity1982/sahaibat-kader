"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getIdentity, clearIdentity } from "@/lib/auth";
import {
  getPendingCount,
  getAllCases,
  getCachedCases,
  type QueuedCase,
  type CachedCase,
  moduleColor,
  moduleLabel,
  getPatientName,
  formatAge,
} from "@/lib/offlineStore";

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

function riskVisualColor(visual: "red" | "amber" | "green" | "gray") {
  if (visual === "red") return C.red;
  if (visual === "amber") return C.yellow;
  if (visual === "green") return C.green;
  return C.dim;
}

type View = "home" | "history";

type MergedHistoryRow =
  | { kind: "local"; local: QueuedCase }
  | { kind: "server"; server: CachedCase }
  | { kind: "merged"; local: QueuedCase; server: CachedCase };

export default function TriagePage() {
  const router = useRouter();
  const [identity, setIdentity] = useState<{ name: string; profileId: string; ngoId: string } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
 const [view, setView] = useState<View>("home");
  const [history, setHistory] = useState<MergedHistoryRow[]>([]);
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [cachedDetails, setCachedDetails] = useState<Record<string, CachedCase>>({});

  // ── Refresh pending count from IndexedDB ──────────────────────────────────
  const refreshPending = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  // ── Run sync then always refresh count regardless of result ───────────────
  const runSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const { syncPendingCases } = await import("@/lib/syncClient");
      await syncPendingCases();
    } catch {
      // Silently ignore sync errors — will retry on next online event
    } finally {
      // ALWAYS clear syncing state and refresh count, even on error
      setIsSyncing(false);
      await refreshPending();
    }
  }, [isSyncing, refreshPending]);

  useEffect(() => {
    const id = getIdentity();
    if (!id) { router.replace("/"); return; }
    setIdentity(id);

    const online = navigator.onLine;
    setIsOnline(online);

    // Initial pending count
    refreshPending();

    // If already online on mount, run sync after short delay
    if (online) {
      const t = setTimeout(() => runSync(), 2000);
      return () => clearTimeout(t);
    }
  }, [router, refreshPending]); // runSync intentionally excluded from deps here

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      runSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Cleanup — removes listeners when component unmounts
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [runSync]);

async function showHistory() {
    const [localCases, cachedCases] = await Promise.all([
      getAllCases(),
      getCachedCases(),
    ]);

    // Build a lookup of cached cases by patient_name+created_at(rounded to 10s window)
    // — this lets us show the richer server data for cases that synced.
    const cachedLookup: Record<string, CachedCase> = {};
    for (const c of cachedCases) {
      cachedLookup[c.case_id] = c;
    }
    setCachedDetails(cachedLookup);

    // Merge: server-cached cases take precedence; local-only cases (unsynced or
    // synced but not yet in cache) appear as "local" rows.
    const merged: MergedHistoryRow[] = [];
    const usedCacheIds = new Set<string>();

    // First pass — local cases. Try to match each to a cached server row.
    for (const local of localCases) {
      const localTime = new Date(local.createdAt).getTime();
      const localName = getPatientName(local).toLowerCase();
      const match = cachedCases.find((sc) => {
        if (usedCacheIds.has(sc.case_id)) return false;
        if ((sc.patient_name ?? "").toLowerCase() !== localName) return false;
        const diff = Math.abs(new Date(sc.created_at).getTime() - localTime);
        return diff < 10_000; // within 10 seconds
      });
      if (match) {
        usedCacheIds.add(match.case_id);
        merged.push({ kind: "merged", local, server: match });
      } else {
        merged.push({ kind: "local", local });
      }
    }

    // Second pass — server cases with no local match (different device, or
    // local data wiped). Add them as server-only rows.
    for (const sc of cachedCases) {
      if (!usedCacheIds.has(sc.case_id)) {
        merged.push({ kind: "server", server: sc });
      }
    }

    // Sort by date descending
    merged.sort((a, b) => {
      const aTime = a.kind === "server"
        ? new Date(a.server.created_at).getTime()
        : new Date(a.local.createdAt).getTime();
      const bTime = b.kind === "server"
        ? new Date(b.server.created_at).getTime()
        : new Date(b.local.createdAt).getTime();
      return bTime - aTime;
    });

    setHistory(merged);
    setExpandedCaseId(null);
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
          {isSyncing && (
            <div style={{
              background: "rgba(2,195,154,0.15)", color: C.teal,
              borderRadius: 12, padding: "2px 10px", fontSize: 12, fontWeight: 600,
              border: `1px solid rgba(2,195,154,0.3)`,
            }}>
              ↻ Sinkronisasi…
            </div>
          )}
          {!isSyncing && pendingCount > 0 && (
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
              <div style={{
                width: 72, height: 72,
                borderRadius: 20,
                background: "linear-gradient(135deg, rgba(2,195,154,0.15), rgba(2,195,154,0.25))",
                border: "1px solid rgba(2,195,154,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
                boxShadow: "0 0 24px rgba(2,195,154,0.15)",
                overflow: "hidden",
              }}>
                <img
                  src="https://app.sahaibat.com/brand/sahaibat-icon.png"
                  alt="SahAIbat"
                  style={{ width: 52, height: 52, objectFit: "contain" }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              <h1 style={{ color: C.white, fontSize: 22, fontWeight: 800, margin: 0 }}>
                Selamat datang, <span style={{ color: C.teal }}>{identity.name}</span>
              </h1>
              <p style={{ color: C.dim, fontSize: 13, marginTop: 6 }}>
                Pilih modul triase di bawah ini
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

            {!isSyncing && pendingCount > 0 && (
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

            {isSyncing && (
              <div style={{
                marginTop: 16, padding: 14, borderRadius: 12,
                background: "rgba(2,195,154,0.08)",
                border: `1px solid rgba(2,195,154,0.3)`,
              }}>
                <p style={{ color: C.teal, fontSize: 13, margin: 0 }}>
                  ↻ Sedang menyinkronkan data ke server…
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
              history.map((row, idx) => {
                const rowKey =
                  row.kind === "server"
                    ? `s-${row.server.case_id}`
                    : `l-${row.local.localId}`;
                const isExpanded = expandedCaseId === rowKey;

                // Header (always visible) data
                const patientName =
                  row.kind === "server"
                    ? row.server.patient_name ?? "—"
                    : getPatientName(row.local);

                const moduleLabelText =
                  row.kind === "server"
                    ? row.server.module_type ?? "—"
                    : moduleLabel(row.local.moduleType);

                const moduleColorVal =
                  row.kind === "server"
                    ? C.teal // server cases don't carry the module enum, default tint
                    : moduleColor(row.local.moduleType);

                const ageLabel =
                  row.kind === "server"
                    ? row.server.patient_age_label
                    : formatAge(row.local.ageMonths, row.local.ageDays);

                const dateIso =
                  row.kind === "server" ? row.server.created_at : row.local.createdAt;

                const isSynced =
                  row.kind === "server" || row.local.syncStatus === "synced";
                const syncStatusText = isSynced ? "✓ Tersinkron" : "⏳ Belum sinkron";

             const syncStatusColor = isSynced ? C.green : C.yellow;
                
                // Risk indicator — server-derived if available, else local riskLevel
                const riskLabel =
                  row.kind === "server" || row.kind === "merged"
                    ? row.server.risk_level ?? "—"
                    : row.local.riskLevel;

                const riskBg =
                  row.kind === "server" || row.kind === "merged"
                    ? riskVisualColor(row.server.risk_visual)
                    : riskColor(row.local.riskLevel);

                return (
                  <div
                    key={rowKey}
                    onClick={() => setExpandedCaseId(isExpanded ? null : rowKey)}
                    style={{
                      background: C.card,
                      border: `1px solid ${isExpanded ? C.teal : C.border}`,
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 12,
                      cursor: "pointer",
                      transition: "border-color 0.15s",
                    }}
                  >
                    {/* Row header (matches existing layout) */}
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: C.white, fontWeight: 700 }}>{patientName}</span>
                      <span
                        style={{
                          color: riskBg,
                          fontSize: 12,
                          fontWeight: 700,
                          background: `${riskBg}20`,
                          padding: "2px 8px",
                          borderRadius: 8,
                          textTransform: "uppercase",
                        }}
                      >
                        {riskLabel}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: `${moduleColorVal}20`,
                          color: moduleColorVal,
                        }}
                      >
                        {moduleLabelText}
                      </span>
                      <span style={{ color: C.dim, fontSize: 12 }}>{ageLabel}</span>
                    </div>
                    <div style={{ color: C.dimmer, fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                      <span>
                        {new Date(dateIso).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" · "}
                        <span style={{ color: syncStatusColor }}>{syncStatusText}</span>
                      </span>
                      <span style={{ color: C.dim, fontSize: 14 }}>{isExpanded ? "▴" : "▾"}</span>
                    </div>

                    {/* Inline expansion */}
                    {isExpanded && (
                      <div
                        style={{
                          marginTop: 14,
                          paddingTop: 14,
                          borderTop: `1px solid ${C.border}`,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Server-derived rich fields if available */}
                        {(row.kind === "server" || row.kind === "merged") && (
                          <>
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ color: C.dim, fontSize: 11, fontWeight: 600, letterSpacing: 0.8, marginBottom: 4 }}>
                                TEMUAN
                              </div>
                              <div style={{ color: C.white, fontSize: 14, fontWeight: 600 }}>
                                {row.server.primary_finding}
                              </div>
                            </div>
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ color: C.dim, fontSize: 11, fontWeight: 600, letterSpacing: 0.8, marginBottom: 4 }}>
                                TINDAKAN
                              </div>
                              <div
                                style={{
                                  color: row.server.risk_visual === "red" ? C.red : C.white,
                                  fontSize: 14,
                                  fontWeight: 600,
                                }}
                              >
                                {row.server.primary_action}
                              </div>
                            </div>
                          </>
                        )}

                        {/* Clinical summary — full report text */}
                        <div>
                          <div style={{ color: C.dim, fontSize: 11, fontWeight: 600, letterSpacing: 0.8, marginBottom: 6 }}>
                            RINGKASAN KLINIS
                          </div>
                          <pre
                            style={{
                              color: C.white,
                              fontSize: 13,
                              lineHeight: 1.55,
                              whiteSpace: "pre-wrap",
                              fontFamily: "inherit",
                              margin: 0,
                              padding: 12,
                              background: "rgba(0,0,0,0.25)",
                              border: `1px solid ${C.border}`,
                              borderRadius: 8,
                              maxHeight: 360,
                              overflowY: "auto",
                            }}
                          >
                            {row.kind !== "server"
                              ? row.local.reportText
                              : "Detail klinis akan tampil setelah sinkronisasi."}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>
    </div>
  );
}

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
