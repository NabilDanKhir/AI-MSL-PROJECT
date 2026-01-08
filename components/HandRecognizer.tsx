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
  const [currentLabel, setCurrentLabel] = useState("");
  const currentLabelRef = useRef("");
  const [status, setStatus] = useState("Waiting...");

  const cameraStartedRef = useRef(false);


  /* =========================
     INIT (ORIGINAL BEHAVIOUR)
     ========================= */
  useEffect(() => {
    loadScripts().then(init);
  }, []);

  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
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
    await load(
      "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"
    );
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
    if (cameraStartedRef.current) return;

    cameraStartedRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;

      await videoRef.current.play().catch(() => {
        // AbortError is safe to ignore
      });

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
          label: currentLabelRef.current,
          landmarks: landmarks.flatMap((p: any) => [p.x, p.y, p.z]),
        });
      }
    }
  }

  /* =========================
     SESSION LABEL SAVE (FIX)
     ========================= */
  async function saveSessionLabel(label: string) {
    const res = await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });

    if (!res.ok) {
      throw new Error("Failed to save label");
    }
  }

  return (
    <div className="page-layout">
      {/* LEFT PANEL */}
      <div className="label-panel">
        <h3>Session Label</h3>

        <input
          type="text"
          placeholder="e.g. HELLO, THANK YOU"
          value={currentLabel}
          onChange={(e) => {
            setCurrentLabel(e.target.value);
            currentLabelRef.current = e.target.value;
          }}
        />

        <p>
          Current label:
          <br />
          <strong>{currentLabel || "—"}</strong>
        </p>
      </div>

      {/* MAIN CONTENT */}
      <div className="main-content">
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

              recordingRef.current = true;
              setStatus("Recording...");
            }}
          >
            Start Recording
          </button>

          <button
            className="btn"
            onClick={() => {
              recordingRef.current = false;
              setStatus("Stopped");
            }}
          >
            Stop Recording
          </button>

          <button
            className="btn"
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

              alert(
                res.ok
                  ? "Dataset saved to dataset_dirty.json"
                  : "Failed to save dataset"
              );
            }}
          >
            Save Dataset
          </button>
        </div>
      </div>
    </div>
  );
}
