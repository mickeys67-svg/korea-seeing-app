"""
WARP AI — Observation Score Prediction Model
=============================================
Google Colab compatible training script.
$0 cost: uses free Colab GPU + MongoDB Atlas free tier.

Setup (in Colab):
    !pip install tensorflowjs pandas scikit-learn

Usage:
    1. Export data:  MONGODB_URI="..." node training/export_data.js > training_data.csv
    2. Upload CSV to Google Drive or Colab
    3. Run this script in Colab
    4. Download model files → frontend/public/model/
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MinMaxScaler
import json
import os

# ── Configuration ──────────────────────────────────────────
CSV_PATH = 'training_data.csv'  # Change if uploaded elsewhere
MODEL_OUTPUT_DIR = 'warp_model'
MIN_SAMPLES = 50  # Minimum training samples required

# 12 input features (must match mlService.ts FEATURE_NAMES)
FEATURE_COLS = [
    'seeing', 'transparency', 'cloudScore', 'wind', 'jetStream',
    'cape', 'humidity', 'temp', 'pm25', 'aod',
    'moonPhase', 'moonFraction',
]

# Target: user rating (1-5) → scaled to 0-100
TARGET_COL = 'actualRating'


def load_and_prepare_data(csv_path):
    """Load CSV, clean, and prepare features/target."""
    print(f"Loading data from {csv_path}...")
    df = pd.read_csv(csv_path)

    print(f"  Total rows: {len(df)}")
    print(f"  Columns: {list(df.columns)}")

    # Filter rows with valid ratings
    df = df.dropna(subset=[TARGET_COL])
    df = df[df[TARGET_COL].between(1, 5)]
    print(f"  Rows with valid ratings: {len(df)}")

    if len(df) < MIN_SAMPLES:
        print(f"\n  WARNING: Only {len(df)} samples. Need at least {MIN_SAMPLES}.")
        print("  Continue collecting data via /api/feedback.")
        return None, None, None

    # Fill missing feature values with neutral defaults
    fill_defaults = {
        'seeing': 4, 'transparency': 4, 'cloudScore': 4,
        'wind': 3, 'jetStream': 25, 'cape': 200,
        'humidity': 50, 'temp': 15, 'pm25': 25, 'aod': 0.3,
        'moonPhase': 0.5, 'moonFraction': 0.5,
    }
    for col in FEATURE_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            df[col] = df[col].fillna(fill_defaults.get(col, 0))

    X = df[FEATURE_COLS].values.astype(np.float32)
    # Scale rating (1-5) → score (0-100)
    y = ((df[TARGET_COL].values - 1) / 4 * 100).astype(np.float32)

    # Normalize features to [0, 1]
    scaler = MinMaxScaler()
    X = scaler.fit_transform(X)

    return X, y, scaler


def build_model(input_dim):
    """Build a simple MLP model."""
    try:
        import tensorflow as tf
    except ImportError:
        print("Installing TensorFlow...")
        os.system("pip install tensorflow")
        import tensorflow as tf

    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(input_dim,)),
        tf.keras.layers.Dense(64, activation='relu',
                              kernel_regularizer=tf.keras.regularizers.l2(0.001)),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(32, activation='relu',
                              kernel_regularizer=tf.keras.regularizers.l2(0.001)),
        tf.keras.layers.Dropout(0.1),
        tf.keras.layers.Dense(1, activation='sigmoid'),  # Output: 0-1, scaled to 0-100
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss='mse',
        metrics=['mae'],
    )

    model.summary()
    return model


def train_and_export(csv_path=CSV_PATH, output_dir=MODEL_OUTPUT_DIR):
    """Full pipeline: load → train → export to TensorFlow.js format."""

    X, y, scaler = load_and_prepare_data(csv_path)
    if X is None:
        return

    # Scale target to [0, 1] for sigmoid output
    y_scaled = y / 100.0

    # Train/validation split
    X_train, X_val, y_train, y_val = train_test_split(
        X, y_scaled, test_size=0.2, random_state=42
    )

    print(f"\n  Training samples: {len(X_train)}")
    print(f"  Validation samples: {len(X_val)}")

    # Build and train
    model = build_model(X.shape[1])

    import tensorflow as tf
    early_stop = tf.keras.callbacks.EarlyStopping(
        monitor='val_loss', patience=15, restore_best_weights=True
    )

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=200,
        batch_size=min(32, len(X_train) // 4),
        callbacks=[early_stop],
        verbose=1,
    )

    # Evaluate
    val_loss, val_mae = model.evaluate(X_val, y_val, verbose=0)
    print(f"\n  Validation MAE: {val_mae * 100:.1f} points (on 0-100 scale)")
    print(f"  Validation Loss (MSE): {val_loss:.6f}")

    # Export to TensorFlow.js format
    try:
        import tensorflowjs as tfjs
    except ImportError:
        print("Installing tensorflowjs...")
        os.system("pip install tensorflowjs")
        import tensorflowjs as tfjs

    os.makedirs(output_dir, exist_ok=True)

    # Save as TF.js Layers model
    tfjs.converters.save_keras_model(model, output_dir)
    print(f"\n  Model exported to {output_dir}/")
    print(f"  Files: model.json + group1-shard1of1.bin")
    print(f"\n  Next steps:")
    print(f"  1. Copy {output_dir}/model.json → frontend/public/model/model.json")
    print(f"  2. Copy {output_dir}/*.bin → frontend/public/model/")
    print(f"  3. Deploy: gcloud run deploy korea-sky-seeing --source . --region us-central1")

    # Save scaler params for reference
    scaler_params = {
        'feature_names': FEATURE_COLS,
        'min': scaler.data_min_.tolist(),
        'max': scaler.data_max_.tolist(),
        'scale': scaler.scale_.tolist(),
    }
    with open(os.path.join(output_dir, 'scaler_params.json'), 'w') as f:
        json.dump(scaler_params, f, indent=2)
    print(f"  Scaler params saved to {output_dir}/scaler_params.json")

    return model, history


# ── Main ───────────────────────────────────────────────────
if __name__ == '__main__':
    train_and_export()
