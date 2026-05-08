import test from "node:test";
import assert from "node:assert/strict";
import {
  HAND_FEATURE_COUNT,
  HAND_LANDMARK_COUNT,
  extractTwoHandFeatures,
} from "./handFeatures.js";

function makeHand(offset) {
  return Array.from({ length: HAND_LANDMARK_COUNT }, (_, index) => ({
    x: offset + index,
    y: offset + index * 2,
    z: offset + index * 3,
  }));
}

test("extractTwoHandFeatures returns left hand features before right hand features", () => {
  const left = makeHand(10);
  const right = makeHand(100);

  const result = extractTwoHandFeatures({
    multiHandLandmarks: [right, left],
    multiHandedness: [
      { label: "Right" },
      { label: "Left" },
    ],
  });

  assert.equal(result.features.length, HAND_FEATURE_COUNT);
  assert.equal(result.handCount, 2);
  assert.deepEqual(result.features.slice(0, 6), [0, 0, 0, 1, 2, 3]);
  assert.deepEqual(result.features.slice(63, 69), [0, 0, 0, 1, 2, 3]);
});

test("extractTwoHandFeatures reads nested MediaPipe handedness labels", () => {
  const left = makeHand(5);

  const result = extractTwoHandFeatures({
    multiHandLandmarks: [left],
    multiHandedness: [
      { classification: [{ label: "Left" }] },
    ],
  });

  assert.equal(result.handCount, 1);
  assert.deepEqual(result.features.slice(0, 6), [0, 0, 0, 1, 2, 3]);
  assert.deepEqual(result.features.slice(63), Array(63).fill(0));
});

test("extractTwoHandFeatures pads missing hands with zeros", () => {
  const right = makeHand(20);

  const result = extractTwoHandFeatures({
    multiHandLandmarks: [right],
    multiHandedness: [
      { label: "Right" },
    ],
  });

  assert.equal(result.features.length, HAND_FEATURE_COUNT);
  assert.equal(result.handCount, 1);
  assert.deepEqual(result.features.slice(0, 63), Array(63).fill(0));
  assert.deepEqual(result.features.slice(63, 69), [0, 0, 0, 1, 2, 3]);
});

