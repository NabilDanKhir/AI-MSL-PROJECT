import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-bg">
      <div className="home-grid" aria-hidden="true" />
      <div className="home-glow" aria-hidden="true" />

      <div className="hero">
        <div className="hero-eyebrow">
          <span className="badge badge-green">
            <span className="badge-dot" />
            System Active
          </span>
        </div>

        <h1 className="hero-h1">
          BIM-Translate: <br />
          <span className="hero-accent">Real-Time</span> Malaysian Sign Language Recognition
        </h1>

        <p className="hero-sub">
          A real-time Bahasa Isyarat Malaysia (BIM) recognition system that converts hand gestures into
          natural Malay and English text — accessible in any browser, no special hardware required.
        </p>

        <div className="hero-btns">
          <Link href="/translate">
            <button className="btn hero-btn-primary" aria-label="Open live translation">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 10l5-5m0 0l-5-5m5 5H4" />
                <path d="M9 18L4 13m0 0l5-5M4 13h15" />
              </svg>
              Live Translation
            </button>
          </Link>

          <Link href="/recording">
            <button className="btn btn-ghost hero-btn-secondary" aria-label="Open dataset recorder">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="12" r="7" />
              </svg>
              Record Dataset
            </button>
          </Link>

          <Link href="/train">
            <button className="btn btn-ghost hero-btn-secondary" aria-label="Open model trainer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              Train Model
            </button>
          </Link>
        </div>

        <p className="hero-footer-text">
          Copyright © Budak JKM KSJ · 2026 · Real-Time BIM Recognition &amp; AI Agent Translation
        </p>
      </div>
    </main>
  );
}
