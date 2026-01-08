import Link from "next/link";
import ClientTranslateWrapper from "@/components/ClientTranslateWrapper";
import "./translate.css";

export default function TranslatePage() {
  return (
    <main className="translate-page">

      <h1>Live Sign Language – Real-Time Translate</h1>
      <ClientTranslateWrapper />


      <div className="back-btn-bottom">
        <Link href="/">
          <button className="btn">← Back to Home</button>
        </Link>
      </div>
    </main>
  );
}
