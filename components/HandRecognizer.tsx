"use client";

import { useEffect, useRef, useState } from "react";
import { extractTwoHandFeatures, SEQUENCE_LENGTH } from "@/lib/handFeatures.js";

declare global {
  interface Window {
    Hands: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
  }
}

export default function HandRecognizer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handsRef = useRef<any>(null);

  const recordingRef = useRef(false);
  const samplesRef = useRef<any[]>([]);
  const frameBufferRef = useRef<number[][]>([]);
  const [currentLabel, setCurrentLabel] = useState("");
  const currentLabelRef = useRef("");
  const [status, setStatus] = useState<{ text: string; type: "idle" | "recording" | "stopped" | "saved" }>(
    { text: "Ready to record", type: "idle" }
  );
  const [sequenceCount, setSequenceCount] = useState(0);
  const [detectedHands, setDetectedHands] = useState(0);
  const detectedHandsRef = useRef(0);

  const cameraStartedRef = useRef(false);
  const initStartedRef = useRef(false);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;
    loadScripts().then(init);
  }, []);

  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
      cameraStartedRef.current = false;
    };
  }, []);

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
    handsRef.current = new window.Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    handsRef.current.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    handsRef.current.onResults(onResults);
    startCamera();
  }

  async function startCamera() {
    if (!videoRef.current || cameraStartedRef.current) return;
    cameraStartedRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
      requestAnimationFrame(processFrame);
    } catch (err) {
      console.error("Camera start failed:", err);
    }
  }

  async function processFrame() {
    if (videoRef.current && handsRef.current) {
      await handsRef.current.send({ image: videoRef.current });
    }
    requestAnimationFrame(processFrame);
  }

  function onResults(results: any) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      updateDetectedHands(0);
      if (recordingRef.current) {
        frameBufferRef.current = [];
      }
      return;
    }

    updateDetectedHands(results.multiHandLandmarks.length);

    for (const landmarks of results.multiHandLandmarks) {
      window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {
        color: "rgba(34,197,94,0.9)",
        lineWidth: 2,
      });
      window.drawLandmarks(ctx, landmarks, {
        color: "rgba(134,239,172,1)",
        lineWidth: 1,
        radius: 3,
      });
    }

    if (recordingRef.current) {
      const { features } = extractTwoHandFeatures(results);
      frameBufferRef.current.push(features);

      if (frameBufferRef.current.length === SEQUENCE_LENGTH) {
        samplesRef.current.push({
          label: currentLabelRef.current,
          sequence: [...frameBufferRef.current],
        });
        frameBufferRef.current = [];
        setSequenceCount(samplesRef.current.length);
      }
    }
  }

  function updateDetectedHands(count: number) {
    if (detectedHandsRef.current === count) return;
    detectedHandsRef.current = count;
    setDetectedHands(count);
  }

  async function saveSessionLabel(label: string) {
    const res = await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    if (!res.ok) throw new Error("Failed to save label");
  }

  const statusColors = {
    idle:      { bg: "var(--surface)",                        border: "var(--border)",                       text: "var(--muted)" },
    recording: { bg: "rgba(239,68,68,0.08)",                  border: "rgba(239,68,68,0.28)",                text: "#fca5a5" },
    stopped:   { bg: "rgba(148,163,184,0.08)",                border: "rgba(148,163,184,0.2)",               text: "var(--muted)" },
    saved:     { bg: "rgba(34,197,94,0.08)",                  border: "rgba(34,197,94,0.25)",                text: "var(--accent)" },
  };

  const colors = statusColors[status.type];

  return (
    <div className="page-layout">
      {/* LEFT PANEL */}
      <div className="label-panel">
        <div>
          <h3>Session Label</h3>
          <input
            className="input"
            type="text"
            placeholder="e.g. HELLO, THANK YOU"
            value={currentLabel}
            onChange={(e) => {
              setCurrentLabel(e.target.value);
              currentLabelRef.current = e.target.value;
            }}
          />
        </div>

        <div>
          <h3>Current Label</h3>
          <div className="label-current">{currentLabel || "—"}</div>
        </div>

        <div className="divider" />

        <div>
          <h3>Status</h3>
          <div style={{
            marginTop: 8,
            padding: "10px 14px",
            borderRadius: "var(--radius)",
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            color: colors.text,
            fontSize: 14,
            fontWeight: 600,
            transition: "all 200ms ease",
          }}>
            {status.text}
          </div>
        </div>

        <div>
          <h3>Detected Hands</h3>
          <div style={{ fontSize: 22, fontWeight: 700, color: detectedHands === 2 ? "var(--accent)" : "var(--muted)", marginTop: 4 }}>
            {detectedHands} / 2
          </div>
          {status.type === "recording" && detectedHands < 2 && (
            <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 6, lineHeight: 1.4 }}>
              Keep both hands visible for BIM samples.
            </div>
          )}
        </div>

        {samplesRef.current.length > 0 && (
          <div>
            <h3>Sequences Captured</h3>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)", marginTop: 4 }}>
              {sequenceCount}
            </div>
          </div>
        )}
      </div>

      {/* MAIN CONTENT */}
      <div className="main-content">
        <div className={`camera-wrapper ${status.type === "recording" ? "active" : ""}`} style={{ width: 640, height: 480 }}>
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
          {status.type === "recording" && (
            <div style={{
              position: "absolute",
              top: 14,
              right: 14,
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "rgba(239,68,68,0.9)",
              color: "#fff",
              padding: "5px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}>
              <span style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#fff",
                animation: "pulse-dot 1s ease-in-out infinite",
              }} />
              REC
            </div>
          )}
        </div>

        <div className="button-group">
          <button
            className="btn"
            onClick={async () => {
              if (!currentLabel) {
                alert("Please enter a label before recording.");
                return;
              }
              try {
                await saveSessionLabel(currentLabel.trim());
              } catch {
                alert("Failed to save label");
                return;
              }
              samplesRef.current = [];
              frameBufferRef.current = [];
              setSequenceCount(0);
              recordingRef.current = true;
              setStatus({ text: "Recording…", type: "recording" });
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="12" r="8" />
            </svg>
            Start Recording
          </button>

          <button
            className="btn btn-danger"
            onClick={() => {
              recordingRef.current = false;
              setStatus({ text: `Stopped — ${samplesRef.current.length} sequences`, type: "stopped" });
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            Stop Recording
          </button>

          <button
            className="btn btn-ghost"
            onClick={async () => {
              if (samplesRef.current.length === 0) {
                alert("No data to save.");
                return;
              }

              const res = await fetch("/api/save-dataset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(samplesRef.current),
              });

              if (res.ok) {
                setStatus({ text: `Saved ${samplesRef.current.length} sequences`, type: "saved" });
              } else {
                alert("Failed to save dataset");
              }
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            Save Dataset
          </button>
        </div>
      </div>
    </div>
  );
}
