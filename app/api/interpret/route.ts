// app/api/interpret/route.ts
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { signs, apiKey } = await req.json();

    if (!Array.isArray(signs) || signs.length === 0) {
      return NextResponse.json({ success: false, error: "No signs provided" }, { status: 400 });
    }

    if (signs.some((s: unknown) => typeof s !== "string" || !s.trim())) {
      return NextResponse.json({ success: false, error: "Invalid signs format" }, { status: 400 });
    }

    const key: string | undefined = process.env.GEMINI_API_KEY ?? apiKey;
    if (!key) {
      return NextResponse.json({ success: false, error: "No API key configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are an interpreter for Malaysian Sign Language (MSL / Bahasa Isyarat Malaysia).

The user has signed the following words in order: ${signs.join(", ")}.

Your task:
1. Form the most natural Malay sentence from these signs.
2. Translate that sentence into English.

Rules:
- Do not add words that were not signed unless they are grammatical particles with no sign equivalent.
- Keep the output concise.
- Reply ONLY with valid JSON in this exact format, no markdown fences:
{"malay": "...", "english": "..."}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Strip markdown code fences if Gemini wraps the JSON
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.malay !== "string" ||
      typeof parsed.english !== "string" ||
      !parsed.malay.trim() ||
      !parsed.english.trim()
    ) {
      throw new Error("Gemini returned unexpected response format");
    }

    return NextResponse.json({ success: true, malay: parsed.malay, english: parsed.english });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Interpretation failed";
    console.error("[interpret]", err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
