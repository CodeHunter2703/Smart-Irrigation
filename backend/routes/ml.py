"""
ML Placeholder Route
====================
GET /api/ml/predict-schedule
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timezone, timedelta
from firebase_config import db, USE_MOCK
import random

ml_bp = Blueprint("ml", __name__)
SENSORS_COLLECTION = "sensor_readings"
SETTINGS_COLLECTION = "settings"


def _get_recent_readings(device_id: str, n: int = 24) -> list:
    """Fetch last N sensor readings for the device."""
    try:
        if USE_MOCK:
            docs = (
                db.collection(SENSORS_COLLECTION)
                .where("deviceId", "==", device_id)
                .order_by("timestamp", direction="DESCENDING")
                .limit(n)
                .stream()
            )
            return [d.to_dict() for d in docs if d.exists]
        else:
            from google.cloud.firestore_v1.base_query import FieldFilter
            docs = (
                db.collection(SENSORS_COLLECTION)
                .where(filter=FieldFilter("deviceId", "==", device_id))
                .order_by("timestamp", direction="DESCENDING")
                .limit(n)
                .stream()
            )
            return [d.to_dict() for d in docs]
    except Exception as e:
        err_str = str(e).lower()
        if "index" in err_str or "failed precondition" in err_str:
            try:
                if USE_MOCK:
                    docs = db.collection(SENSORS_COLLECTION).where("deviceId", "==", device_id).limit(n * 3).stream()
                    results = [d.to_dict() for d in docs if d.exists]
                else:
                    from google.cloud.firestore_v1.base_query import FieldFilter
                    docs = db.collection(SENSORS_COLLECTION).where(filter=FieldFilter("deviceId", "==", device_id)).limit(n * 3).stream()
                    results = [d.to_dict() for d in docs]
                results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
                return results[:n]
            except Exception:
                return []
        print(f"❌ ML readings fetch error: {e}")
        return []


def _heuristic_predict(readings: list, threshold: float) -> dict:
    if not readings:
        next_time = (datetime.now(timezone.utc) + timedelta(hours=6)).replace(
            hour=6, minute=0, second=0, microsecond=0
        )
        return {
            "nextIrrigationTime": next_time.isoformat(),
            "confidence": 0.5,
            "method": "heuristic_default",
            "reason": "No sensor data — defaulting to 6 AM schedule",
        }

    moistures = [r["soilMoisture"] for r in readings[:12]]
    avg_moisture = sum(moistures) / len(moistures)

    if len(moistures) >= 2:
        trend_per_reading = (moistures[0] - moistures[-1]) / len(moistures)
    else:
        trend_per_reading = 0

    if trend_per_reading > 0 and avg_moisture > threshold:
        readings_until_threshold = (avg_moisture - threshold) / trend_per_reading
        hours_until_threshold = readings_until_threshold * 0.5
    else:
        hours_until_threshold = 4

    proposed = datetime.now(timezone.utc) + timedelta(hours=max(1, hours_until_threshold))
    if proposed.hour < 5 or proposed.hour > 20:
        proposed = proposed.replace(hour=6, minute=0, second=0, microsecond=0)
        if proposed < datetime.now(timezone.utc):
            proposed += timedelta(days=1)

    confidence = min(0.95, 0.6 + random.uniform(-0.05, 0.15))

    return {
        "nextIrrigationTime": proposed.isoformat(),
        "confidence": round(confidence, 2),
        "method": "heuristic_trend",
        "reason": (
            f"Avg moisture: {avg_moisture:.1f}% | "
            f"Trend: -{trend_per_reading:.2f}%/reading | "
            f"Threshold: {threshold}% | "
            f"Estimated {hours_until_threshold:.1f}h until threshold"
        ),
        "lstmNote": (
            "In production, an LSTM model trained on historical data would replace "
            "this heuristic. The model would analyse sequences of 24 readings and "
            "output a probabilistic irrigation schedule."
        ),
    }


@ml_bp.route("/ml/predict-schedule", methods=["GET"])
def predict_schedule():
    device_id = request.args.get("deviceId", "field-001")

    threshold = 40
    try:
        settings_doc = db.collection(SETTINGS_COLLECTION).document(device_id).get()
        if settings_doc.exists:
            threshold = settings_doc.to_dict().get("moistureThreshold", 40)
    except Exception:
        pass

    readings = _get_recent_readings(device_id, 24)
    prediction = _heuristic_predict(readings, threshold)

    return jsonify({
        "deviceId": device_id,
        "prediction": prediction,
        "inputReadingsUsed": len(readings),
        "threshold": threshold,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    })
