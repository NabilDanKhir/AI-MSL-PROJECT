"use client";

import { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import { LABELS } from "@/lib/labels";

declare global {
  interface Window {
    Hands: any;
  }
}

export default function HandRecognizer() {
  const [recording, setRecording] = useState(false);
  const samplesRef = useRef<any[]>([]);
  const currentLabel = "HELLO"; // change later

  const videoRef = useRef<HTMLVideoElement>(null);
  const modelRef = useRef<tf.LayersModel | null>(null);
  const handsRef = useRef<any>(null);
  const [prediction, setPrediction] = useState("Waiting...");

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
  }

  async function init() {
    // Model loading disabled for now
    // modelRef.current = await tf.loadLayersModel("/model/model.json");

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

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
    });

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

  function onResults(results: any) {
    if (!results.multiHandLandmarks) return;

    const landmarks = results.multiHandLandmarks[0].flatMap(
        (p: any) => [p.x, p.y, p.z]
    );

    if (recording) {
        samplesRef.current.push({
        label: currentLabel,
        landmarks,
        });
    }

    setPrediction(recording ? "Recording..." : "Detected");
  }

  return (
    <div style={{ textAlign: "center" }}>
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ width: 640, borderRadius: 8 }}
      />
      <h2>{prediction}</h2>

      {/* Controls */}
      <button onClick={() => setRecording(true)}>Start Recording</button>
      <button onClick={() => setRecording(false)}>Stop Recording</button>

      <button
        onClick={() => {
            const blob = new Blob(
            [JSON.stringify(samplesRef.current, null, 2)],
            { type: "application/json" }
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "dataset.json";
            a.click();
        }}
        >
        Download Dataset
        </button>

    </div>
  );
}
