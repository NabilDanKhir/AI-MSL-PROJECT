# Sign Interpretation Agent — Design Spec
Date: 2026-05-08

## Overview

Add an AI interpretation agent to the `/translate` page. As the user signs, detected signs accumulate silently. After a 2-second pause with no new sign, the accumulated signs are sent to Google Gemini Flash, which returns a natural Malay sentence and its English translation displayed below the detected sign panel.

This satisfies the "agent-based" requirement of the project: the LLM acts as a language agent that understands MSL sign order and reconstructs grammatically natural sentences.

---

## Architecture

### New file: `app/api/interpret/route.ts`
- `POST` handler
- Accepts `{ signs: string[], apiKey?: string }`
- API key resolution order:
  1. `process.env.GEMINI_API_KEY` (`.env.local`)
  2. `apiKey` from request body (UI-provided, stored in `localStorage`)
  3. Neither → `{ success: false, error: "No API key configured" }`
- Calls `gemini-1.5-flash` via `@google/generative-ai` SDK
- Prompt instructs Gemini to return strict JSON `{ malay: string, english: string }`
- Returns `{ success: true, malay, english }` or `{ success: false, error }`

### Modified file: `components/HandTranslator.tsx`
No changes to the existing LSTM detection pipeline. Additions only:
- `signQueueRef` — accumulates distinct consecutive signs
- `debounceTimerRef` — 2s timeout ref, reset on each new sign
- `interpretation` state — `{ malay: string, english: string } | null`
- `isInterpreting` state — loading flag while Gemini responds
- `langMode` state — `"both" | "malay"`, default `"both"`
- `interpret()` — POSTs to `/api/interpret`, updates `interpretation`
- **Clear** resets `signQueueRef`, cancels timer, clears `interpretation`

### New dependency
`@google/generative-ai` — official Google Generative AI SDK

### API key UI
A small settings section in the interpreter panel: if `interpretation` fails with "No API key configured", an inline input appears for the user to paste their Gemini API key. On save, stored in `localStorage` as `gemini_api_key` and used in subsequent requests.

---

## UI Layout

```
┌──────────────────────────────────────────┐
│  DETECTED SIGN           [Debug mode ○]  │
│  SAYA                                    │
│  Hold steadily for stable detection      │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  INTERPRETATION      [Both ●] [Malay ○]  │
│                            [Clear]       │
│                                          │
│  Saya mahu makan                         │
│  I want to eat                           │
└──────────────────────────────────────────┘
```

- Interpretation panel is hidden until the first result arrives
- Loading state (subtle spinner/pulse) while Gemini is responding
- Error state if Gemini call fails or no API key is set
- Language toggle: **Both** shows Malay + English, **Malay** shows Malay only

---

## Data Flow

```
onResults() detects stable sign
  → different from last sign in queue? (dedup)
      → push to signQueueRef[]
      → clear existing debounce timer
      → start new 2s debounce timer
          → timer fires → interpret()

interpret()
  → if signQueueRef is empty, return early
  → setIsInterpreting(true)
  → POST /api/interpret { signs, apiKey? }
  → on success: setInterpretation({ malay, english })
  → on failure: show error in panel
  → setIsInterpreting(false)

Clear button
  → signQueueRef.current = []
  → clearTimeout(debounceTimerRef.current)
  → setInterpretation(null)
  → setIsInterpreting(false)
```

---

## Gemini Prompt

```
You are an interpreter for Malaysian Sign Language (MSL / Bahasa Isyarat Malaysia).

The user has signed the following words in order: {signs joined by ", "}.

Your task:
1. Form the most natural Malay sentence from these signs.
2. Translate that sentence into English.

Rules:
- Do not add words that were not signed unless they are grammatical particles with no sign equivalent.
- Keep the output concise.
- Reply ONLY with valid JSON in this exact format, no markdown:
{"malay": "...", "english": "..."}
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| No API key | Panel shows inline key input field |
| Gemini API error | Panel shows "Interpretation failed. Try again." with retry button |
| Empty sign queue on timer fire | `interpret()` returns early, no request made |
| Network offline | Same as Gemini API error |
| Response not valid JSON | Caught, treated as API error |

---

## Out of Scope

- Streaming / typewriter effect (not needed for short sentences)
- Sign queue visible to user (accumulation is silent)
- Conversation history / multi-turn context (each interpretation is independent)
- Swapping in Claude API (deferred to deployment phase)
