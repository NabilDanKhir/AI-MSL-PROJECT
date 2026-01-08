import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const LABELS_PATH = path.join(process.cwd(), "lib", "labels.json");

export async function POST(req: Request) {
  const { label } = await req.json();

  if (!label || typeof label !== "string") {
    return NextResponse.json({ error: "Invalid label" }, { status: 400 });
  }

  const labels: string[] = JSON.parse(
    fs.readFileSync(LABELS_PATH, "utf-8")
  );

  if (!labels.includes(label)) {
    labels.push(label);
    fs.writeFileSync(LABELS_PATH, JSON.stringify(labels, null, 2));
  }

  return NextResponse.json({ labels });
}
