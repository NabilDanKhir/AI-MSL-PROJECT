"use client";

import { useState } from "react";
import * as tf from "@tensorflow/tfjs";
import dataset from "@/ml/dataset_clean.json";

import { LABELS } from "@/lib/labels";  

const NUM_CLASSES = LABELS.length;

export default function TrainPage() {
  const [progress, setProgress] = useState(0);
  const [isTraining, setIsTraining] = useState(false);

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

    const xs = tf.tensor(dataset.map(d => d.landmarks));
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

    const EPOCHS = 50;

    setIsTraining(true);
    setProgress(0);

    await model.fit(xs, ys, {
      epochs: EPOCHS,
      batchSize: 8,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          const percent = Math.round(((epoch + 1) / EPOCHS) * 100);
          setProgress(percent);

          console.log(
            `Epoch ${epoch + 1}/${EPOCHS}`,
            "loss:", logs?.loss,
            "acc:", logs?.acc || logs?.accuracy
          );
        },
        onTrainEnd: () => {
          setProgress(100);
          setIsTraining(false);
        },
      },
    });

    await model.save("downloads://model");

    xs.dispose();
    ys.dispose();
    model.dispose();
  }


  return (
    <div style={{ padding: 40 }}>
      <h1>Train MSL Model</h1>
      <button onClick={train} disabled={isTraining}>
        {isTraining ? "Training..." : "Train & Download Model"}
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
    </div>
  );
}
