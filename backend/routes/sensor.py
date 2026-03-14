"""
Sensor Data Routes
==================
POST /api/sensor-data  — Ingest reading from ESP32
GET  /api/latest       — Get most recent reading for a device
GET  /api/history      — Get historical readings (paginated)
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from firebase_config import db, USE_MOCK

sensor_bp = Blueprint("sensor", __name__)
COLLECTION = "sensor_readings"
DEVICES_COLLECTION = "devices"


@sensor_bp.route("/sensor-data", methods=["POST"])
def ingest_sensor_data():
    """
    Accepts JSON from ESP32 (or simulator) and stores in Firestore.
    Also updates the device's lastSeen, network status, and location.

    Optional GPS fields from ESP32 (if GPS module like NEO-6M is attached):
      "lat": 18.9667, "lon": 72.8333
    If not provided, falls back to IP-based geolocation via ip-api.com.
    """
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "Invalid JSON body"}), 400

    required = ["deviceId", "soilMoisture", "temperature", "humidity"]
    missing = [f for f in required if f not in body]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    # Normalise timestamp
    ts = body.get("timestamp", datetime.now(timezone.utc).isoformat())
    reading = {
        "deviceId": body["deviceId"],
        "soilMoisture": float(body["soilMoisture"]),
        "temperature": float(body["temperature"]),
        "humidity": float(body["humidity"]),
        "waterLevel": body.get("waterLevel", body.get("water_level", "medium")),
        "pumpStatus": body.get("pumpStatus", body.get("pump_status", "OFF")),
        "network": body.get("network", "wifi"),
        "timestamp": ts,
    }

    # ── Location: GPS from ESP32 payload → IP geolocation fallback ──
    location_update = {}

    if "lat" in body and "lon" in body:
        # GPS module (e.g. NEO-6M) attached to ESP32 — most accurate
        location_update = {
            "lat": float(body["lat"]),
            "lon": float(body["lon"]),
            "locationSource": "gps",
        }
    else:
        # No GPS → derive location from the ESP32's public IP via ip-api.com (free)
        try:
            import requests as req_lib
            client_ip = request.headers.get("X-Forwarded-For", request.remote_addr)
            client_ip = client_ip.split(",")[0].strip()
            # Only geolocate public IPs
            if not any(client_ip.startswith(p) for p in ("127.", "192.168.", "10.", "172.")):
                geo = req_lib.get(
                    f"http://ip-api.com/json/{client_ip}?fields=lat,lon,city,country",
                    timeout=3
                )
                geo_data = geo.json()
                if geo_data.get("lat"):
                    location_update = {
                        "lat": geo_data["lat"],
                        "lon": geo_data["lon"],
                        "locationCity": geo_data.get("city", ""),
                        "locationCountry": geo_data.get("country", ""),
                        "locationSource": "ip",
                    }
        except Exception as e:
            print(f"⚠️  IP geolocation failed: {e}")

    # Write sensor reading
    db.collection(COLLECTION).add(reading)

    # Update device last-seen + location
    db.collection(DEVICES_COLLECTION).document(body["deviceId"]).set(
        {
            "deviceId": body["deviceId"],
            "lastSeen": ts,
            "network": reading["network"],
            "waterLevel": reading["waterLevel"],
            "pumpStatus": reading["pumpStatus"],
            **location_update,
        },
        merge=True,
    )

    return jsonify({"status": "stored", "reading": reading, "location": location_update or None}), 201


def _query_device_readings(device_id, limit=1):
    """
    Query sensor readings for a device. Uses mock-compatible syntax for MockFirestore
    and the newer firebase-admin SDK style for real Firestore.
    Falls back gracefully if composite index is missing.
    """
    try:
        if USE_MOCK:
            # MockFirestore supports chained .where().order_by().limit()
            docs = (
                db.collection(COLLECTION)
                .where("deviceId", "==", device_id)
                .order_by("timestamp", direction="DESCENDING")
                .limit(limit)
                .stream()
            )
            return [d.to_dict() for d in docs if d.exists]
        else:
            # Real Firestore: use newer filter= kwarg syntax
            from google.cloud.firestore_v1.base_query import FieldFilter
            docs = (
                db.collection(COLLECTION)
                .where(filter=FieldFilter("deviceId", "==", device_id))
                .order_by("timestamp", direction="DESCENDING")
                .limit(limit)
                .stream()
            )
            return [d.to_dict() for d in docs]
    except Exception as e:
        err_str = str(e).lower()
        # If composite index is missing, fall back to unordered query
        if "index" in err_str or "failed precondition" in err_str:
            try:
                if USE_MOCK:
                    docs = (
                        db.collection(COLLECTION)
                        .where("deviceId", "==", device_id)
                        .limit(limit * 5)
                        .stream()
                    )
                    results = [d.to_dict() for d in docs if d.exists]
                else:
                    from google.cloud.firestore_v1.base_query import FieldFilter
                    docs = (
                        db.collection(COLLECTION)
                        .where(filter=FieldFilter("deviceId", "==", device_id))
                        .limit(limit * 5)
                        .stream()
                    )
                    results = [d.to_dict() for d in docs]
                # Sort in Python instead
                results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
                return results[:limit]
            except Exception as e2:
                print(f"❌ Firestore fallback query failed: {e2}")
                return []
        print(f"❌ Firestore query error: {e}")
        return []


@sensor_bp.route("/latest", methods=["GET"])
def get_latest():
    """Return the single most-recent sensor reading for a given device."""
    device_id = request.args.get("deviceId", "field-001")

    results = _query_device_readings(device_id, limit=1)
    if not results:
        return jsonify({"error": "No data found for device"}), 404

    # Fetch device status too
    try:
        device_doc = db.collection(DEVICES_COLLECTION).document(device_id).get()
        device = device_doc.to_dict() if device_doc.exists else {}
    except Exception:
        device = {}

    return jsonify({
        **results[0],
        "pumpStatus": device.get("pumpStatus", "OFF"),
        "waterLevel": results[0].get("waterLevel", device.get("waterLevel", "medium")),
        "autoMode": device.get("autoMode", False),
    })


@sensor_bp.route("/history", methods=["GET"])
def get_history():
    """Return paginated sensor history for charting."""
    device_id = request.args.get("deviceId", "field-001")
    limit = min(int(request.args.get("limit", 50)), 200)

    readings = _query_device_readings(device_id, limit=limit)
    # Return in ascending time order for charting
    readings.sort(key=lambda x: x.get("timestamp", ""))

    return jsonify({"deviceId": device_id, "count": len(readings), "readings": readings})
