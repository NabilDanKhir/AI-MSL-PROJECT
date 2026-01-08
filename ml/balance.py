import json
import random
from collections import defaultdict
import math

INPUT_FILE = "dataset_dirty.json"
OUTPUT_FILE = "dataset_clean.json"

# ---------- LOAD ----------
with open(INPUT_FILE, "r", encoding="utf-8") as f:
    raw = json.load(f)

print("Loaded:", len(raw), "samples")

# ---------- CLEAN ----------
cleaned = []
dropped = 0

def is_valid_landmarks(lm):
    if not isinstance(lm, list) or len(lm) != 63:
        return False
    for v in lm:
        if not isinstance(v, (int, float)) or not math.isfinite(v):
            return False
    return True

def normalize(lm):
    bx, by, bz = lm[0], lm[1], lm[2]  # wrist
    out = []
    for i in range(0, 63, 3):
        out.extend([
            lm[i]   - bx,
            lm[i+1] - by,
            lm[i+2] - bz
        ])
    return out

for item in raw:
    if "label" not in item or "landmarks" not in item:
        dropped += 1
        continue

    lm = item["landmarks"]

    if not is_valid_landmarks(lm):
        dropped += 1
        continue

    cleaned.append({
        "label": item["label"],
        "landmarks": normalize(lm)
    })

print("Cleaned:", len(cleaned))
print("Dropped:", dropped)

# ---------- GROUP ----------
by_label = defaultdict(list)
for item in cleaned:
    by_label[item["label"]].append(item)

for label, items in by_label.items():
    print(f"{label}: {len(items)} samples")

# ---------- BALANCE ----------
min_size = min(len(v) for v in by_label.values())
print("Target per class:", min_size)

balanced = []
for label, items in by_label.items():
    balanced.extend(random.sample(items, min_size))

random.shuffle(balanced)

# ---------- SAVE ----------
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(balanced, f, indent=2)

print("\n✅ dataset_clean.json overwritten successfully")
print("Final samples:", len(balanced))
