"use client";

import { useState, useRef } from "react";
import * as tf from "@tensorflow/tfjs";

import LABELS from "@/lib/labels.json";

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

    // --- load dataset ---
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
      setStatusMsg("❌ Dataset contains labels not in labels.json");
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

    // --- model architecture ---
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

    // --- training loop ---
    await model.fit(xs, ys, {
      epochs: EPOCHS,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          const percent = Math.round(((epoch + 1) / EPOCHS) * 100);
          setProgress(percent);

          console.log(
            `Epoch ${epoch + 1}/${EPOCHS}`,
            "loss:", logs?.loss,
            "val_loss:", logs?.val_loss,
            "accuracy:", logs?.accuracy ?? logs?.acc ?? "N/A",
            "val_accuracy:", logs?.val_accuracy ?? logs?.val_acc ?? "N/A"
          );

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
          setStatusMsg("⏳ Saving model...");
          await saveModel(model);
        },
      },
    });

    tf.dispose([xs, ys]);
    setIsTraining(false);
  }

  async function saveModel(model: tf.LayersModel) {
    try {
      // serialize model using TF.js built-in IOHandler
      let modelJSON: any = null;
      let weightsBase64 = "";

      await model.save({
        save: async (modelArtifacts) => {
          // modelArtifacts.modelTopology  → the JSON topology
          // modelArtifacts.weightData     → ArrayBuffer of binary weights
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
        setStatusMsg("✅ Model saved! public/model/ has been updated.");
      } else {
        setStatusMsg(`❌ ${result.error}`);
      }
    } catch (err) {
      console.error("[saveModel]", err);
      setStatusMsg("❌ Failed to serialize or save model.");
    }
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Train MSL Model</h1>

      <button onClick={train} disabled={isTraining}>
        {isTraining ? "Training..." : "Train Model"}
      </button>

      {isTraining && (
        <div style={{ marginTop: 20, width: 300 }}>
          <div
            style={{
              height: 20,
              width: "100%",
              border: "1px solid #ccc",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                backgroundColor: "#4caf50",
                transition: "width 0.3s",
              }}
            />
          </div>
          <p style={{ marginTop: 8 }}>{progress}%</p>
        </div>
      )}

      {statusMsg && (
        <p style={{ marginTop: 16, fontSize: 15 }}>{statusMsg}</p>
      )}
    </div>
  );
}