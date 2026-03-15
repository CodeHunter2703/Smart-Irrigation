"""
Rain Forecasting Route
======================
POST/GET /api/predict-rain

Uses the pre-trained cascade:
  rain_classifier.pkl  →  Rain / No Rain  (+ probability)
  rain_regressor.pkl   →  Rainfall amount in mm  (only when Rain predicted)
  model_features.pkl   →  Ordered list of the 8 feature names

Feature set (must match training order from model_features.pkl):
  temp, humidity, sealevelpressure, cloudcover, windspeed,
  rain_lag1, rain_roll3, rain_roll7

Input modes  (controlled by JSON body or GET params):
  • GET  /api/predict-rain?deviceId=field-001          → latest Firestore docs
  • POST { "mode": "latest",  "deviceId": "..." }      → same
  • POST { "mode": "date",    "date": "YYYY-MM-DD", "deviceId": "..." }
  • POST { "mode": "manual",  "features": { ... } }    → skip Firestore entirely
"""

import os
import pickle
import numpy as np
from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify

rain_forecast_bp = Blueprint("rain_forecast", __name__)

# ── Model paths (relative to this file → backend/) ──────────────────────────
_BASE = os.path.join(os.path.dirname(__file__), "..")
_CLS_PATH  = os.path.abspath(os.path.join(_BASE, "rain_classifier.pkl"))
_REG_PATH  = os.path.abspath(os.path.join(_BASE, "rain_regressor.pkl"))
_FEAT_PATH = os.path.abspath(os.path.join(_BASE, "model_features.pkl"))

# ── Load models once at startup ──────────────────────────────────────────────
_classifier  = None
_regressor   = None
_feature_names = None
_models_loaded = False

def _load_models():
    global _classifier, _regressor, _feature_names, _models_loaded
    try:
        with open(_CLS_PATH, "rb") as f:
            _classifier = pickle.load(f)
        with open(_REG_PATH, "rb") as f:
            _regressor = pickle.load(f)
        with open(_FEAT_PATH, "rb") as f:
            _feature_names = pickle.load(f)
        _models_loaded = True
        print(f"✅ Rain forecast models loaded — features: {_feature_names}")
        return True
    except FileNotFoundError as e:
        print(f"⚠️  Rain model file missing: {e}")
        return False
    except Exception as e:
        print(f"⚠️  Rain model load failed: {e}")
        return False

_models_loaded = _load_models()

# Canonical 8 features (fallback if model_features.pkl is missing)
_DEFAULT_FEATURES = [
    "temp", "humidity", "sealevelpressure",
    "cloudcover", "windspeed",
    "rain_lag1", "rain_roll3", "rain_roll7",
]

def _get_feature_names():
    if _feature_names is not None:
        return list(_feature_names)
    return _DEFAULT_FEATURES


# ── Firestore helpers ────────────────────────────────────────────────────────
def _fetch_readings(device_id: str, n: int = 14) -> list:
    """Fetch last N sensor readings for this device (newest first)."""
    from firebase_config import db, USE_MOCK
    try:
        if USE_MOCK:
            docs = (
                db.collection("sensor_readings")
                .where("deviceId", "==", device_id)
                .order_by("timestamp", direction="DESCENDING")
                .limit(n)
                .stream()
            )
            results = [d.to_dict() for d in docs if d.exists]
        else:
            from google.cloud.firestore_v1.base_query import FieldFilter
            docs = (
                db.collection("sensor_readings")
                .where(filter=FieldFilter("deviceId", "==", device_id))
                .order_by("timestamp", direction="DESCENDING")
                .limit(n)
                .stream()
            )
            results = [d.to_dict() for d in docs]
        results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return results
    except Exception as e:
        err = str(e).lower()
        if "index" in err or "failed precondition" in err:
            try:
                from firebase_config import db, USE_MOCK
                if USE_MOCK:
                    docs = db.collection("sensor_readings").where("deviceId", "==", device_id).limit(n * 3).stream()
                    results = [d.to_dict() for d in docs if d.exists]
                else:
                    from google.cloud.firestore_v1.base_query import FieldFilter
                    docs = db.collection("sensor_readings").where(filter=FieldFilter("deviceId", "==", device_id)).limit(n * 3).stream()
                    results = [d.to_dict() for d in docs]
                results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
                return results[:n]
            except Exception:
                return []
        print(f"❌ Firestore fetch error: {e}")
        return []


def _fetch_readings_for_date(device_id: str, date_str: str, n: int = 14) -> list:
    """Fetch the most recent N readings on or before a given date."""
    from firebase_config import db, USE_MOCK
    try:
        # date_str = "YYYY-MM-DD"
        end_dt = datetime.strptime(date_str, "%Y-%m-%d").replace(
            hour=23, minute=59, second=59, tzinfo=timezone.utc
        )
        start_dt = end_dt - timedelta(days=7)
        end_iso   = end_dt.isoformat()
        start_iso = start_dt.isoformat()

        if USE_MOCK:
            docs = db.collection("sensor_readings").where("deviceId", "==", device_id).limit(100).stream()
            results = [d.to_dict() for d in docs if d.exists]
        else:
            from google.cloud.firestore_v1.base_query import FieldFilter
            docs = db.collection("sensor_readings").where(filter=FieldFilter("deviceId", "==", device_id)).limit(200).stream()
            results = [d.to_dict() for d in docs]

        results = [
            r for r in results
            if start_iso <= r.get("timestamp", "") <= end_iso
        ]
        results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return results[:n]
    except Exception as e:
        print(f"❌ Date-based fetch error: {e}")
        return _fetch_readings(device_id, n)  # fallback to latest


# ── Feature extraction ───────────────────────────────────────────────────────
def _extract_features(readings: list) -> dict:
    """
    Extract the 8 model features from a list of Firestore docs (newest first).

    Sensor fields mapped:
      temperature  → temp
      humidity     → humidity
      sealevelpressure / pressure → sealevelpressure
      cloudcover   → cloudcover
      windspeed    → windspeed
      rainfall_mm  → used for lag / rolling features

    If weather fields are missing, sensible defaults are used so the model
    still runs (mock mode or older readings without those fields).
    """
    if not readings:
        return _default_feature_values()

    latest = readings[0]

    # ── Direct sensor fields ──
    temp             = float(latest.get("temperature", latest.get("temp", 28.0)))
    humidity         = float(latest.get("humidity", 65.0))
    sealevelpressure = float(latest.get("sealevelpressure", latest.get("pressure", 1013.25)))
    cloudcover       = float(latest.get("cloudcover", 40.0))
    windspeed        = float(latest.get("windspeed", 10.0))

    # ── Rainfall lag / rolling (from historical readings) ──
    rain_series = []
    for r in readings:
        val = r.get("rainfall_mm", 0.0)
        try:
            rain_series.append(float(val))
        except (TypeError, ValueError):
            rain_series.append(0.0)

    # Pad if we don't have enough history
    while len(rain_series) < 7:
        rain_series.append(0.0)

    rain_lag1  = rain_series[1] if len(rain_series) > 1 else 0.0
    rain_roll3 = round(float(np.mean(rain_series[1:4])), 4)
    rain_roll7 = round(float(np.mean(rain_series[1:8])), 4)

    return {
        "temp":             round(temp, 2),
        "humidity":         round(humidity, 2),
        "sealevelpressure": round(sealevelpressure, 2),
        "cloudcover":       round(cloudcover, 2),
        "windspeed":        round(windspeed, 2),
        "rain_lag1":        round(rain_lag1, 4),
        "rain_roll3":       round(rain_roll3, 4),
        "rain_roll7":       round(rain_roll7, 4),
    }


def _default_feature_values() -> dict:
    """Return sensible defaults when no Firestore data is available."""
    return {
        "temp": 28.0, "humidity": 65.0, "sealevelpressure": 1013.25,
        "cloudcover": 40.0, "windspeed": 10.0,
        "rain_lag1": 0.0, "rain_roll3": 0.0, "rain_roll7": 0.0,
    }


# ── Inference ────────────────────────────────────────────────────────────────
def _run_cascade(features: dict) -> dict:
    """
    Run the two-stage cascade:
      1. Classify: rain_classifier.pkl  → will_rain (bool) + probability
      2. Regress:  rain_regressor.pkl   → rainfall_mm  (only when will_rain)

    Returns full transparency payload.
    """
    feat_order = _get_feature_names()

    # Build input vector in correct feature order
    X = np.array([[features.get(f, 0.0) for f in feat_order]])

    # ── Demo fallback when models are missing ──
    if not _models_loaded or _classifier is None:
        will_rain = features.get("cloudcover", 40) > 50 or features.get("humidity", 65) > 70
        prob = round(min(0.95, (features.get("cloudcover", 40) / 100 + features.get("humidity", 65) / 200)), 3)
        rainfall_mm = round(features.get("rain_roll3", 0) * 1.5 + 1.2, 2) if will_rain else 0.0
        importance = {f: round(1 / len(feat_order), 4) for f in feat_order}
        model_status = "demo_fallback"
    else:
        # ── Step 1: Classify ──
        prob_arr = _classifier.predict_proba(X)[0]
        # prob_arr[1] = probability of "Rain" class
        classes = list(_classifier.classes_)
        rain_idx = classes.index(1) if 1 in classes else 1
        prob = round(float(prob_arr[rain_idx]), 4)
        will_rain = bool(_classifier.predict(X)[0])

        # ── Step 2: Regress (only if rain predicted) ──
        rainfall_mm = 0.0
        if will_rain:
            rainfall_mm = round(float(_regressor.predict(X)[0]), 2)
            rainfall_mm = max(0.0, rainfall_mm)   # clamp negatives

        # ── Feature importance (if tree-based model exposes it) ──
        importance = {}
        try:
            imp = _classifier.feature_importances_
            for fname, fval in zip(feat_order, imp):
                importance[fname] = round(float(fval), 4)
        except AttributeError:
            # Linear models: use |coef| normalised
            try:
                coef = np.abs(_classifier.coef_[0])
                total = float(coef.sum()) or 1.0
                for fname, c in zip(feat_order, coef):
                    importance[fname] = round(float(c) / total, 4)
            except Exception:
                importance = {f: round(1 / len(feat_order), 4) for f in feat_order}

        model_status = "live"

    cascade_steps = [
        {
            "step": 1,
            "name": "Classification",
            "model": "rain_classifier.pkl",
            "output": "Rain" if will_rain else "No Rain",
            "probability": prob,
            "description": f"Model classified weather as {'RAIN 🌧️' if will_rain else 'NO RAIN ☀️'} with {round(prob * 100, 1)}% confidence",
        },
    ]
    if will_rain:
        cascade_steps.append({
            "step": 2,
            "name": "Regression",
            "model": "rain_regressor.pkl",
            "output": f"{rainfall_mm} mm",
            "description": f"Since rain is predicted, regressor estimates {rainfall_mm} mm of rainfall",
        })

    return {
        "will_rain":        will_rain,
        "rain_probability": prob,
        "no_rain_probability": round(1 - prob, 4),
        "rainfall_mm":      rainfall_mm,
        "cascade_steps":    cascade_steps,
        "feature_importance": importance,
        "model_status":     model_status,
        "features_used":    features,
        "feature_order":    feat_order,
    }


# ── Routes ───────────────────────────────────────────────────────────────────

@rain_forecast_bp.route("/predict-rain", methods=["GET", "POST"])
def predict_rain():
    """
    Multi-mode rain prediction endpoint.
    GET  → latest data
    POST → mode: latest | date | manual
    """
    if request.method == "GET":
        device_id = request.args.get("deviceId", "field-001")
        mode = "latest"
        manual_features = None
        date_str = None
    else:
        body = request.json or {}
        mode = body.get("mode", "latest")
        device_id = body.get("deviceId", "field-001")
        date_str = body.get("date")
        manual_features = body.get("features")

    # ── Fetch / build features ────────────────────────────────────────────────
    source_readings = []
    data_source = mode

    if mode == "manual" and manual_features:
        # Use exact features from request body — fill any missing with defaults
        defaults = _default_feature_values()
        features = {k: float(manual_features.get(k, defaults[k])) for k in _get_feature_names()}
        data_source = "manual_input"
    elif mode == "date" and date_str:
        source_readings = _fetch_readings_for_date(device_id, date_str)
        features = _extract_features(source_readings)
        data_source = f"firestore_date:{date_str}"
    else:
        # "latest" or GET
        source_readings = _fetch_readings(device_id)
        features = _extract_features(source_readings)
        data_source = "firestore_latest"

    # ── Run cascade ───────────────────────────────────────────────────────────
    result = _run_cascade(features)

    # ── Irrigation recommendation ─────────────────────────────────────────────
    if result["will_rain"] and result["rain_probability"] > 0.6:
        irrigation_advice = "⏸️ Skip irrigation — significant rain expected"
        irrigation_action = "skip"
    elif result["will_rain"] and result["rain_probability"] > 0.4:
        irrigation_advice = "🔄 Reduce irrigation — some rain likely"
        irrigation_action = "reduce"
    else:
        irrigation_advice = "💧 Proceed with irrigation — no rain expected"
        irrigation_action = "proceed"

    return jsonify({
        "deviceId":           device_id,
        "mode":               mode,
        "data_source":        data_source,
        "readings_used":      len(source_readings),
        "features_used":      result["features_used"],
        "feature_order":      result["feature_order"],
        "will_rain":          result["will_rain"],
        "rain_probability":   result["rain_probability"],
        "no_rain_probability": result["no_rain_probability"],
        "rainfall_mm":        result["rainfall_mm"],
        "cascade_steps":      result["cascade_steps"],
        "feature_importance": result["feature_importance"],
        "irrigation_advice":  irrigation_advice,
        "irrigation_action":  irrigation_action,
        "model_status":       result["model_status"],
        "generated_at":       datetime.now(timezone.utc).isoformat(),
    })
