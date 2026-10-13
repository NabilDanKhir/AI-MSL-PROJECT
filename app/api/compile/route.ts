import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

type ExecFailure = {
  stdout?: string;
  stderr?: string;
  message?: string;
};

function isExecFailure(err: unknown): err is ExecFailure {
  return typeof err === "object" && err !== null;
}

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
  } catch (err: unknown) {
    const failure = isExecFailure(err) ? err : {};

    return NextResponse.json(
      {
        success: false,
        output: [failure.stdout, failure.stderr, failure.message].filter(Boolean).join("\n"),
      },
      { status: 500 }
    );
  }
}
