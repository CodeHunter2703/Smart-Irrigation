"""
Decision Logic Route
====================
POST /api/run-decision
GET  /api/logs
"""

import os
import requests
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from firebase_config import db, USE_MOCK
from routes.pump import _set_pump, _write_log

decision_bp = Blueprint("decision", __name__)

SENSORS_COLLECTION = "sensor_readings"
LOGS_COLLECTION = "logs"
SETTINGS_COLLECTION = "settings"
DECISIONS_COLLECTION = "decisions"

WEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
WEATHER_CITY = os.getenv("WEATHER_CITY", "Mumbai")


def _fetch_weather() -> dict:
    if WEATHER_API_KEY:
        try:
            url = (
                f"https://api.openweathermap.org/data/2.5/forecast"
                f"?q={WEATHER_CITY}&appid={WEATHER_API_KEY}&units=metric&cnt=4"
            )
            resp = requests.get(url, timeout=5)
            resp.raise_for_status()
            data = resp.json()
            forecast = data["list"][0]
            return {
                "source": "OpenWeatherMap",
                "rainProbability": round(forecast.get("pop", 0.0), 2),
                "temperature": round(forecast["main"]["temp"], 1),
                "humidity": forecast["main"]["humidity"],
                "description": forecast["weather"][0]["description"],
            }
        except Exception as e:
            print(f"⚠️  Weather API error: {e} — using mock data")

    import random
    return {
        "source": "mock",
        "rainProbability": round(random.uniform(0.1, 0.8), 2),
        "temperature": round(random.uniform(24, 34), 1),
        "humidity": random.randint(50, 80),
        "description": "partly cloudy",
    }


def _get_settings(device_id: str) -> dict:
    try:
        doc = db.collection(SETTINGS_COLLECTION).document(device_id).get()
        if doc.exists:
            return doc.to_dict()
    except Exception:
        pass
    return {"moistureThreshold": 40, "autoMode": True, "deviceId": device_id}


def _query_with_fallback(collection, device_id, limit=1):
    """Query with where+order_by; fall back to Python sort if index missing."""
    try:
        if USE_MOCK:
            docs = (
                db.collection(collection)
                .where("deviceId", "==", device_id)
                .order_by("timestamp", direction="DESCENDING")
                .limit(limit)
                .stream()
            )
            return [d.to_dict() for d in docs if d.exists]
        else:
            from google.cloud.firestore_v1.base_query import FieldFilter
            docs = (
                db.collection(collection)
                .where(filter=FieldFilter("deviceId", "==", device_id))
                .order_by("timestamp", direction="DESCENDING")
                .limit(limit)
                .stream()
            )
            return [d.to_dict() for d in docs]
    except Exception as e:
        err_str = str(e).lower()
        if "index" in err_str or "failed precondition" in err_str:
            try:
                if USE_MOCK:
                    docs = db.collection(collection).where("deviceId", "==", device_id).limit(limit * 5).stream()
                    results = [d.to_dict() for d in docs if d.exists]
                else:
                    from google.cloud.firestore_v1.base_query import FieldFilter
                    docs = db.collection(collection).where(filter=FieldFilter("deviceId", "==", device_id)).limit(limit * 5).stream()
                    results = [d.to_dict() for d in docs]
                results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
                return results[:limit]
            except Exception as e2:
                print(f"❌ Firestore fallback error: {e2}")
                return []
        print(f"❌ Firestore query error: {e}")
        return []


def _get_latest_sensor(device_id: str) -> dict | None:
    results = _query_with_fallback(SENSORS_COLLECTION, device_id, limit=1)
    return results[0] if results else None


@decision_bp.route("/run-decision", methods=["POST"])
def run_decision():
    body = request.get_json(silent=True) or {}
    device_id = body.get("deviceId", "field-001")

    sensor = _get_latest_sensor(device_id)
    if not sensor:
        return jsonify({"error": "No sensor data available for decision"}), 404

    moisture = sensor["soilMoisture"]
    settings = _get_settings(device_id)
    threshold = settings.get("moistureThreshold", 40)
    auto_mode = settings.get("autoMode", True)

    weather = _fetch_weather()
    rain_prob = weather["rainProbability"]

    decision = "OFF"
    reason = ""

    if not auto_mode:
        reason = "Auto mode is OFF — no automatic action taken"
        decision = "HOLD"
    elif rain_prob >= 0.5:
        reason = f"Forecast rain → Pump skipped (rain probability: {rain_prob * 100:.0f}%)"
        decision = "OFF"
    elif moisture < threshold:
        reason = (
            f"Moisture low ({moisture}% < {threshold}%) and no rain expected "
            f"(rain prob: {rain_prob * 100:.0f}%) → Pump ON"
        )
        decision = "ON"
    else:
        reason = f"Moisture sufficient ({moisture}% ≥ {threshold}%) → No irrigation needed"
        decision = "OFF"

    if auto_mode and decision in ("ON", "OFF"):
        _set_pump(device_id, decision, reason)

    ts = datetime.now(timezone.utc).isoformat()
    decision_record = {
        "deviceId": device_id,
        "decision": decision,
        "reason": reason,
        "moisture": moisture,
        "threshold": threshold,
        "weather": weather,
        "autoMode": auto_mode,
        "timestamp": ts,
    }
    try:
        db.collection(DECISIONS_COLLECTION).add(decision_record)
    except Exception as e:
        print(f"⚠️  Could not write decision record: {e}")

    return jsonify({
        "status": "decision_executed",
        "decision": decision,
        "reason": reason,
        "sensor": sensor,
        "weather": weather,
        "settings": settings,
        "timestamp": ts,
    })


@decision_bp.route("/logs", methods=["GET"])
def get_logs():
    """Return event logs for the dashboard Events table."""
    device_id = request.args.get("deviceId", "field-001")
    limit = min(int(request.args.get("limit", 50)), 200)

    logs = _query_with_fallback(LOGS_COLLECTION, device_id, limit=limit)
    return jsonify({"deviceId": device_id, "count": len(logs), "logs": logs})
