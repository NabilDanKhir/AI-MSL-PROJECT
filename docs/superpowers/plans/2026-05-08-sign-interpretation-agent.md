# Sign Interpretation Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Gemini-powered interpretation panel to HandTranslator that silently accumulates stable signs and after a 2-second pause sends them to Gemini Flash, returning a natural Malay sentence and English translation.

**Architecture:** Stable sign detections hook into the existing `setOutput` path in `onResults`, pushing to `signQueueRef` with consecutive dedup and resetting a 2-second debounce timer. On timer fire, `interpret()` POSTs to `/api/interpret` which calls Gemini 1.5 Flash and returns `{ malay, english }`. The UI panel below the detected sign card shows the result with a language toggle and clear button.

**Tech Stack:** Next.js 16, `@google/generative-ai`, TypeScript, inline CSS vars (existing pattern)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `package.json` | Modify | Add `@google/generative-ai` dependency |
| `app/api/interpret/route.ts` | Create | POST handler — Gemini call, key fallback, JSON response |
| `components/HandTranslator.tsx` | Modify | Sign queue refs, debounce, interpret(), interpretation UI panel |

---

### Task 1: Install `@google/generative-ai`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install @google/generative-ai
```

Expected output includes: `added 1 package` and `@google/generative-ai` appears in `package.json` dependencies.

- [ ] **Step 2: Verify install**

```bash
node -e "require('@google/generative-ai'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add @google/generative-ai dependency"
```

---

### Task 2: Create `/api/interpret` route

**Files:**
- Create: `app/api/interpret/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/interpret/route.ts
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { signs, apiKey } = await req.json();

    if (!Array.isArray(signs) || signs.length === 0) {
      return NextResponse.json({ success: false, error: "No signs provided" });
    }

    const key: string | undefined = process.env.GEMINI_API_KEY ?? apiKey;
    if (!key) {
      return NextResponse.json({ success: false, error: "No API key configured" });
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

    return NextResponse.json({ success: true, malay: parsed.malay, english: parsed.english });
  } catch (err: any) {
    console.error("[interpret]", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Interpretation failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Test the route manually — start the dev server**

```bash
npm run dev
```

- [ ] **Step 3: Test with curl (no API key configured yet — expect key error)**

```bash
curl -X POST http://localhost:3000/api/interpret \
  -H "Content-Type: application/json" \
  -d "{\"signs\":[\"Saya\",\"Mahu\",\"Makan\"]}"
```

Expected: `{"success":false,"error":"No API key configured"}`

- [ ] **Step 4: Test with an explicit API key in the body**

Replace `YOUR_KEY` with a real Gemini API key from [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey):

```bash
curl -X POST http://localhost:3000/api/interpret \
  -H "Content-Type: application/json" \
  -d "{\"signs\":[\"Saya\",\"Mahu\",\"Makan\"],\"apiKey\":\"YOUR_KEY\"}"
```

Expected: `{"success":true,"malay":"Saya mahu makan","english":"I want to eat"}`

- [ ] **Step 5: Commit**

```bash
git add app/api/interpret/route.ts
git commit -m "feat: add /api/interpret route with Gemini Flash"
```

---

### Task 3: Add agent state and logic to HandTranslator

**Files:**
- Modify: `components/HandTranslator.tsx` (state, refs, functions — no UI yet)

- [ ] **Step 1: Add new refs and state after existing state declarations**

Find this block (around line 23–34):
```typescript
  const lastLabelRef = useRef("Waiting...");
  const stableCountRef = useRef(0);
  const frameWindowRef = useRef<number[][]>([]);
  const initStartedRef = useRef(false);
  const modelInputCompatibleRef = useRef(true);

  const [output, setOutput] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<{ label: string; confidence: number; handCount: number } | null>(null);
  const [debugMode, setDebugMode] = useState(false);
```

Replace with:
```typescript
  const lastLabelRef = useRef("Waiting...");
  const stableCountRef = useRef(0);
  const frameWindowRef = useRef<number[][]>([]);
  const initStartedRef = useRef(false);
  const modelInputCompatibleRef = useRef(true);
  const signQueueRef = useRef<string[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [output, setOutput] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<{ label: string; confidence: number; handCount: number } | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [interpretation, setInterpretation] = useState<{ malay: string; english: string } | null>(null);
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [interpretError, setInterpretError] = useState<string | null>(null);
  const [langMode, setLangMode] = useState<"both" | "malay">("both");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
```

- [ ] **Step 2: Add debounce cleanup to the existing cleanup useEffect**

Find:
```typescript
  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
      cameraStartedRef.current = false;
    };
  }, []);
```

This useEffect may not exist in the current file — if so, add a new one after the existing `useEffect`. If it exists, add the debounce cleanup inside the return:
```typescript
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);
```

- [ ] **Step 3: Add `interpret` and `clearInterpretation` functions before the `return` statement**

Add these two functions after the `onResults` function and before `return (`:

```typescript
  async function interpret() {
    if (signQueueRef.current.length === 0) return;
    setIsInterpreting(true);
    setInterpretError(null);

    const storedKey = typeof window !== "undefined"
      ? localStorage.getItem("gemini_api_key") ?? undefined
      : undefined;

    try {
      const res = await fetch("/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signs: signQueueRef.current, apiKey: storedKey }),
      });
      const result = await res.json();

      if (result.success) {
        setInterpretation({ malay: result.malay, english: result.english });
        setShowApiKeyInput(false);
      } else if (result.error === "No API key configured") {
        setShowApiKeyInput(true);
      } else {
        setInterpretError(result.error ?? "Interpretation failed.");
      }
    } catch {
      setInterpretError("Network error. Check your connection.");
    }

    setIsInterpreting(false);
  }

  function clearInterpretation() {
    signQueueRef.current = [];
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setInterpretation(null);
    setIsInterpreting(false);
    setInterpretError(null);
    setShowApiKeyInput(false);
  }
```

- [ ] **Step 4: Hook sign accumulation into the stable detection path**

Find this block inside `onResults` (around line 162–164):
```typescript
    if (stableCountRef.current >= 5) {
      setOutput(label);
    }
```

Replace with:
```typescript
    if (stableCountRef.current >= 5) {
      setOutput(label);
      if (stableCountRef.current === 5) {
        const queue = signQueueRef.current;
        if (queue.length === 0 || queue[queue.length - 1] !== label) {
          queue.push(label);
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(() => interpret(), 2000);
        }
      }
    }
```

- [ ] **Step 5: Commit**

```bash
git add components/HandTranslator.tsx
git commit -m "feat: add sign queue, debounce, and interpret logic to HandTranslator"
```

---

### Task 4: Add interpretation UI panel

**Files:**
- Modify: `components/HandTranslator.tsx` (JSX only)

- [ ] **Step 1: Add the interpretation panel after the closing `</div>` of the detected sign panel**

Find this closing sequence near the end of the JSX (around line 302):
```typescript
        </div>
      </div>
    </div>
```

The structure is: inner panel `</div>` → `.translator-panel` `</div>` → `.translator-layout` `</div>`.

Insert the new panel **before** the `.translator-panel` closing tag. Replace:
```typescript
        </div>
      </div>
    </div>
```

With:
```typescript
        </div>

        {/* Interpretation panel */}
        {(isInterpreting || interpretation || interpretError || showApiKeyInput) && (
          <div style={{
            background: "var(--glass-bg)",
            border: "1px solid var(--border-2)",
            borderRadius: "var(--radius-lg)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            padding: "24px 32px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)" }}>
                Interpretation
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Language toggle */}
                <div style={{ display: "flex", borderRadius: "var(--radius)", border: "1px solid var(--border-2)", overflow: "hidden", fontSize: 12, fontWeight: 700 }}>
                  {(["both", "malay"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setLangMode(mode)}
                      style={{
                        padding: "5px 12px",
                        background: langMode === mode ? "var(--accent)" : "transparent",
                        color: langMode === mode ? "#0a1628" : "var(--muted)",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontFamily: "var(--font-heading, 'Space Grotesk', sans-serif)",
                        fontSize: 12,
                        transition: "all 150ms ease",
                      }}
                    >
                      {mode === "both" ? "Both" : "Malay"}
                    </button>
                  ))}
                </div>
                {/* Clear button */}
                <button
                  onClick={clearInterpretation}
                  style={{
                    padding: "5px 12px",
                    background: "transparent",
                    border: "1px solid var(--border-2)",
                    borderRadius: "var(--radius)",
                    color: "var(--muted)",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "var(--font-heading, 'Space Grotesk', sans-serif)",
                    transition: "all 150ms ease",
                  }}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Loading */}
            {isInterpreting && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--muted)", fontSize: 14 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Interpreting…
              </div>
            )}

            {/* Result */}
            {!isInterpreting && interpretation && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{
                  fontSize: 24,
                  fontWeight: 700,
                  fontFamily: "var(--font-heading, 'Space Grotesk', sans-serif)",
                  color: "var(--text)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}>
                  {interpretation.malay}
                </div>
                {langMode === "both" && (
                  <div style={{ fontSize: 16, color: "var(--muted)", fontStyle: "italic" }}>
                    {interpretation.english}
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {!isInterpreting && interpretError && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 13, color: "#fca5a5" }}>{interpretError}</span>
                <button
                  onClick={interpret}
                  style={{
                    padding: "5px 12px",
                    background: "transparent",
                    border: "1px solid rgba(239,68,68,0.28)",
                    borderRadius: "var(--radius)",
                    color: "#fca5a5",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "var(--font-heading, 'Space Grotesk', sans-serif)",
                    flexShrink: 0,
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {/* API key input */}
            {showApiKeyInput && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  No Gemini API key found. Get one free at{" "}
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                    aistudio.google.com
                  </a>
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="password"
                    className="input"
                    placeholder="Paste Gemini API key…"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    style={{ flex: 1, fontSize: 13 }}
                  />
                  <button
                    className="btn"
                    style={{ padding: "10px 16px", fontSize: 13, flexShrink: 0 }}
                    onClick={() => {
                      if (!apiKeyInput.trim()) return;
                      localStorage.setItem("gemini_api_key", apiKeyInput.trim());
                      setApiKeyInput("");
                      setShowApiKeyInput(false);
                      interpret();
                    }}
                  >
                    Save & Interpret
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
```

- [ ] **Step 2: Verify the spin animation is defined**

The loading spinner uses `animation: "spin 1s linear infinite"`. This keyframe is defined in `app/train/page.tsx` as an inline `<style>` tag but NOT globally. Add it to `app/globals.css` so it's available in HandTranslator:

In `app/globals.css`, add at the very end:
```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
```

- [ ] **Step 3: Manual smoke test**

1. Run `npm run dev`
2. Open `/translate`
3. Point camera at your hand and sign "Saya" (hold until detected)
4. Sign "Mahu" (hold until detected)
5. Sign "Makan" (hold until detected)
6. Wait 2 seconds with no new sign
7. If no API key in `.env.local`, the API key input should appear
8. Paste a Gemini API key and click "Save & Interpret"
9. Expected: interpretation panel shows "Saya mahu makan" and "I want to eat" (or similar)
10. Click "Clear" — interpretation panel disappears
11. Toggle language to "Malay" — only Malay sentence shows
12. Toggle back to "Both" — both lines show

- [ ] **Step 4: Optionally add API key to `.env.local` for convenience**

Create or update `.env.local` in the project root:
```
GEMINI_API_KEY=your_key_here
```

With this set, the key input will never appear — interpretation fires automatically after the 2-second pause.

- [ ] **Step 5: Commit**

```bash
git add components/HandTranslator.tsx app/globals.css
git commit -m "feat: add interpretation panel UI to HandTranslator"
```
