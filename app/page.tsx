"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveIdentity, isLoggedIn, normalisePhone } from "@/lib/auth";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    if (isLoggedIn()) router.replace("/triage");
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
        setError("Nomor belum terdaftar. Hubungi koordinator Kader kamu.");
      }
    } catch {
      if (!navigator.onLine) {
        setError("Tidak ada koneksi. Login pertama kali membutuhkan internet sebentar.");
      } else {
        setError("Terjadi kesalahan. Coba lagi.");
      }
    }
    setLoading(false);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Plus Jakarta Sans', sans-serif;
          background: #071412;
          min-height: 100vh;
        }

        .login-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
          background: #071412;
        }

        /* Animated background blobs */
        .blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.18;
          pointer-events: none;
        }
        .blob-1 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, #02C39A, #017367);
          top: -120px; right: -100px;
          animation: float1 8s ease-in-out infinite;
        }
        .blob-2 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, #5DCAA5, #02C39A);
          bottom: 60px; left: -80px;
          animation: float2 10s ease-in-out infinite;
        }
        .blob-3 {
          width: 200px; height: 200px;
          background: radial-gradient(circle, #017367, #024D42);
          top: 40%; left: 30%;
          animation: float3 12s ease-in-out infinite;
        }

        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-20px, 30px) scale(1.05); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, -25px) scale(0.95); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(15px, 20px) scale(1.05); }
          66% { transform: translate(-10px, -15px) scale(0.95); }
        }

        /* Grid texture */
        .grid-overlay {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(2,195,154,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(2,195,154,0.04) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }

        /* Card */
        .card {
          position: relative;
          z-index: 10;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 24px;
          max-width: 420px;
          width: 100%;
          margin: 0 auto;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .card.mounted {
          opacity: 1;
          transform: translateY(0);
        }

        /* Logo area */
        .logo-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 40px;
        }
        .logo-icon {
          width: 72px;
          height: 72px;
          border-radius: 20px;
          background: linear-gradient(135deg, #02C39A22, #02C39A44);
          border: 1px solid rgba(2,195,154,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          box-shadow: 0 0 32px rgba(2,195,154,0.2), 0 8px 24px rgba(0,0,0,0.4);
          overflow: hidden;
        }
        .logo-icon img {
          width: 52px;
          height: 52px;
          object-fit: contain;
        }
        .logo-name {
          font-size: 28px;
          font-weight: 800;
          color: #FFFFFF;
          letter-spacing: -0.5px;
          line-height: 1;
          margin-bottom: 6px;
        }
        .logo-name span {
          color: #02C39A;
        }
        .logo-sub {
          font-size: 13px;
          color: rgba(255,255,255,0.4);
          font-weight: 500;
          letter-spacing: 0.3px;
          text-align: center;
        }

        /* Divider */
        .divider {
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(2,195,154,0.2), transparent);
          margin-bottom: 32px;
        }

        /* Form */
        .form-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 10px;
          width: 100%;
        }

        .phone-wrap {
          width: 100%;
          display: flex;
          border-radius: 14px;
          overflow: hidden;
          border: 1.5px solid rgba(2,195,154,0.2);
          background: rgba(255,255,255,0.04);
          transition: border-color 0.2s, box-shadow 0.2s;
          margin-bottom: 8px;
        }
        .phone-wrap.focused {
          border-color: rgba(2,195,154,0.6);
          box-shadow: 0 0 0 3px rgba(2,195,154,0.08);
        }

        .phone-prefix {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 14px;
          background: rgba(2,195,154,0.08);
          border-right: 1px solid rgba(2,195,154,0.15);
          color: #02C39A;
          font-size: 15px;
          font-weight: 700;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .phone-input {
          flex: 1;
          padding: 14px 16px;
          background: transparent;
          border: none;
          color: #FFFFFF;
          font-size: 16px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 500;
          outline: none;
          min-width: 0;
        }
        .phone-input::placeholder {
          color: rgba(255,255,255,0.2);
        }

        .phone-hint {
          font-size: 12px;
          color: rgba(255,255,255,0.25);
          margin-bottom: 24px;
          width: 100%;
        }

        /* Error */
        .error-box {
          width: 100%;
          padding: 12px 14px;
          border-radius: 10px;
          background: rgba(255,107,107,0.08);
          border: 1px solid rgba(255,107,107,0.25);
          color: #FF8C6B;
          font-size: 13px;
          line-height: 1.5;
          margin-bottom: 16px;
        }

        /* Button */
        .login-btn {
          width: 100%;
          padding: 15px;
          border-radius: 14px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 15px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
          letter-spacing: 0.2px;
        }
        .login-btn:enabled {
          background: linear-gradient(135deg, #02C39A, #017367);
          color: #FFFFFF;
          box-shadow: 0 4px 20px rgba(2,195,154,0.3);
        }
        .login-btn:enabled:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(2,195,154,0.4);
        }
        .login-btn:enabled:active {
          transform: translateY(0);
        }
        .login-btn:disabled {
          background: rgba(2,195,154,0.15);
          color: rgba(255,255,255,0.3);
          cursor: not-allowed;
        }

        /* Shimmer on button */
        .login-btn:enabled::after {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 60%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
          animation: shimmer 2.5s ease-in-out infinite;
        }
        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 200%; }
        }

        /* Loading dots */
        .dots span {
          display: inline-block;
          width: 5px; height: 5px;
          border-radius: 50%;
          background: rgba(255,255,255,0.7);
          margin: 0 2px;
          animation: dot 1.2s ease-in-out infinite;
        }
        .dots span:nth-child(2) { animation-delay: 0.2s; }
        .dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }

        /* Footer */
        .footer {
          position: relative;
          z-index: 10;
          text-align: center;
          padding: 0 24px 32px;
          color: rgba(255,255,255,0.2);
          font-size: 11px;
          line-height: 1.6;
        }

        /* Badges */
        .badges {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 24px;
          flex-wrap: wrap;
        }
        .badge {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 20px;
          border: 1px solid rgba(2,195,154,0.15);
          background: rgba(2,195,154,0.05);
          font-size: 11px;
          color: rgba(255,255,255,0.35);
          font-weight: 500;
        }
        .badge-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #02C39A;
          flex-shrink: 0;
        }
      `}</style>

      <div className="login-root">
        {/* Background effects */}
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="grid-overlay" />

        {/* Main card */}
        <div className={`card ${mounted ? "mounted" : ""}`}>

          {/* Logo */}
          <div className="logo-wrap">
            <div className="logo-icon">
              <img
                src="https://app.sahaibat.com/brand/sahaibat-icon.png"
                alt="SahAIbat"
                onError={(e) => {
                  // Fallback to text if image fails
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div className="logo-name">
              Sah<span>AI</span>bat
            </div>
            <div className="logo-sub">Aplikasi Kader — bekerja tanpa internet</div>
          </div>

          <div className="divider" />

          {/* Phone label */}
          <label className="form-label">Nomor WhatsApp Kader</label>

          {/* Phone input with +62 prefix */}
          <div className={`phone-wrap ${focused ? "focused" : ""}`}>
            <div className="phone-prefix">
              🇮🇩 +62
            </div>
            <input
              className="phone-input"
              type="tel"
              placeholder="812 3456 7890"
              value={phone}
              onChange={(e) => {
                let val = e.target.value.replace(/^\+62/, "").replace(/^0/, "");
                setPhone(val);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          <div className="phone-hint">
            Masukkan nomor tanpa angka 0 di depan. Contoh: 812 3456 7890
          </div>

          {/* Error */}
          {error && <div className="error-box">⚠️ {error}</div>}

          {/* Login button */}
          <button
            className="login-btn"
            onClick={handleLogin}
            disabled={loading || !phone.trim()}
          >
            {loading ? (
              <span className="dots">
                <span /><span /><span />
              </span>
            ) : (
              "Masuk ke SahAIbat"
            )}
          </button>

          {/* Trust badges */}
          <div className="badges">
            <div className="badge"><div className="badge-dot" />Offline-first</div>
            <div className="badge"><div className="badge-dot" />Data aman</div>
            <div className="badge"><div className="badge-dot" />Khusus Kader</div>
          </div>
        </div>

        {/* Footer */}
        <div className="footer">
          <div style={{ marginBottom: 12 }}>
            Hanya untuk Kader terdaftar. Tidak perlu password.
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
            <a href="/privacy" style={{ color: "rgba(2,195,154,0.6)", textDecoration: "none", fontSize: 12, fontWeight: 500 }}>Privasi</a>
            <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
            <a href="mailto:privacy@sahaibat.com" style={{ color: "rgba(2,195,154,0.6)", textDecoration: "none", fontSize: 12, fontWeight: 500 }}>Kontak</a>
          </div>
          <div>© 2026 SahAIbat Health — Viantra</div>
          <div style={{ marginTop: 4, fontSize: 10, color: "rgba(255,255,255,0.12)" }}>
            NIB: 1202260248509 · PSE Lingkup Privat Asing
          </div>
        </div>
      </div>
    </>
  );
}
