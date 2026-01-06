"use client";

import dynamic from "next/dynamic";

const HandTranslator = dynamic(
  () => import("./HandTranslator"),
  { ssr: false }
);

export default function ClientTranslateWrapper() {
  return <HandTranslator />;
}
