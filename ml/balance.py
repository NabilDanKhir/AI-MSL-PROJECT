import json
import random
from collections import defaultdict
import math

INPUT_FILE = "dataset_dirty.json"
OUTPUT_FILE = "../public/dataset_clean.json"
SEQUENCE_LENGTH = 30
FEATURE_COUNT = 126

# ---------- LOAD ----------
with open(INPUT_FILE, "r", encoding="utf-8") as f:
    raw = json.load(f)

print("Loaded:", len(raw), "samples")

# ---------- CLEAN ----------
cleaned = []
dropped = 0

def is_valid(seq):
    if not isinstance(seq, list) or len(seq) != SEQUENCE_LENGTH:
        return False
    for frame in seq:
        if not isinstance(frame, list) or len(frame) != FEATURE_COUNT:
            return False
        for v in frame:
            if not isinstance(v, (int, float)) or not math.isfinite(v):
                return False
    return True

for item in raw:
    if "label" not in item or "sequence" not in item:
        dropped += 1
        continue

    if not is_valid(item["sequence"]):
        dropped += 1
        continue

    cleaned.append({
        "label": item["label"],
        "sequence": item["sequence"],
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

print("\nDone. dataset_clean.json overwritten successfully")
print("Final samples:", len(balanced))
