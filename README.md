# MSL Realtime — Malaysian Sign Language Recognition

A real-time hand gesture recognition system for Malaysian Sign Language (MSL), built entirely in the browser. It uses your webcam to detect hand landmarks, runs them through a trained neural network, and displays the predicted sign live.

## What it does

The app has three main parts:

**Live Translation** (`/translate`) — Point your webcam at your hand. MediaPipe detects 21 hand landmarks per frame, normalizes them relative to the wrist, and feeds them into a TensorFlow.js model that predicts which MSL sign you're making. A temporal stability filter (5 consecutive matching frames at ≥85% confidence) prevents flickering.

**Record Dataset** (`/recording`) — Collect your own training data. Enter a label (e.g. `Makan`), press Start Recording, hold the sign in front of your webcam, then Stop and Save. Hand landmark coordinates are captured each frame and appended to `dataset_dirty.json`.

**Train Model** (`/train`) — Trains the neural network in the browser on your collected dataset. Uses an 80/20 train/val split, early stopping (patience=10), and saves the best weights. The resulting model is written to `public/model/` and picked up immediately by the translator.

## Recognized signs

| Label | Meaning |
|-------|---------|
| Demam | Fever |
| Makan | Eat |
| Minum | Drink |
| Saya | I / Me |
| Senyap | Quiet |
| Waktu | Time |
| Baik | Good |
| Tak Baik | Not Good |

## Model architecture

Input: 63 features (21 landmarks × XYZ, normalized to wrist position)

```
Dense(128, relu) → Dropout(0.3) → Dense(64, relu) → Dropout(0.3) → Dense(9, softmax)
```

Optimizer: Adam (lr=0.001), loss: categorical crossentropy, 100 epochs max with early stopping.

## Tech stack

- **Next.js 16** + **React 19** + **TypeScript**
- **TensorFlow.js** — model training and inference, fully in-browser
- **MediaPipe Hands** — real-time hand landmark detection
- **Tailwind CSS**

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Allow camera access when prompted.

A pre-trained model is included in `public/model/` so Live Translation works out of the box. To train your own:

1. Go to `/recording`, record samples for each sign, save the dataset.
2. Go to `/train`, click Train Model, wait for it to finish.
3. Go to `/translate` — the new model loads automatically.
