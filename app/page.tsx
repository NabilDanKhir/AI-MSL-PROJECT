import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a",
        color: "white",
      }}
    >
      <div
        style={{
          textAlign: "center",
          maxWidth: 600,
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 36, marginBottom: 12 }}>
          Live Sign Language
        </h1>

        <p style={{ fontSize: 18, opacity: 0.9, marginBottom: 32 }}>
          Real-Time Hand Gesture Recognition System
        </p>

        <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
          <Link href="/translate">
            <button
              style={{
                padding: "12px 24px",
                fontSize: 16,
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                background: "#22c55e",
                color: "#0f172a",
                fontWeight: 600,
              }}
            >
              Live Translation
            </button>
          </Link>

          <Link href="/recording">
            <button
              style={{
                padding: "12px 24px",
                fontSize: 16,
                borderRadius: 8,
                border: "1px solid #94a3b8",
                cursor: "pointer",
                background: "transparent",
                color: "white",
              }}
            >
              Record Dataset
            </button>
          </Link>
        </div>

        <p style={{ marginTop: 32, fontSize: 14, opacity: 0.7 }}>
          AI Project · Real-Time MSL Recognition
        </p>
      </div>
    </main>
  );
}
