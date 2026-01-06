"use client";

import * as tf from "@tensorflow/tfjs";
import dataset from "@/ml/dataset_clean.json";

const LABELS = ["REST", "HELLO"];

export default function TrainPage() {
  async function train() {
    const labelToIndex: any = { REST: 0, HELLO: 1 };

    const xs = dataset.map(d => d.landmarks);
    const ys = dataset.map(d => labelToIndex[d.label]);

    const xTensor = tf.tensor2d(xs);
    const yTensor = tf.oneHot(tf.tensor1d(ys, "int32"), LABELS.length);

    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [63], units: 64, activation: "relu" }));
    model.add(tf.layers.dense({ units: 32, activation: "relu" }));
    model.add(tf.layers.dense({ units: 2, activation: "softmax" }));

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "categoricalCrossentropy",
      metrics: ["accuracy"],
    });

    await model.fit(xTensor, yTensor, {
      epochs: 30,
      batchSize: 32,
      validationSplit: 0.2,
    });

    // ✅ THIS WORKS IN BROWSER
    await model.save("downloads://msl-model");

    alert("Model trained and downloaded!");
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Train MSL Model</h1>
      <button onClick={train}>Train & Download Model</button>
    </div>
  );
}
