"use client";

import dynamic from "next/dynamic";

const HandRecognizer = dynamic(
  () => import("./HandRecognizer"),
  { ssr: false }
);

export default function ClientWrapper() {
  return <HandRecognizer />;
}
