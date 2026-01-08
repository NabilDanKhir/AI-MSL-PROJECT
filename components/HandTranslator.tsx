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

  const [output, setOutput] = useState("Waiting...");

  /* ---------------- INIT ---------------- */

  useEffect(() => {
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
    await load(
      "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"
    );
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

  /* ---------------- CAMERA ---------------- */

  async function startCamera() {
    if (!videoRef.current) return;

    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoRef.current.srcObject = stream;
    await videoRef.current.play();

    requestAnimationFrame(processFrame);
  }

  async function processFrame() {
    if (videoRef.current && handsRef.current) {
      await handsRef.current.send({ image: videoRef.current });
    }
    requestAnimationFrame(processFrame);
  }

  /* ---------------- RESULTS ---------------- */

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

  // We only track ONE hand
  const landmarks = results.multiHandLandmarks[0];

    // ---------- NORMALIZATION ----------
    const base = landmarks[0]; // wrist
    const flat = landmarks.flatMap((p: any) => [
      p.x - base.x,
      p.y - base.y,
      p.z - base.z,
    ]);

    // ---------- MODEL PREDICTION ----------
    const input = tf.tensor([flat]);
    const pred = modelRef.current.predict(input) as tf.Tensor;
    const scores = Array.from(pred.dataSync());
    tf.dispose([input, pred]);

    // ---------- CONFIDENCE THRESHOLD ----------
    const maxScore = Math.max(...scores);
    const index = scores.indexOf(maxScore);
    const CONFIDENCE_THRESHOLD = 0.85;

    const label = LABELS[index];

    // reject low confidence
    if (maxScore < CONFIDENCE_THRESHOLD || label === "UNKNOWN") {
      stableCountRef.current = 0;
      setOutput("");
      return;
    }

    // ---------- TEMPORAL STABILITY ----------
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

  /* ---------------- UI ---------------- */

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "relative", width: 640 }}>
        <video ref={videoRef} width={640} playsInline muted />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          style={{ position: "absolute", top: 0, left: 0 }}
        />
      </div>

      <h2 style={{ marginTop: 16, fontSize: 32 }}>{output || "Waiting"}</h2>
    </div>
  );
}
