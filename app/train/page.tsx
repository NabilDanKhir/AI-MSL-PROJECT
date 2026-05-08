"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import * as tf from "@tensorflow/tfjs";
import LABELS from "@/lib/labels.json";
import { HAND_FEATURE_COUNT, SEQUENCE_LENGTH } from "@/lib/handFeatures.js";
import "./train.css";

const NUM_CLASSES = LABELS.length;

type EpochMetrics = { epoch: number; loss: number; acc: number; val_loss: number; val_acc: number };

export default function TrainPage() {
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileOutput, setCompileOutput] = useState("");
  const [compileStatus, setCompileStatus] = useState<"idle" | "success" | "error">("idle");

  const [progress, setProgress] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const [liveMetrics, setLiveMetrics] = useState<EpochMetrics | null>(null);
  const [epochLog, setEpochLog] = useState<EpochMetrics[]>([]);

  const modelRef = useRef<tf.LayersModel | null>(null);

  async function compile() {
    setIsCompiling(true);
    setCompileOutput("");
    setCompileStatus("idle");

    const res = await fetch("/api/compile", { method: "POST" });
    const result = await res.json();

    setCompileOutput(result.output ?? "");
    setCompileStatus(result.success ? "success" : "error");
    setIsCompiling(false);
  }

  async function train() {
    setStatusMsg("");
    setIsTraining(true);
    setProgress(0);
    setLiveMetrics(null);
    setEpochLog([]);

    const res = await fetch("/dataset_clean.json");
    if (!res.ok) {
      setStatusMsg("error:dataset_clean.json not found. Run balance.py first.");
      setIsTraining(false);
      return;
    }

    const dataset = await res.json();

    if (!Array.isArray(dataset) || dataset.length === 0) {
      setStatusMsg("error:dataset_clean.json is empty. Record and clean data first.");
      setIsTraining(false);
      return;
    }

    await tf.setBackend("cpu");
    await tf.ready();

    const labelToIndex = Object.fromEntries(
      LABELS.map((label, i) => [label, i])
    );

    const invalidLabels = dataset
      .map((d: any) => d.label)
      .filter((l: string) => !(l in labelToIndex));

    if (invalidLabels.length > 0) {
      console.error("Invalid labels found:", new Set(invalidLabels));
      setStatusMsg("error:Dataset contains labels not in labels.json");
      setIsTraining(false);
      return;
    }

    const xs = tf.tensor3d(
      dataset.map((d: any) => d.sequence),
      [dataset.length, SEQUENCE_LENGTH, HAND_FEATURE_COUNT]
    );

    const ys = tf.oneHot(
      tf.tensor1d(dataset.map((d: any) => labelToIndex[d.label]), "int32"),
      NUM_CLASSES
    );

    const model = tf.sequential();
    model.add(tf.layers.lstm({ inputShape: [SEQUENCE_LENGTH, HAND_FEATURE_COUNT], units: 64, returnSequences: false }));
    model.add(tf.layers.dense({ units: 64, activation: "relu" }));
    model.add(tf.layers.dropout({ rate: 0.3 }));
    model.add(tf.layers.dense({ units: NUM_CLASSES, activation: "softmax" }));

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "categoricalCrossentropy",
      metrics: ["accuracy"],
    });

    const EPOCHS = 100;
    const PATIENCE = 10;
    let bestValLoss = Infinity;
    let bestWeights: tf.Tensor[] | null = null;
    let patienceCounter = 0;

    await model.fit(xs, ys, {
      epochs: EPOCHS,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          await tf.nextFrame();
          const percent = Math.round(((epoch + 1) / EPOCHS) * 100);
          setProgress(percent);

          if (!logs?.val_loss) return;

          const entry: EpochMetrics = {
            epoch: epoch + 1,
            loss: logs.loss ?? 0,
            acc: logs.acc ?? 0,
            val_loss: logs.val_loss ?? 0,
            val_acc: logs.val_acc ?? 0,
          };
          setLiveMetrics(entry);
          setEpochLog((prev) => [...prev, entry]);

          if (logs.val_loss < bestValLoss) {
            bestValLoss = logs.val_loss;
            patienceCounter = 0;
            if (bestWeights) bestWeights.forEach((w) => w.dispose());
            bestWeights = model.getWeights().map((w) => w.clone());
          } else {
            patienceCounter++;
          }

          if (patienceCounter >= PATIENCE) {
            model.stopTraining = true;
          }
        },

        onTrainEnd: async () => {
          if (bestWeights) model.setWeights(bestWeights);
          modelRef.current = model;
          setProgress(100);
          setStatusMsg("saving:Saving model...");
          await saveModel(model);
        },
      },
    });

    tf.dispose([xs, ys]);
    setIsTraining(false);
  }

  async function saveModel(model: tf.LayersModel) {
    try {
      let modelJSON: any = null;
      let weightsBase64 = "";

      await model.save({
        save: async (modelArtifacts) => {
          modelJSON = {
            modelTopology: modelArtifacts.modelTopology,
            format: "layers-model",
            generatedBy: "TensorFlow.js tfjs-layers v4.22.0",
            convertedBy: null,
            weightsManifest: [
              {
                paths: ["./model.weights.bin"],
                weights: modelArtifacts.weightSpecs,
              },
            ],
          };

          const uint8 = new Uint8Array(modelArtifacts.weightData as ArrayBuffer);
          let binary = "";
          const CHUNK = 8192;
          for (let i = 0; i < uint8.length; i += CHUNK) {
            binary += String.fromCharCode(...uint8.subarray(i, i + CHUNK));
          }
          weightsBase64 = btoa(binary);

          return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: "JSON" } };
        },
      });

      const res = await fetch("/api/save-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelJSON, weightsBase64 }),
      });

      const result = await res.json();

      if (result.success) {
        setStatusMsg("success:Model saved! public/model/ has been updated.");
      } else {
        setStatusMsg(`error:${result.error}`);
      }
    } catch (err) {
      console.error("[saveModel]", err);
      setStatusMsg("error:Failed to serialize or save model.");
    }
  }

  const statusType = statusMsg.startsWith("success:")
    ? "success"
    : statusMsg.startsWith("error:")
    ? "error"
    : "info";
  const statusText = statusMsg.includes(":") ? statusMsg.split(":").slice(1).join(":") : statusMsg;

  return (
    <div className="page-container">
      <nav className="topbar">
        <Link href="/" className="btn-back" aria-label="Back to home">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M5 12l7-7M5 12l7 7" />
          </svg>
          Back
        </Link>
        <span className="topbar-title">Train Model</span>
        <span className="topbar-logo">BIM</span>
      </nav>

      <main className="train-main">
        <div className="train-layout">
        <div className="train-card">
          <div className="train-header">
            <h1 className="train-title">Train MSL Model</h1>
            <p className="train-desc">
              Trains a neural network on your recorded dataset using TensorFlow.js.
              Early stopping is applied automatically.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              className="btn btn-ghost"
              onClick={compile}
              disabled={isCompiling || isTraining}
              style={{ width: "100%", padding: "13px" }}
              aria-label={isCompiling ? "Compiling dataset" : "Compile dataset"}
            >
              {isCompiling ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Compiling…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  Compile Dataset
                </>
              )}
            </button>

            {compileOutput && (
              <div style={{
                background: "var(--surface)",
                border: `1px solid ${compileStatus === "success" ? "rgba(34,197,94,0.25)" : compileStatus === "error" ? "rgba(239,68,68,0.28)" : "var(--border)"}`,
                borderRadius: "var(--radius)",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: compileStatus === "success" ? "var(--accent)" : compileStatus === "error" ? "#fca5a5" : "var(--muted)",
                }}>
                  {compileStatus === "success" ? "Compiled — dataset_clean.json saved to public/" : compileStatus === "error" ? "Compile failed" : "Output"}
                </span>
                <pre style={{
                  margin: 0,
                  fontSize: 12,
                  fontFamily: "monospace",
                  color: "var(--muted)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: 160,
                  overflowY: "auto",
                }}>
                  {compileOutput}
                </pre>
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--border)", margin: "0 -4px" }} />

          <button
            className="btn"
            onClick={train}
            disabled={isTraining}
            style={{ width: "100%", padding: "13px" }}
            aria-label={isTraining ? "Training in progress" : "Start training"}
          >
            {isTraining ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ animation: "spin 1s linear infinite" }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Training...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 3l14 9-14 9V3z" />
                </svg>
                Train Model
              </>
            )}
          </button>

          {(isTraining || progress > 0) && (
            <div className="train-progress-section">
              <div className="train-progress-label">
                <span>Progress</span>
                <span className="train-progress-pct">{progress}%</span>
              </div>
              <div className="progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {statusText && (
            <div className={`train-status ${statusType}`} role="status" aria-live="polite">
              {statusText}
            </div>
          )}
        </div>

        {/* Metrics panel — right column on desktop */}
        {(isTraining || liveMetrics) && (
          <div className="train-metrics-panel">
            <p className="train-metrics-title">Live Metrics</p>

            {liveMetrics ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {([
                    { key: "loss",     label: "Loss",     value: liveMetrics.loss,     bad: true  },
                    { key: "acc",      label: "Accuracy", value: liveMetrics.acc,      bad: false },
                    { key: "val_loss", label: "Val Loss", value: liveMetrics.val_loss, bad: true  },
                    { key: "val_acc",  label: "Val Acc",  value: liveMetrics.val_acc,  bad: false },
                  ]).map(({ key, label, value, bad }) => (
                    <div key={key} style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      padding: "12px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>
                        {label}
                      </span>
                      <span style={{
                        fontSize: 24,
                        fontWeight: 700,
                        fontFamily: "var(--font-heading, 'Space Grotesk', sans-serif)",
                        color: bad ? "#fca5a5" : "var(--accent)",
                      }}>
                        {key === "acc" || key === "val_acc"
                          ? `${(value * 100).toFixed(1)}%`
                          : value.toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>

                {epochLog.length > 0 && (
                  <div style={{
                    flex: 1,
                    overflowY: "auto",
                    maxHeight: 340,
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    fontSize: 12,
                    fontFamily: "monospace",
                  }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "var(--surface)", position: "sticky", top: 0 }}>
                          {["Epoch", "Loss", "Acc", "Val Loss", "Val Acc"].map((h) => (
                            <th key={h} style={{ padding: "7px 12px", textAlign: "right", color: "var(--muted)", fontWeight: 700, borderBottom: "1px solid var(--border)" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...epochLog].reverse().map((row) => (
                          <tr key={row.epoch} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "6px 12px", textAlign: "right", color: "var(--muted)" }}>{row.epoch}</td>
                            <td style={{ padding: "6px 12px", textAlign: "right", color: "#fca5a5" }}>{row.loss.toFixed(4)}</td>
                            <td style={{ padding: "6px 12px", textAlign: "right", color: "var(--accent)" }}>{(row.acc * 100).toFixed(1)}%</td>
                            <td style={{ padding: "6px 12px", textAlign: "right", color: "#fca5a5" }}>{row.val_loss.toFixed(4)}</td>
                            <td style={{ padding: "6px 12px", textAlign: "right", color: "var(--accent)" }}>{(row.val_acc * 100).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "right" }}>
                  Epoch {liveMetrics.epoch} / 100
                </div>
              </>
            ) : (
              <div className="train-metrics-waiting">Waiting for first epoch…</div>
            )}
          </div>
        )}

        </div>
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
