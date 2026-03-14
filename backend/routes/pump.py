"""
Hardware Control Routes
=======================
POST /api/pump/on         — Turn pump ON
POST /api/pump/off        — Turn pump OFF
POST /api/valve/open      — Open valve
POST /api/valve/close     — Close valve
POST /api/mode/automatic  — Automatic irrigation mode
POST /api/mode/manual     — Manual irrigation mode
POST /api/irrigation/start — Run irrigation for X minutes (manual)

All endpoints:
    1. Validate incoming request
    2. Update Firestore controls/device state
    3. Create a log entry
    4. Simulate MQTT publish (console print)
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from firebase_config import db, USE_MOCK

pump_bp = Blueprint("pump", __name__)
DEVICES_COLLECTION = "devices"
LOGS_COLLECTION = "logs"
SENSORS_COLLECTION = "sensor_readings"
CONTROLS_COLLECTION = "controls"
SETTINGS_COLLECTION = "settings"


def _simulate_mqtt(device_id: str, command: str):
    """Simulates publishing a command to the MQTT broker."""
    topic = f"irrigation/{device_id}/command"
    payload = {"command": command, "timestamp": datetime.now(timezone.utc).isoformat()}
    print(f"📡 [MQTT PUBLISH] Topic: {topic} | Payload: {payload}")


def _query_latest_reading(device_id: str):
    """Return latest sensor reading using mock-compatible + real Firestore query patterns."""
    try:
        if USE_MOCK:
            docs = (
                db.collection(SENSORS_COLLECTION)
                .where("deviceId", "==", device_id)
                .order_by("timestamp", direction="DESCENDING")
                .limit(1)
                .stream()
            )
            items = [d.to_dict() for d in docs if d.exists]
            return items[0] if items else None

        from google.cloud.firestore_v1.base_query import FieldFilter
        docs = (
            db.collection(SENSORS_COLLECTION)
            .where(filter=FieldFilter("deviceId", "==", device_id))
            .order_by("timestamp", direction="DESCENDING")
            .limit(1)
            .stream()
        )
        items = [d.to_dict() for d in docs]
        return items[0] if items else None
    except Exception:
        return None


def _write_log(device_id: str, log_type: str, message: str):
    ts = datetime.now(timezone.utc).isoformat()
    db.collection(LOGS_COLLECTION).add({
        "deviceId": device_id,
        "type": log_type,
        "message": message,
        "timestamp": ts,
    })


def _normalise_water_level(value):
    if value is None:
        return None
    if isinstance(value, str):
        level = value.strip().lower()
        if level in {"low", "medium", "high"}:
            return level
        try:
            value = float(level)
        except ValueError:
            return None

    if isinstance(value, (int, float)):
        if value < 30:
            return "low"
        if value < 70:
            return "medium"
        return "high"
    return None


def _is_water_low(device_id: str):
    latest = _query_latest_reading(device_id)
    if not latest:
        return False

    level = _normalise_water_level(
        latest.get("waterLevel")
        or latest.get("water_level")
        or latest.get("waterlevel")
    )
    return level == "low"


def _is_soil_moisture_high(device_id: str):
    latest = _query_latest_reading(device_id)
    if not latest:
        return False
    try:
        return float(latest.get("soilMoisture", 0)) >= 75.0
    except (TypeError, ValueError):
        return False


def _set_controls(device_id: str, controls_update: dict):
    db.collection(CONTROLS_COLLECTION).document(device_id).set(
        {"deviceId": device_id, **controls_update},
        merge=True,
    )


def _set_pump(device_id: str, status: str, reason: str = "Manual override"):
    ts = datetime.now(timezone.utc).isoformat()

    # Update Firestore device document
    db.collection(DEVICES_COLLECTION).document(device_id).set({
        "pumpStatus": status,
        "lastSeen": ts,
    }, merge=True)
    _set_controls(device_id, {"pump": status, "updatedAt": ts})

    # Write audit log
    emoji = "💧" if status == "ON" else "🛑"
    _write_log(device_id, "INFO", f"{emoji} Pump {status} — {reason}")

    # Simulate MQTT command to ESP32
    _simulate_mqtt(device_id, f"PUMP_{status}")

    return {"deviceId": device_id, "pumpStatus": status, "reason": reason, "timestamp": ts}


def _validate_device_id(device_id):
    if not device_id or not isinstance(device_id, str):
        return False
    return True


@pump_bp.route("/pump/on", methods=["POST"])
def pump_on():
    body = request.get_json(silent=True) or {}
    device_id = body.get("deviceId", "field-001")
    reason = body.get("reason", "Manual override — user initiated")

    if not _validate_device_id(device_id):
        return jsonify({"error": "Invalid deviceId"}), 400

    if _is_water_low(device_id):
        _write_log(device_id, "WARN", "Pump ON blocked — water level is LOW")
        return jsonify({
            "error": "Pump activation blocked due to low water level",
            "deviceId": device_id,
            "safety": "water_level_low",
        }), 409

    result = _set_pump(device_id, "ON", reason)
    if _is_soil_moisture_high(device_id):
        result["warnings"] = ["Soil moisture is already high; manual irrigation may over-water crops"]
    return jsonify(result)


@pump_bp.route("/pump/off", methods=["POST"])
def pump_off():
    body = request.get_json(silent=True) or {}
    device_id = body.get("deviceId", "field-001")
    reason = body.get("reason", "Manual override — user stopped")

    if not _validate_device_id(device_id):
        return jsonify({"error": "Invalid deviceId"}), 400

    result = _set_pump(device_id, "OFF", reason)
    return jsonify(result)


@pump_bp.route("/valve/open", methods=["POST"])
def valve_open():
    body = request.get_json(silent=True) or {}
    device_id = body.get("deviceId", "field-001")
    if not _validate_device_id(device_id):
        return jsonify({"error": "Invalid deviceId"}), 400

    ts = datetime.now(timezone.utc).isoformat()
    _set_controls(device_id, {"valve": "OPEN", "updatedAt": ts})
    _write_log(device_id, "INFO", "🚰 Valve OPEN — manual command")
    _simulate_mqtt(device_id, "VALVE_OPEN")

    return jsonify({"deviceId": device_id, "valve": "OPEN", "timestamp": ts})


@pump_bp.route("/valve/close", methods=["POST"])
def valve_close():
    body = request.get_json(silent=True) or {}
    device_id = body.get("deviceId", "field-001")
    if not _validate_device_id(device_id):
        return jsonify({"error": "Invalid deviceId"}), 400

    ts = datetime.now(timezone.utc).isoformat()
    _set_controls(device_id, {"valve": "CLOSE", "updatedAt": ts})
    _write_log(device_id, "INFO", "🚰 Valve CLOSE — manual command")
    _simulate_mqtt(device_id, "VALVE_CLOSE")

    return jsonify({"deviceId": device_id, "valve": "CLOSE", "timestamp": ts})


def _set_mode(device_id: str, mode: str):
    ts = datetime.now(timezone.utc).isoformat()
    auto_mode = mode == "AUTOMATIC"
    _set_controls(device_id, {"irrigation_mode": mode, "updatedAt": ts})
    db.collection(DEVICES_COLLECTION).document(device_id).set({"autoMode": auto_mode}, merge=True)
    db.collection(SETTINGS_COLLECTION).document(device_id).set({
        "deviceId": device_id,
        "autoMode": auto_mode,
        "updatedAt": ts,
    }, merge=True)
    _write_log(device_id, "INFO", f"⚙️ Irrigation mode set to {mode}")
    _simulate_mqtt(device_id, f"MODE_{mode}")
    return {"deviceId": device_id, "irrigation_mode": mode, "timestamp": ts}


@pump_bp.route("/mode/automatic", methods=["POST"])
def mode_automatic():
    body = request.get_json(silent=True) or {}
    device_id = body.get("deviceId", "field-001")
    if not _validate_device_id(device_id):
        return jsonify({"error": "Invalid deviceId"}), 400
    return jsonify(_set_mode(device_id, "AUTOMATIC"))


@pump_bp.route("/mode/manual", methods=["POST"])
def mode_manual():
    body = request.get_json(silent=True) or {}
    device_id = body.get("deviceId", "field-001")
    if not _validate_device_id(device_id):
        return jsonify({"error": "Invalid deviceId"}), 400
    return jsonify(_set_mode(device_id, "MANUAL"))


@pump_bp.route("/irrigation/start", methods=["POST"])
def start_irrigation_for_minutes():
    body = request.get_json(silent=True) or {}
    device_id = body.get("deviceId", "field-001")
    minutes = body.get("minutes")

    if not _validate_device_id(device_id):
        return jsonify({"error": "Invalid deviceId"}), 400

    if not isinstance(minutes, int) or minutes < 1 or minutes > 120:
        return jsonify({"error": "minutes must be an integer between 1 and 120"}), 400

    if _is_water_low(device_id):
        _write_log(device_id, "WARN", "Manual irrigation blocked — water level is LOW")
        return jsonify({
            "error": "Manual irrigation blocked due to low water level",
            "deviceId": device_id,
            "safety": "water_level_low",
        }), 409

    ts = datetime.now(timezone.utc).isoformat()
    _set_controls(device_id, {
        "manual_irrigation": {
            "state": "STARTED",
            "minutes": minutes,
            "requestedAt": ts,
        },
        "pump": "ON",
        "updatedAt": ts,
    })
    db.collection(DEVICES_COLLECTION).document(device_id).set({"pumpStatus": "ON"}, merge=True)

    warnings = []
    if _is_soil_moisture_high(device_id):
        warnings.append("Soil moisture is already high; irrigation may be unnecessary")

    _write_log(device_id, "INFO", f"🕒 Manual irrigation started for {minutes} minute(s)")
    _simulate_mqtt(device_id, f"IRRIGATION_START_{minutes}M")

    return jsonify({
        "deviceId": device_id,
        "manual_irrigation": "STARTED",
        "minutes": minutes,
        "timestamp": ts,
        "warnings": warnings,
    })
