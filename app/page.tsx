export default function Home() {
  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(160deg, #0D1F1C 0%, #1A3C34 100%)",
      padding: "24px",
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🌿</div>
      <h1 style={{ color: "#02C39A", fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
        SahAIbat Kader
      </h1>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, textAlign: "center" }}>
        Alat triase Posyandu — bekerja tanpa internet
      </p>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 32 }}>
        Phase 1 deployed ✓
      </p>
    </main>
  );
}
