"use client";

import { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import LABELS from "@/lib/labels.json";
import { SignAgent } from "@/lib/agent";
import { extractTwoHandFeatures, HAND_FEATURE_COUNT, SEQUENCE_LENGTH } from "@/lib/handFeatures.js";
import { parseTranslationCorrection, saveTranslationFeedback } from "@/lib/translationFeedback";

type HandLandmark = {
  x: number;
  y: number;
  z?: number;
};

type HandResults = {
  multiHandLandmarks?: HandLandmark[][];
};

type MediaPipeHands = {
  setOptions: (options: {
    maxNumHands: number;
    modelComplexity: number;
    minDetectionConfidence: number;
    minTrackingConfidence: number;
  }) => void;
  onResults: (callback: (results: HandResults) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void> | void;
};

type MediaPipeHandsConstructor = new (config: { locateFile: (file: string) => string }) => MediaPipeHands;

export default function HandTranslator() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handsRef = useRef<MediaPipeHands | null>(null);
  const modelRef = useRef<tf.LayersModel | null>(null);

  const lastLabelRef = useRef("Waiting...");
  const stableCountRef = useRef(0);
  const frameWindowRef = useRef<number[][]>([]);
  const initStartedRef = useRef(false);
  const modelInputCompatibleRef = useRef(true);
  const signQueueRef = useRef<string[]>([]);
  const agentRef = useRef<SignAgent | null>(null);
  const mountedRef = useRef(true);

  const [output, setOutput] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<{ label: string; confidence: number; handCount: number } | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [interpretation, setInterpretation] = useState<{ malay: string; english: string } | null>(null);
  const [langMode, setLangMode] = useState<"both" | "malay">("both");
  const [signBuffer, setSignBuffer] = useState<string[]>([]);
  const [lastInterpretedSigns, setLastInterpretedSigns] = useState<string[]>([]);
  const [correctionText, setCorrectionText] = useState("");
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  async function loadScripts() {
    const load = (src: string) =>
      new Promise<void>((resolve) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        document.body.appendChild(script);
      });

    await load("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js");
    await load("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js");
  }

  async function init() {
    modelRef.current = await tf.loadLayersModel("/model/model.json");
    const inputShape = modelRef.current.inputs[0]?.shape ?? [];
    const featureCount = inputShape[inputShape.length - 1];
    modelInputCompatibleRef.current = featureCount === HAND_FEATURE_COUNT;
    if (!modelInputCompatibleRef.current) {
      setModelError(
        `Current model expects ${featureCount ?? "unknown"} features per frame. Retrain with ${HAND_FEATURE_COUNT}-feature two-hand data.`
      );
    }

    const Hands = window.Hands as MediaPipeHandsConstructor;
    const hands = new Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    hands.onResults(onResults);
    handsRef.current = hands;
    startCamera();
  }

  async function startCamera() {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setIsReady(true);
      requestAnimationFrame(processFrame);
    } catch (err) {
      console.error("Camera start failed:", err);
      setCameraError("Camera access denied or unavailable.");
    }
  }

  async function processFrame() {
    if (!mountedRef.current) return;
    if (videoRef.current && handsRef.current) {
      await handsRef.current.send({ image: videoRef.current });
    }
    if (mountedRef.current) requestAnimationFrame(processFrame);
  }

  function onResults(results: HandResults) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      frameWindowRef.current = [];
      stableCountRef.current = 0;
      setOutput("");
      setDebugInfo(null);
      agentRef.current?.update(null);
      return;
    }

    const { features, handCount } = extractTwoHandFeatures(results);

    frameWindowRef.current.push(features);
    if (frameWindowRef.current.length > SEQUENCE_LENGTH) {
      frameWindowRef.current.shift();
    }

    if (frameWindowRef.current.length !== SEQUENCE_LENGTH) return;
    if (!modelInputCompatibleRef.current) return;

    let scores: number[];
    try {
      const input = tf.tensor3d([frameWindowRef.current], [1, SEQUENCE_LENGTH, HAND_FEATURE_COUNT]);
      const pred = modelRef.current!.predict(input) as tf.Tensor;
      scores = Array.from(pred.dataSync());
      tf.dispose([input, pred]);
    } catch (e) {
      console.error("[predict]", e);
      return;
    }

    const maxScore = Math.max(...scores);
    const index = scores.indexOf(maxScore);
    const CONFIDENCE_THRESHOLD = 0.85;
    const label = LABELS[index];

    setDebugInfo({ label, confidence: maxScore, handCount });

    if (maxScore < CONFIDENCE_THRESHOLD || label === "UNKNOWN") {
      stableCountRef.current = 0;
      setOutput("");
      agentRef.current?.update(null);
      return;
    }

    if (label === lastLabelRef.current) {
      stableCountRef.current++;
    } else {
      stableCountRef.current = 1;
      lastLabelRef.current = label;
    }

    if (stableCountRef.current >= 5) {
      setOutput(label);
      if (stableCountRef.current === 5) {
        const q = signQueueRef.current;
        if (q.length === 0 || q[q.length - 1] !== label) {
          signQueueRef.current.push(label);
        }
        agentRef.current?.update(label);
      }
    }
  }

  function clearInterpretation() {
    signQueueRef.current = [];
    agentRef.current?.reset();
    setInterpretation(null);
    setLastInterpretedSigns([]);
    setCorrectionText("");
    setFeedbackSaved(false);
  }

  function saveCorrection() {
    if (!interpretation || lastInterpretedSigns.length === 0 || !parseTranslationCorrection(correctionText)) return;

    saveTranslationFeedback({
      signs: lastInterpretedSigns,
      generated: interpretation,
      correction: correctionText,
    });
    setCorrectionText("");
    setFeedbackSaved(true);
  }

  const correctionIsValid = parseTranslationCorrection(correctionText) !== null;

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;
    loadScripts().then(init);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    agentRef.current = new SignAgent(
      (result, signs) => {
        if (!mountedRef.current) return;
        setInterpretation(result);
        setLastInterpretedSigns(signs);
        setCorrectionText("");
        setFeedbackSaved(false);
      },
      (buffer) => {
        if (mountedRef.current) setSignBuffer(buffer);
      }
    );

    return () => {
      const video = videoRef.current;

      mountedRef.current = false;
      agentRef.current?.reset();
      if (video?.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        video.srcObject = null;
      }
    };
  }, []);

  return (
    <div className="translator-layout">
      {/* Camera — fixed width column */}
      <div className={`camera-wrapper ${isReady ? "active" : ""}`} style={{ width: 640, height: 480, flexShrink: 0 }}>
        <video
          ref={videoRef}
          width={640}
          height={480}
          playsInline
          muted
          style={{ display: "block" }}
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          style={{ position: "absolute", top: 0, left: 0 }}
        />
      </div>

      {/* Right panel */}
      <div className="translator-panel">
        {cameraError && (
          <div style={{
            padding: "12px 16px",
            borderRadius: "var(--radius)",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.28)",
            color: "#fca5a5",
            fontSize: 14,
            fontWeight: 600,
          }}>
            {cameraError}
          </div>
        )}

        {modelError && (
          <div style={{
            padding: "12px 16px",
            borderRadius: "var(--radius)",
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.28)",
            color: "#fbbf24",
            fontSize: 14,
            fontWeight: 600,
          }}>
            {modelError}
          </div>
        )}

        <div style={{
          background: "var(--glass-bg)",
          border: "1px solid var(--border-2)",
          borderRadius: "var(--radius-lg)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          padding: "24px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)" }}>
          Detected Sign
        </span>
        <div style={{
          fontSize: output ? 52 : 28,
          fontWeight: 700,
          fontFamily: "var(--font-heading, 'Space Grotesk', sans-serif)",
          color: output ? "var(--accent)" : "var(--muted)",
          letterSpacing: output ? "-0.03em" : "0",
          transition: "all 200ms ease",
          minHeight: 64,
          lineHeight: 1.1,
        }}>
          {output || (isReady ? "Show a sign…" : "Loading model…")}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
          {output ? (
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              Hold steadily for stable detection
            </span>
          ) : <span />}

          <button
            onClick={() => setDebugMode((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              fontSize: 12,
              color: "var(--muted)",
              userSelect: "none",
            }}
            aria-pressed={debugMode}
          >
            <span style={{
              width: 32,
              height: 18,
              borderRadius: 999,
              background: debugMode ? "var(--accent)" : "var(--border)",
              position: "relative",
              display: "inline-block",
              transition: "background 150ms ease",
              flexShrink: 0,
            }}>
              <span style={{
                position: "absolute",
                top: 3,
                left: debugMode ? 17 : 3,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 150ms ease",
              }} />
            </span>
            Debug mode
          </button>
        </div>

        {debugMode && debugInfo && (
          <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "monospace" }}>
            hands: <span style={{ color: "var(--text)" }}>{debugInfo.handCount}/2</span>
            {" · "}
            top: <span style={{ color: "var(--text)" }}>{debugInfo.label}</span>
            {" · "}
            <span style={{ color: debugInfo.confidence >= 0.85 ? "var(--accent)" : "#fca5a5" }}>
              {(debugInfo.confidence * 100).toFixed(1)}%
            </span>
          </span>
        )}
        </div>

        {(signBuffer.length > 0 || interpretation) && (
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
                      type="button"
                      aria-pressed={langMode === mode}
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
                  type="button"
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

            {signBuffer.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {signBuffer.map((sign, index) => (
                  <span
                    key={`${sign}-${index}`}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border-2)",
                      color: "var(--text)",
                      background: "rgba(255,255,255,0.04)",
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: "var(--font-heading, 'Space Grotesk', sans-serif)",
                    }}
                  >
                    {sign}
                  </span>
                ))}
              </div>
            )}

            {/* Result */}
            {interpretation && (
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

            {interpretation && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label
                  htmlFor="translation-correction"
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                    fontWeight: 700,
                  }}
                >
                  Not accurate translation? Write it
                </label>
                <textarea
                  id="translation-correction"
                  value={correctionText}
                  onChange={(event) => {
                    setCorrectionText(event.target.value);
                    setFeedbackSaved(false);
                  }}
                  placeholder="Malay correction | English correction"
                  rows={3}
                  style={{
                    width: "100%",
                    resize: "vertical",
                    minHeight: 72,
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border-2)",
                    background: "rgba(255,255,255,0.04)",
                    color: "var(--text)",
                    padding: "10px 12px",
                    fontSize: 13,
                    fontFamily: "inherit",
                    lineHeight: 1.4,
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 12, color: feedbackSaved ? "var(--accent)" : "var(--muted)" }}>
                    {feedbackSaved ? "Saved for future translation training." : "Use: Malay correction | English correction"}
                  </span>
                  <button
                    type="button"
                    onClick={saveCorrection}
                    disabled={!correctionIsValid}
                    style={{
                      padding: "6px 12px",
                      background: correctionIsValid ? "var(--accent)" : "transparent",
                      border: "1px solid var(--border-2)",
                      borderRadius: "var(--radius)",
                      color: correctionIsValid ? "#0a1628" : "var(--muted)",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: correctionIsValid ? "pointer" : "not-allowed",
                      fontFamily: "var(--font-heading, 'Space Grotesk', sans-serif)",
                      flexShrink: 0,
                    }}
                  >
                    Save correction
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
