"""
Settings Routes
===============
GET  /api/settings  — Retrieve device settings
POST /api/settings  — Update device settings
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from firebase_config import db

settings_bp = Blueprint("settings", __name__)
COLLECTION = "settings"
DEVICES_COLLECTION = "devices"


@settings_bp.route("/settings", methods=["GET"])
def get_settings():
    device_id = request.args.get("deviceId", "field-001")
    doc = db.collection(COLLECTION).document(device_id).get()
    if doc.exists:
        return jsonify(doc.to_dict())

    # Return sensible defaults
    defaults = {
        "deviceId": device_id,
        "moistureThreshold": 40,
        "autoMode": True,
        "location": "Field A",
        "timezone": "Asia/Kolkata",
    }
    return jsonify(defaults)


@settings_bp.route("/settings", methods=["POST"])
def update_settings():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "Invalid JSON body"}), 400

    device_id = body.get("deviceId", "field-001")
    ts = datetime.now(timezone.utc).isoformat()

    allowed_keys = {"moistureThreshold", "autoMode", "deviceId", "location", "timezone"}
    update_data = {k: v for k, v in body.items() if k in allowed_keys}
    update_data["deviceId"] = device_id
    update_data["updatedAt"] = ts

    db.collection(COLLECTION).document(device_id).set(update_data, merge=True)

    # Sync autoMode to device document as well
    if "autoMode" in update_data:
        db.collection(DEVICES_COLLECTION).document(device_id).set(
            {"autoMode": update_data["autoMode"]}, merge=True
        )

    return jsonify({"status": "updated", "settings": update_data})
