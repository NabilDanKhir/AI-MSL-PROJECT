import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    const filePath = path.join(
      process.cwd(),
      "./ml/dataset_dirty.json"
    );

    await writeFile(
      filePath,
      JSON.stringify(data, null, 2),
      "utf-8"
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}
