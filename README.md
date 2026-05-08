# BIM-Translate — Real-Time Malaysian Sign Language Recognition System

A real-time Bahasa Isyarat Malaysia (BIM) recognition and translation system that converts hand gestures into meaningful Malay text using a browser-based interface — accessible without any special hardware.

## Overview

The Malaysian deaf and hard-of-hearing community faces significant communication barriers in daily settings such as hospitals, schools, and public services. Existing sign language AI tools are predominantly built for American Sign Language (ASL) or British Sign Language (BSL), with no accessible real-time solution for BIM. This project addresses that gap.

## Application of AI

The system applies AI in three layers:

1. **Hand landmark detection** — Google MediaPipe detects 21 3D keypoints per hand in real time via webcam, extracting 126 normalized coordinate values per frame (2 hands × 63 values).

2. **Sign classification** — A custom-trained TensorFlow.js LSTM neural network classifies sequences of 30 frames into BIM sign categories, using wrist-relative normalization for translation and scale invariance. A confidence threshold (≥85%) and frame-stability filter (5 consecutive matching frames) reduce noise.

3. **AI agent interpretation** — An intelligent agent module maintains a temporal sign buffer, detects natural signing pauses, and maps accumulated sign sequences to grammatically natural Malay sentences via an LLM. Each interpretation is independent with no multi-turn context.

The system is trained on a self-recorded BIM dataset validated against the official BIM SignBank reference maintained by the Malaysian Federation of the Deaf (MFD).

## Features

**Live Translation** (`/translate`) — Point your webcam at your hand. Signs are detected in real time and accumulated silently. After a 2-second pause, the AI agent interprets the sign sequence into a complete Malay sentence with English translation.

**Record Dataset** (`/recording`) — Collect training data. Enter a label (e.g. `Makan`), press Start Recording, hold the sign in front of your webcam, then Stop and Save. Landmark coordinates are captured per frame and saved to `dataset_dirty.json`.

**Train Model** (`/train`) — Trains the LSTM in the browser on your collected dataset. Uses an 80/20 train/val split, early stopping (patience=10), and saves the best-performing weights to `public/model/`.

## Recognized Signs

| Label | Meaning |
|-------|---------|
| Saya | I / Me |
| Mahu | Want |
| Makan | Eat |
| Minum | Drink |
| Baik | Good |
| Tak Baik | Not Good |
| Demam | Fever |
| Senyap | Quiet |
| Waktu | Time |

## Model Architecture

Input: 126 features per frame (21 landmarks × XYZ × 2 hands), 30-frame sequences

```
LSTM(64) → Dense(64, relu) → Dropout(0.3) → Dense(9, softmax)
```

Optimizer: Adam (lr=0.001), loss: categorical crossentropy, 100 epochs max with early stopping (patience=10).

## Tech Stack

- **Next.js 16** + **React 19** + **TypeScript**
- **TensorFlow.js** — LSTM model training and inference, fully in-browser
- **MediaPipe Hands** — real-time 2-hand landmark detection
- **Groq API (Llama 3)** — AI agent sign-to-sentence interpretation
- **Python** (`balance.py`) — dataset cleaning and class balancing

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Allow camera access when prompted.

A pre-trained model is included in `public/model/` so Live Translation works immediately.

To enable AI agent interpretation, add your Groq API key (free at [console.groq.com](https://console.groq.com)) to `.env.local`:

```
GROQ_API_KEY=gsk_...
```

### Training your own model

1. Go to `/recording`, record samples for each sign, save the dataset.
2. Run `python ml/balance.py` to clean and balance the dataset.
3. Go to `/train`, click Compile Dataset then Train Model.
4. Go to `/translate` — the new model loads automatically.
