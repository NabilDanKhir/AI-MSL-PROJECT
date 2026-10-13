import json
import random
from collections import defaultdict

TARGET = 250
INPUT = "dataset_dirty.json"


def augment_noise(seq):
    std = random.uniform(0.005, 0.025)
    return [[v + random.gauss(0, std) for v in frame] for frame in seq]


def augment_timewarp(seq):
    # slightly speed up or slow down by resampling to 30 frames
    n = len(seq)
    factor = random.uniform(0.8, 1.2)
    src_len = max(10, min(int(n * factor), n * 2))
    indices = [int(i * n / src_len) for i in range(src_len)]
    src = [seq[i] for i in indices]
    # resample back to n frames via linear interpolation
    out = []
    for i in range(n):
        t = i * (len(src) - 1) / (n - 1)
        lo, hi = int(t), min(int(t) + 1, len(src) - 1)
        alpha = t - lo
        out.append([a + alpha * (b - a) for a, b in zip(src[lo], src[hi])])
    return out


AUGMENTERS = [augment_noise, augment_timewarp]


with open(INPUT) as f:
    data = json.load(f)

by_label = defaultdict(list)
for item in data:
    by_label[item["label"]].append(item)

augmented = list(data)
for label, items in sorted(by_label.items()):
    needed = TARGET - len(items)
    if needed <= 0:
        print(f"{label}: {len(items)} (ok)")
        continue
    for i in range(needed):
        src = random.choice(items)
        fn = AUGMENTERS[i % len(AUGMENTERS)]
        augmented.append({"label": label, "sequence": fn(src["sequence"])})
    print(f"{label}: {len(items)} -> {len(items) + needed}")

random.shuffle(augmented)

with open(INPUT, "w") as f:
    json.dump(augmented, f)

print(f"\nDone. Total samples: {len(augmented)}")
