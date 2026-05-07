import Link from "next/link";
import ClientWrapper from "@/components/ClientWrapper";
import "./recording.css";

export default function RecordingPage() {
  return (
    <div className="page-container">
      <nav className="topbar">
        <Link href="/" className="btn-back" aria-label="Back to home">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M5 12l7-7M5 12l7 7" />
          </svg>
          Back
        </Link>
        <span className="topbar-title">Record Dataset</span>
        <span className="topbar-logo">MSL</span>
      </nav>

      <main className="recording-main">
        <ClientWrapper />
      </main>
    </div>
  );
}
