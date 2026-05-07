"use client";

import { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import LABELS from "@/lib/labels.json";

declare global {
  interface Window {
    Hands: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
  }
}

export default function HandTranslator() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handsRef = useRef<any>(null);
  const modelRef = useRef<tf.LayersModel | null>(null);

  const lastLabelRef = useRef("Waiting...");
  const stableCountRef = useRef(0);
  const initStartedRef = useRef(false);

  const [output, setOutput] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;
    loadScripts().then(init);
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
    modelRef.current = await tf.loadLayersModel("/model/model.json");

    handsRef.current = new window.Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    handsRef.current.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    handsRef.current.onResults(onResults);
    startCamera();
  }

  async function startCamera() {
    if (!videoRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
    setIsReady(true);
    requestAnimationFrame(processFrame);
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
      stableCountRef.current = 0;
      setOutput("");
      return;
    }

    const landmarks = results.multiHandLandmarks[0];

    window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {
      color: "rgba(34,197,94,0.9)",
      lineWidth: 2,
    });
    window.drawLandmarks(ctx, landmarks, {
      color: "rgba(134,239,172,1)",
      lineWidth: 1,
      radius: 3,
    });

    const base = landmarks[0];
    const flat = landmarks.flatMap((p: any) => [
      p.x - base.x,
      p.y - base.y,
      p.z - base.z,
    ]);

    const input = tf.tensor([flat]);
    const pred = modelRef.current!.predict(input) as tf.Tensor;
    const scores = Array.from(pred.dataSync());
    tf.dispose([input, pred]);

    const maxScore = Math.max(...scores);
    const index = scores.indexOf(maxScore);
    const CONFIDENCE_THRESHOLD = 0.85;
    const label = LABELS[index];

    if (maxScore < CONFIDENCE_THRESHOLD || label === "UNKNOWN") {
      stableCountRef.current = 0;
      setOutput("");
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
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <div className={`camera-wrapper ${isReady ? "active" : ""}`} style={{ width: 640, height: 480 }}>
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

      <div style={{
        width: 640,
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
        {output && (
          <span style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            Hold steadily for stable detection
          </span>
        )}
      </div>
    </div>
  );
}
