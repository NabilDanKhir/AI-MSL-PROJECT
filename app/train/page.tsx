"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import * as tf from "@tensorflow/tfjs";
import LABELS from "@/lib/labels.json";
import "./train.css";

const NUM_CLASSES = LABELS.length;

export default function TrainPage() {
  const [progress, setProgress] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const modelRef = useRef<tf.LayersModel | null>(null);

  async function train() {
    setStatusMsg("");
    setIsTraining(true);
    setProgress(0);

    const res = await fetch("/dataset_clean.json");
    const dataset = await res.json();

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

    const xs = tf.tensor(
      dataset.map((d: any) => {
        const lm = d.landmarks;
        const baseX = lm[0];
        const baseY = lm[1];
        const baseZ = lm[2];
        const normalized: number[] = [];
        for (let i = 0; i < lm.length; i += 3) {
          normalized.push(lm[i] - baseX, lm[i + 1] - baseY, lm[i + 2] - baseZ);
        }
        return normalized;
      })
    );

    const ys = tf.oneHot(
      tf.tensor1d(dataset.map((d: any) => labelToIndex[d.label]), "int32"),
      NUM_CLASSES
    );

    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [63], units: 128, activation: "relu" }));
    model.add(tf.layers.dropout({ rate: 0.3 }));
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
          const percent = Math.round(((epoch + 1) / EPOCHS) * 100);
          setProgress(percent);

          if (!logs?.val_loss) return;

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

          const weightBuffer = modelArtifacts.weightData as ArrayBuffer;
          weightsBase64 = btoa(
            String.fromCharCode(...new Uint8Array(weightBuffer))
          );

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
        <span className="topbar-logo">MSL</span>
      </nav>

      <main className="train-main">
        <div className="train-card">
          <div className="train-header">
            <h1 className="train-title">Train MSL Model</h1>
            <p className="train-desc">
              Trains a neural network on your recorded dataset using TensorFlow.js.
              Early stopping is applied automatically.
            </p>
          </div>

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
