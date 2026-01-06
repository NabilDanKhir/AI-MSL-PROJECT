import json
import random
from collections import defaultdict

INPUT_FILE = "dataset_dirty.json"
OUTPUT_FILE = "dataset_clean.json"

# ---------- LOAD JSON ARRAY ----------
with open(INPUT_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

print("Total samples loaded:", len(data))

# ---------- GROUP BY LABEL ----------
by_label = defaultdict(list)
for item in data:
    if "label" in item and "landmarks" in item:
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

print("\n✅ Balanced dataset saved as:", OUTPUT_FILE)
