import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function POST() {
  const mlDir = path.join(process.cwd(), "ml");

  try {
    const { stdout, stderr } = await execAsync("python balance.py", {
      cwd: mlDir,
      timeout: 120_000,
    });
    return NextResponse.json({
      success: true,
      output: stdout + (stderr ? `\nSTDERR: ${stderr}` : ""),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        output: [err.stdout, err.stderr, err.message].filter(Boolean).join("\n"),
      },
      { status: 500 }
    );
  }
}
