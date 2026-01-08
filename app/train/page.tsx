"use client";

import { useState, useRef } from "react";
import * as tf from "@tensorflow/tfjs";

const res = await fetch("/dataset_clean.json");
const dataset = await res.json();

import LABELS from "@/lib/labels.json";  

const NUM_CLASSES = LABELS.length;


export default function TrainPage() {
  const [progress, setProgress] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [isTrained, setIsTrained] = useState(false);

  const modelRef = useRef<tf.LayersModel | null>(null);

  async function train() {
    await tf.setBackend("cpu");
    await tf.ready();

    const labelToIndex = Object.fromEntries(
      LABELS.map((label, i) => [label, i])
    );

    const invalidLabels = dataset
      .map(d => d.label)
      .filter(l => !(l in labelToIndex));

    if (invalidLabels.length > 0) {
      console.error("Invalid labels found:", new Set(invalidLabels));
      throw new Error("Dataset contains labels not defined in LABELS");
    }

    const xs = tf.tensor(
      dataset.map(d => {
        const lm = d.landmarks;

        // wrist (first landmark)
        const baseX = lm[0];
        const baseY = lm[1];
        const baseZ = lm[2];

        const normalized: number[] = [];

        for (let i = 0; i < lm.length; i += 3) {
          normalized.push(
            lm[i] - baseX,
            lm[i + 1] - baseY,
            lm[i + 2] - baseZ
          );
        }

        return normalized;
      })
    );

    const ys = tf.oneHot(
      tf.tensor1d(dataset.map(d => labelToIndex[d.label]), "int32"),
      NUM_CLASSES
    );

    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [63], units: 64, activation: "relu" }));
    model.add(tf.layers.dense({ units: 32, activation: "relu" }));
    model.add(tf.layers.dense({ units: NUM_CLASSES, activation: "softmax" }));

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "categoricalCrossentropy",
      metrics: ["accuracy"],
    });

    const EPOCHS = 100;

    setIsTraining(true);
    setIsTrained(false);
    setProgress(0);

    let bestValLoss = Infinity;
    let bestWeights: tf.Tensor[] | null = null;
    let patienceCounter = 0;
    const PATIENCE = 5;

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
            "accuracy:", logs?.accuracy,
            "val_loss:", logs?.val_loss,
            "val_accuracy:", logs?.val_accuracy
          );

          if (!logs?.val_loss) return;

          // BEST WEIGHT TRACKING
          if (logs.val_loss < bestValLoss) {
            bestValLoss = logs.val_loss;
            patienceCounter = 0;

            if (bestWeights) {
              bestWeights.forEach(w => w.dispose());
            }

            bestWeights = model.getWeights().map(w => w.clone());
          } else {
            patienceCounter++;
          }

          // EARLY STOP
          if (patienceCounter >= PATIENCE) {
            model.stopTraining = true;
          }
        },

        onTrainEnd: () => {
          if (bestWeights) {
            model.setWeights(bestWeights);
          }

          setProgress(100);
          setIsTraining(false);
          setIsTrained(true);
        },
      },
    });

    modelRef.current = model;

  }

  async function downloadModel() {
    if (!modelRef.current) {
      alert("No trained model available.");
      return;
    }

    await modelRef.current.save("downloads://model");
  }


  return (
    <div style={{ padding: 40 }}>
      <h1>Train MSL Model</h1>
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={train} disabled={isTraining}>
          {isTraining ? "Training..." : "Train Model"}
        </button>

        <button onClick={downloadModel} disabled={!isTrained}>
          Download Model
        </button>
      </div>

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
    </div>
  );
}
