export const HAND_LANDMARK_COUNT = 21;
export const VALUES_PER_LANDMARK = 3;
export const SINGLE_HAND_FEATURE_COUNT = HAND_LANDMARK_COUNT * VALUES_PER_LANDMARK;
export const HAND_FEATURE_COUNT = SINGLE_HAND_FEATURE_COUNT * 2;
export const SEQUENCE_LENGTH = 30;

const ZERO_HAND = Array(SINGLE_HAND_FEATURE_COUNT).fill(0);

function getHandednessLabel(handedness) {
  const label = handedness?.label ?? handedness?.classification?.[0]?.label ?? "";
  return String(label).toLowerCase();
}

function normalizeHand(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length !== HAND_LANDMARK_COUNT) {
    return ZERO_HAND;
  }

  const base = landmarks[0];
  if (!base) return ZERO_HAND;

  return landmarks.flatMap((point) => [
    Number(point.x ?? 0) - Number(base.x ?? 0),
    Number(point.y ?? 0) - Number(base.y ?? 0),
    Number(point.z ?? 0) - Number(base.z ?? 0),
  ]);
}

export function extractTwoHandFeatures(results) {
  const landmarksList = Array.isArray(results?.multiHandLandmarks)
    ? results.multiHandLandmarks
    : [];
  const handednessList = Array.isArray(results?.multiHandedness)
    ? results.multiHandedness
    : [];

  let left = null;
  let right = null;

  landmarksList.forEach((landmarks, index) => {
    const label = getHandednessLabel(handednessList[index]);
    if (label === "left" && !left) {
      left = landmarks;
      return;
    }
    if (label === "right" && !right) {
      right = landmarks;
      return;
    }
    if (!left) {
      left = landmarks;
      return;
    }
    if (!right) {
      right = landmarks;
    }
  });

  return {
    features: [
      ...normalizeHand(left),
      ...normalizeHand(right),
    ],
    handCount: landmarksList.length,
  };
}

