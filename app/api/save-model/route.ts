import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  try {
    const { modelJSON, weightsBase64 } = await req.json();

    const modelDir = path.join(process.cwd(), "public", "model");

    // ensure the directory exists
    await mkdir(modelDir, { recursive: true });

    // write model.json
    await writeFile(
      path.join(modelDir, "model.json"),
      JSON.stringify(modelJSON, null, 2),
      "utf-8"
    );

    // decode base64 weights and write as binary
    const weightsBuffer = Buffer.from(weightsBase64, "base64");
    await writeFile(path.join(modelDir, "model.weights.bin"), weightsBuffer);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[save-model]", error);
    return NextResponse.json(
      { success: false, error: "Failed to save model. If deployed on Vercel, the filesystem is read-only — run this locally instead." },
      { status: 500 }
    );
  }
}