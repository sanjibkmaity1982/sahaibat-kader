"use client";

export default function OfflinePage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0D1F1C",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      padding: "2rem",
      textAlign: "center",
      fontFamily: "sans-serif",
    }}>
      <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📡</div>
      <h1 style={{ color: "#02C39A", fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        Mode Offline
      </h1>
      <p style={{ color: "#aaa", marginBottom: "2rem" }}>
        Tidak ada koneksi internet. Buka aplikasi saat online terlebih dahulu
        agar triase tersedia offline.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: "#02C39A",
          color: "#0D1F1C",
          border: "none",
          borderRadius: "8px",
          padding: "0.75rem 2rem",
          fontSize: "1rem",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        Coba Lagi
      </button>
    </div>
  );
}
