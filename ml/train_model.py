import json
import numpy as np
import tensorflow as tf
from sklearn.preprocessing import LabelEncoder
from tensorflow.keras.utils import to_categorical

# Load dataset
with open("dataset.json") as f:
    data = json.load(f)

X = np.array([item["landmarks"] for item in data])
labels = [item["label"] for item in data]

# Convert labels (text → numbers)
encoder = LabelEncoder()
y = encoder.fit_transform(labels)
y = to_categorical(y)

# Save label order
with open("labels.txt", "w") as f:
    for label in encoder.classes_:
        f.write(label + "\n")

# Define model (simple & safe)
model = tf.keras.Sequential([
    tf.keras.layers.Dense(128, activation="relu", input_shape=(63,)),
    tf.keras.layers.Dense(64, activation="relu"),
    tf.keras.layers.Dense(y.shape[1], activation="softmax")
])

model.compile(
    optimizer="adam",
    loss="categorical_crossentropy",
    metrics=["accuracy"]
)

# Train
model.fit(X, y, epochs=30, batch_size=32)

# Save model
model.save("msl_model")
