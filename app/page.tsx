"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveIdentity, isLoggedIn, normalisePhone } from "@/lib/auth";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (isLoggedIn()) {
      router.replace("/triage");
    }
  }, [router]);

  async function handleLogin() {
    if (!phone.trim()) return;
    setLoading(true);
    setError("");

    const normalised = normalisePhone(phone);

    try {
      const res = await fetch("/api/auth/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalised }),
      });

      if (!res.ok) throw new Error("Server error");

      const data = await res.json();

      if (data.found) {
        saveIdentity({
          profileId: data.profileId,
          name: data.name,
          ngoId: data.ngoId,
          phone: normalised,
          savedAt: new Date().toISOString(),
        });
        router.replace("/triage");
      } else {
        setError("Nomor belum terdaftar. Hubungi koordinator NGO kamu.");
      }
    } catch {
      if (!navigator.onLine) {
        setError(
          "Tidak ada koneksi internet. Login pertama kali membutuhkan koneksi singkat."
        );
      } else {
        setError("Terjadi kesalahan. Coba lagi.");
      }
    }

    setLoading(false);
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0D1F1C 0%, #1A3C34 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{ width: "100%", maxWidth: 360 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🌿</div>
          <h1 style={{
            color: "#02C39A",
            fontSize: 28,
            fontWeight: 800,
            margin: 0,
          }}>
            SahAIbat Kader
          </h1>
          <p style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: 14,
            marginTop: 8,
          }}>
            Alat triase Posyandu — bekerja tanpa internet
          </p>
        </div>

        {/* Phone input */}
<div style={{ marginBottom: 16 }}>
          <label style={{
            display: "block",
            color: "rgba(255,255,255,0.7)",
            fontSize: 13,
            marginBottom: 8,
          }}>
            Nomor WhatsApp kamu
          </label>
          <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1.5px solid rgba(2,195,154,0.4)" }}>
            <div style={{
              padding: "14px 14px",
              background: "rgba(2,195,154,0.15)",
              color: "#02C39A",
              fontSize: 16,
              fontWeight: 700,
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              borderRight: "1px solid rgba(2,195,154,0.3)",
            }}>
              🇮🇩 +62
            </div>
            <input
              type="tel"
              placeholder="812 3456 7890"
              value={phone}
              onChange={(e) => {
                // Strip any leading +62 or 0 if Kader types it anyway
                let val = e.target.value.replace(/^\+62/, "").replace(/^0/, "");
                setPhone(val);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              style={{
                flex: 1,
                padding: "14px 16px",
                background: "rgba(255,255,255,0.08)",
                border: "none",
                color: "white",
                fontSize: 16,
                outline: "none",
                minWidth: 0,
              }}
            />
          </div>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 6 }}>
            Contoh: 812 3456 7890
          </p>
        </div>

        {/* Error */}
        {error && (
          <p style={{
            color: "#FF8C6B",
            fontSize: 13,
            marginBottom: 16,
            lineHeight: 1.5,
          }}>
            {error}
          </p>
        )}

        {/* Button */}
        <button
          onClick={handleLogin}
          disabled={loading || !phone.trim()}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 10,
            background: loading || !phone.trim()
              ? "rgba(2,195,154,0.3)"
              : "#02C39A",
            color: "white",
            fontSize: 16,
            fontWeight: 700,
            border: "none",
            cursor: loading || !phone.trim() ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Memeriksa..." : "Masuk"}
        </button>

        <p style={{
          color: "rgba(255,255,255,0.25)",
          fontSize: 12,
          textAlign: "center",
          marginTop: 32,
          lineHeight: 1.6,
        }}>
          Hanya untuk Kader terdaftar.{"\n"}
          Tidak perlu password.
        </p>
      </div>
    </main>
  );
}
