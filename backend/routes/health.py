"""
GET /api/health
---------------
Simple health-check endpoint. Returns server status and timestamp.
"""

from flask import Blueprint, jsonify
from datetime import datetime, timezone

health_bp = Blueprint("health", __name__)


@health_bp.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "Smart Irrigation Scheduler API",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
    })
