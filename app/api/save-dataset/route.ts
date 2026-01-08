import { NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  try {
    const newData = await req.json();

    const filePath = path.join(
      process.cwd(),
      "./ml/dataset_dirty.json"
    );

    let existingData = [];

    try {
      const file = await readFile(filePath, "utf-8");
      existingData = JSON.parse(file);
    } catch {
      existingData = [];
    }

    const merged = existingData.concat(newData);

    await writeFile(
      filePath,
      JSON.stringify(merged, null, 2),
      "utf-8"
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
