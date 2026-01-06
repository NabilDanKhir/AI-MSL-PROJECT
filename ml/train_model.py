import json
import numpy as np
import tensorflow as tf
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split

# ---------- LOAD DATA ----------
with open("dataset_clean.json", "r", encoding="utf-8") as f:
    data = json.load(f)

X = np.array([item["landmarks"] for item in data])
y = np.array([item["label"] for item in data])

print("Total samples:", len(X))

# ---------- ENCODE LABELS ----------
encoder = LabelEncoder()
y_encoded = encoder.fit_transform(y)

print("Classes:", encoder.classes_)

# ---------- TRAIN / TEST SPLIT ----------
X_train, X_test, y_train, y_test = train_test_split(
    X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
)

# ---------- MODEL ----------
model = tf.keras.Sequential([
    tf.keras.layers.Dense(128, activation="relu", input_shape=(63,)),
    tf.keras.layers.Dense(64, activation="relu"),
    tf.keras.layers.Dense(len(encoder.classes_), activation="softmax")
])

model.compile(
    optimizer="adam",
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"]
)

# ---------- TRAIN ----------
model.fit(
    X_train,
    y_train,
    epochs=20,
    batch_size=32,
    validation_split=0.2
)

# ---------- EVALUATE ----------
loss, acc = model.evaluate(X_test, y_test)
print("Test accuracy:", acc)

# ---------- SAVE FOR TFJS (NO CONVERTER) ----------
model.save("model_tfjs", save_format="tf")
print("Saved model_tfjs folder")

