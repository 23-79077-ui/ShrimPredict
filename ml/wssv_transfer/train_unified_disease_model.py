import os
import json
from pathlib import Path

import tensorflow as tf  # type: ignore[import]
from tensorflow.keras.applications import EfficientNetB0  # type: ignore[import]
from tensorflow.keras import layers, models  # type: ignore[import]

def main():
    # 1. Setup paths
    ROOT_DIR = Path(__file__).resolve().parents[2]
    DATA_DIR = ROOT_DIR / "data" / "shrimp_disease_dataset"
    ARTIFACTS_DIR = ROOT_DIR / "ml" / "artifacts" / "unified_model"
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    
    MODEL_PATH = ARTIFACTS_DIR / "unified_disease_model.keras"
    LABELS_PATH = ARTIFACTS_DIR / "labels.json"
    
    if not DATA_DIR.exists():
        print(f"Error: Dataset directory {DATA_DIR} not found.")
        print("Please place your images in data/shrimp_disease_dataset/ with subfolders for each class:")
        print(" - Healthy")
        print(" - Black_Gill")
        print(" - White_Spot_Syndrome_Virus")
        return

    # 2. Hyperparameters
    IMG_SIZE = 224
    BATCH_SIZE = 32
    EPOCHS = 20

    # 3. Load dataset
    print("Loading dataset...")
    train_ds = tf.keras.utils.image_dataset_from_directory(
        DATA_DIR,
        validation_split=0.2,
        subset="training",
        seed=42,
        image_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        label_mode='categorical'
    )
    
    val_ds = tf.keras.utils.image_dataset_from_directory(
        DATA_DIR,
        validation_split=0.2,
        subset="validation",
        seed=42,
        image_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        label_mode='categorical'
    )

    class_names = train_ds.class_names
    print(f"Detected classes: {class_names}")
    
    if len(class_names) != 3:
        print(f"Warning: Expected exactly 3 classes (Healthy, Black_Gill, White_Spot_Syndrome_Virus), but found {len(class_names)}")

    # Save labels mapping
    with open(LABELS_PATH, "w") as f:
        json.dump(class_names, f)

    # 4. Data Augmentation
    data_augmentation = tf.keras.Sequential([
        layers.RandomFlip("horizontal_and_vertical"),
        layers.RandomRotation(0.2),
        layers.RandomZoom(0.2),
        layers.RandomContrast(0.2)
    ], name="data_augmentation")

    # 5. Build Model (EfficientNetB0)
    base_model = EfficientNetB0(input_shape=(IMG_SIZE, IMG_SIZE, 3), include_top=False, weights='imagenet')
    base_model.trainable = False  # Freeze base model

    inputs = tf.keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
    x = data_augmentation(inputs)
    # EfficientNet expects inputs in [0, 255] which is what image_dataset_from_directory provides
    x = base_model(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(len(class_names), activation='softmax')(x)
    
    model = models.Model(inputs, outputs)

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )

    print(model.summary())

    # 6. Train Model
    print("Starting training...")
    callbacks = [
        tf.keras.callbacks.ModelCheckpoint(filepath=MODEL_PATH, save_best_only=True, monitor="val_accuracy"),
        tf.keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True)
    ]
    
    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=EPOCHS,
        callbacks=callbacks
    )

    # 7. Fine-tuning (Unfreeze top layers)
    print("Starting fine-tuning...")
    base_model.trainable = True
    for layer in base_model.layers[:-20]: # Freeze all but last 20 layers
        layer.trainable = False
        
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    
    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=10,
        callbacks=callbacks
    )

    print(f"Training complete. Model saved to {MODEL_PATH}")
    print(f"Labels saved to {LABELS_PATH}")

if __name__ == '__main__':
    main()
