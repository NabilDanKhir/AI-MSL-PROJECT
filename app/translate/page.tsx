import ClientTranslateWrapper from "@/components/ClientTranslateWrapper";
import "./translate.css";

export default function TranslatePage() {
  return (
    <main>
      <h1>Live Sign Language – Real-Time Translate</h1>
      <ClientTranslateWrapper />
    </main>
  );
}
