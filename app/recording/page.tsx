import Link from "next/link";
import ClientWrapper from "@/components/ClientWrapper";
import "./recording.css";

export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      
      <h1 className="page-title" >Live Sign Language – Real-Time Training</h1>
      <ClientWrapper />

      <div className="back-btn-bottom">
        <Link href="/">
          <button className="btn small">← Back to Home</button>
        </Link>
      </div>

    </main>
  );
}
