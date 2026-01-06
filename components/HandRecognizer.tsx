"use client";

import { useEffect, useRef, useState } from "react";
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
  const currentLabel = "REST";

  const [status, setStatus] = useState("Waiting...");

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
  await load("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js");
}

  async function init() {
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

    if (!results.multiHandLandmarks) return;

    for (const landmarks of results.multiHandLandmarks) {
        window.drawConnectors(
        ctx,
        landmarks,
        window.HAND_CONNECTIONS,
        { color: "#00FF00", lineWidth: 2 }
        );

        window.drawLandmarks(
        ctx,
        landmarks,
        { color: "#FF0000", lineWidth: 1 }
        );
      
      if (recordingRef.current) {
        samplesRef.current.push({
          label: currentLabel,
          landmarks: landmarks.flatMap((p) => [p.x, p.y, p.z]),
        });
      }
    }
  }

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

      <h3>{status}</h3>

      <button
        onClick={() => {
          recordingRef.current = true;
          setStatus("Recording...");
        }}
      >
        Start Recording
      </button>

      <button
        onClick={() => {
          recordingRef.current = false;
          setStatus("Stopped");
        }}
      >
        Stop Recording
      </button>

      <button
        onClick={() => {
          console.log("Samples:", samplesRef.current.length);
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
