// components/BeneficiarySearch.tsx
// Shared beneficiary search component for Group A modules
// Used by: child, maternal, postpartum, neonatal, immunization, remaja

"use client";

import { useState } from "react";
import { searchBeneficiaries, type QueuedCase, formatAge } from "@/lib/offlineStore";

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
};

export interface BeneficiaryProfile {
  patientName: string;
  nik?: string;
  dob?: string | null;
  ageMonths?: number | null;
  ageDays?: number | null;
  gender?: "male" | "female" | "unknown";
}

interface Props {
  moduleType: "child" | "maternal" | "postpartum" | "neonatal" | "immunization" | "remaja";
  moduleEmoji: string;
  moduleTitle: string;
  onSelect: (profile: BeneficiaryProfile) => void;
  onNew: () => void;
  onWalkIn: () => void;
}

export default function BeneficiarySearch({
  moduleType,
  moduleEmoji,
  moduleTitle,
  onSelect,
  onNew,
  onWalkIn,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QueuedCase[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(false);
    const found = await searchBeneficiaries(query, moduleType as any);
    setResults(found);
    setSearched(true);
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  function selectProfile(c: QueuedCase) {
    onSelect({
      patientName: c.patientName,
      nik: c.nik,
      dob: c.dob,
      ageMonths: c.ageMonths,
      ageDays: c.ageDays,
      gender: c.gender,
    });
  }

  return (
    <div style={{ padding: "32px 20px" }}>

      {/* Title */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: C.dim, fontSize: 13, margin: "0 0 6px 0" }}>
          {moduleEmoji} {moduleTitle}
        </p>
        <h2 style={{ color: C.white, fontSize: 20, fontWeight: 700, margin: 0 }}>
          Cari peserta terdaftar
        </h2>
        <p style={{ color: C.dim, fontSize: 13, marginTop: 6 }}>
          Ketik nama untuk menemukan data bulan lalu
        </p>
      </div>

      {/* Search input */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Contoh: Budi, Ahmad, Siti..."
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            if (!e.target.value.trim()) {
              setResults([]);
              setSearched(false);
            }
          }}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{
            flex: 1,
            padding: "14px 16px",
            borderRadius: 10,
            background: "rgba(255,255,255,0.08)",
            border: `1.5px solid ${C.border}`,
            color: C.white,
            fontSize: 16,
            outline: "none",
          }}
        />
        <button
          onClick={handleSearch}
          disabled={!query.trim() || loading}
          style={{
            padding: "14px 18px",
            borderRadius: 10,
            background: query.trim() ? C.teal : "rgba(2,195,154,0.3)",
            color: C.white,
            fontSize: 16,
            fontWeight: 700,
            border: "none",
            cursor: query.trim() ? "pointer" : "not-allowed",
          }}
        >
          {loading ? "..." : "🔍"}
        </button>
      </div>

      {/* Search results */}
      {searched && results.length === 0 && (
        <div style={{
          background: "rgba(255,209,102,0.08)",
          border: `1px solid rgba(255,209,102,0.3)`,
          borderRadius: 10,
          padding: 14,
          marginBottom: 16,
          color: C.yellow,
          fontSize: 14,
        }}>
          Tidak ditemukan — peserta baru? Gunakan tombol di bawah.
        </div>
      )}

      {results.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: C.dimmer, fontSize: 12, fontWeight: 600, marginBottom: 10, letterSpacing: 0.5 }}>
            HASIL PENCARIAN — pilih untuk isi data bulan ini
          </p>
          {results.map(c => (
            <button
              key={c.localId}
              onClick={() => selectProfile(c)}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 12,
                background: "rgba(2,195,154,0.08)",
                border: `1.5px solid rgba(2,195,154,0.3)`,
                cursor: "pointer",
                marginBottom: 10,
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ color: C.white, fontWeight: 700, fontSize: 15 }}>
                  {c.patientName}
                </div>
                <div style={{ color: C.dim, fontSize: 12, marginTop: 3 }}>
                  {formatAge(c.ageMonths, c.ageDays)}
                  {c.nik ? ` · NIK: ${c.nik.slice(0, 6)}xxxxxxxxxx` : ""}
                </div>
                <div style={{ color: C.dimmer, fontSize: 11, marginTop: 2 }}>
                  Kunjungan terakhir:{" "}
                  {new Date(c.createdAt).toLocaleDateString("id-ID", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </div>
              </div>
              <div style={{ color: C.teal, fontSize: 20 }}>›</div>
            </button>
          ))}
        </div>
      )}

      {/* Divider */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
      }}>
        <div style={{ flex: 1, height: 1, background: C.border }} />
        <span style={{ color: C.dimmer, fontSize: 12 }}>ATAU</span>
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>

      {/* New full registration */}
      <button
        onClick={onNew}
        style={{
          width: "100%",
          padding: 16,
          borderRadius: 12,
          background: C.teal,
          color: C.white,
          fontSize: 16,
          fontWeight: 700,
          border: "none",
          cursor: "pointer",
          marginBottom: 12,
        }}
      >
        ➕ Peserta Baru — Daftar Lengkap
      </button>

      {/* Walk-in quick entry */}
      <button
        onClick={onWalkIn}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 12,
          background: "rgba(255,209,102,0.1)",
          color: C.yellow,
          fontSize: 15,
          fontWeight: 600,
          border: `1px solid rgba(255,209,102,0.3)`,
          cursor: "pointer",
        }}
      >
        ⚡ Triage Cepat — Peserta Belum Terdaftar
      </button>
      <p style={{ color: C.dimmer, fontSize: 12, textAlign: "center", marginTop: 8 }}>
        Nama saja · lengkapi NIK & data lain setelah sesi
      </p>

    </div>
  );
}
