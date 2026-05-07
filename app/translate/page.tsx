import Link from "next/link";
import ClientTranslateWrapper from "@/components/ClientTranslateWrapper";
import "./translate.css";

export default function TranslatePage() {
  return (
    <div className="page-container">
      <nav className="topbar">
        <Link href="/" className="btn-back" aria-label="Back to home">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M5 12l7-7M5 12l7 7" />
          </svg>
          Back
        </Link>
        <span className="topbar-title">Live Translation</span>
        <span className="topbar-logo">MSL</span>
      </nav>

      <main className="translate-main">
        <div style={{ marginBottom: 20 }}>
          <span className="badge badge-green">
            <span className="badge-dot" />
            Camera Active
          </span>
        </div>
        <ClientTranslateWrapper />
      </main>
    </div>
  );
}
