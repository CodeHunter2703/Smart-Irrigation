"""
Firebase Admin SDK Configuration
==================================
Initializes Firestore using a service account JSON file.
In demo/hackathon mode (no credentials), falls back to MockFirestore
so the app still runs with in-memory data.
"""

import os
import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

FIREBASE_CRED_PATH = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-credentials.json")
USE_MOCK = False

db = None  # Will hold the Firestore client

# ─── Try to initialise real Firebase ───────────────────────────────────────────
try:
    import firebase_admin
    from firebase_admin import credentials, firestore as real_firestore

    if os.path.exists(FIREBASE_CRED_PATH):
        if not firebase_admin._apps:
            cred = credentials.Certificate(FIREBASE_CRED_PATH)
            firebase_admin.initialize_app(cred)
        db = real_firestore.client()
        logger.info("✅  Firebase Firestore connected (real credentials)")
    else:
        raise FileNotFoundError(f"Credentials file not found: {FIREBASE_CRED_PATH}")

except Exception as e:
    logger.warning(f"⚠️  Firebase init failed ({e}). Running in MOCK mode.")
    USE_MOCK = True


# ─── In-memory Mock Firestore ──────────────────────────────────────────────────
class MockDocument:
    """Simulates a single Firestore document."""

    def __init__(self, data=None):
        self._data = data or {}
        self.exists = data is not None

    def to_dict(self):
        return self._data


class MockCollection:
    """Simulates a Firestore collection with a simple list store."""

    def __init__(self, store, name):
        self._store = store  # shared dict: collection_name → list[dict]
        self._name = name

    def document(self, doc_id=None):
        return MockDocRef(self._store, self._name, doc_id)

    def add(self, data):
        data["_id"] = f"mock-{len(self._store.get(self._name, []))}"
        self._store.setdefault(self._name, []).append(data)
        return None, MockDocRef(self._store, self._name, data["_id"])

    def where(self, field, op, value):
        return MockQuery(self._store, self._name, [(field, op, value)])

    def order_by(self, field, direction=None):
        return MockQuery(self._store, self._name, [], order=field, direction=direction)

    def stream(self):
        docs = self._store.get(self._name, [])
        return [MockDocument(d) for d in docs]


class MockDocRef:
    def __init__(self, store, collection, doc_id):
        self._store = store
        self._collection = collection
        self._id = doc_id

    def get(self):
        docs = self._store.get(self._collection, [])
        for d in docs:
            if d.get("_id") == self._id or d.get("deviceId") == self._id:
                return MockDocument(d)
        return MockDocument(None)

    def set(self, data, merge=False):
        self._store.setdefault(self._collection, [])
        for i, d in enumerate(self._store[self._collection]):
            if d.get("_id") == self._id or d.get("deviceId") == self._id:
                if merge:
                    self._store[self._collection][i].update(data)
                else:
                    self._store[self._collection][i] = {**data, "_id": self._id}
                return
        entry = {**data, "_id": self._id}
        self._store[self._collection].append(entry)

    def update(self, data):
        self.set(data, merge=True)

    def collection(self, sub):
        return MockCollection(self._store, f"{self._collection}/{self._id}/{sub}")


class MockQuery:
    def __init__(self, store, name, filters, order=None, direction=None):
        self._store = store
        self._name = name
        self._filters = filters
        self._order = order
        self._direction = direction
        self._limit_val = None

    def where(self, field, op, value):
        self._filters.append((field, op, value))
        return self

    def order_by(self, field, direction=None):
        self._order = field
        self._direction = direction
        return self

    def limit(self, n):
        self._limit_val = n
        return self

    def stream(self):
        docs = list(self._store.get(self._name, []))
        for field, op, value in self._filters:
            if op == "==":
                docs = [d for d in docs if d.get(field) == value]
        if self._order:
            reverse = (self._direction == "DESCENDING")
            docs = sorted(docs, key=lambda d: d.get(self._order, ""), reverse=reverse)
        if self._limit_val:
            docs = docs[: self._limit_val]
        return [MockDocument(d) for d in docs]


class MockFirestore:
    """Top-level mock that mimics firebase_admin.firestore.client()."""

    def __init__(self):
        self._store = {}
        self._seed_demo_data()

    def collection(self, name):
        return MockCollection(self._store, name)

    def _seed_demo_data(self):
        """Pre-populate with realistic demo data so the dashboard looks great."""
        from datetime import timedelta
        import random

        now = datetime.now(timezone.utc)
        device_id = "field-001"

        # Seed sensor readings (last 24 hours, one per 30 min)
        readings = []
        for i in range(48, 0, -1):
            ts = now - timedelta(minutes=30 * i)
            readings.append({
                "_id": f"r{i}",
                "deviceId": device_id,
                "soilMoisture": round(random.uniform(28, 72), 1),
                "temperature": round(random.uniform(24, 34), 1),
                "humidity": round(random.uniform(45, 80), 1),
                "waterLevel": random.choice(["medium", "medium", "high", "low"]),
                "pumpStatus": random.choice(["OFF", "OFF", "ON"]),
                "network": random.choice(["wifi", "wifi", "wifi", "lora"]),
                "timestamp": ts.isoformat(),
            })
        self._store["sensor_readings"] = readings

        # Seed device status
        latest = readings[-1]
        self._store["devices"] = [{
            "_id": device_id,
            "deviceId": device_id,
            "pumpStatus": "OFF",
            "waterLevel": "medium",
            "network": "wifi",
            "lastSeen": now.isoformat(),
            "autoMode": True,
        }]

        # Seed controls state for dashboard command/status sync
        self._store["controls"] = [{
            "_id": device_id,
            "deviceId": device_id,
            "pump": "OFF",
            "valve": "CLOSE",
            "irrigation_mode": "AUTOMATIC",
            "updatedAt": now.isoformat(),
        }]

        # Seed settings
        self._store["settings"] = [{
            "_id": device_id,
            "deviceId": device_id,
            "moistureThreshold": 40,
            "autoMode": True,
        }]

        # Seed logs
        log_messages = [
            ("INFO",  "System initialised — Smart Irrigation Scheduler started"),
            ("INFO",  "WiFi connected — device field-001 online"),
            ("WARN",  "Soil moisture dropped to 32% — threshold: 40%"),
            ("INFO",  "Moisture low → Pump ON"),
            ("INFO",  "Pump ran for 15 minutes — moisture reached 58%"),
            ("INFO",  "Pump OFF — target moisture achieved"),
            ("WARN",  "WiFi lost → switched to LoRa fallback"),
            ("INFO",  "LoRa link active — offline survival mode engaged"),
            ("INFO",  "WiFi restored — switching back from LoRa"),
            ("INFO",  "Weather API: rain probability 75% — irrigation skipped"),
            ("INFO",  "Forecast rain → Pump skipped"),
            ("WARN",  "Sensor anomaly detected — moisture spike to 99%"),
            ("INFO",  "Anomaly filtered — using last valid reading"),
            ("INFO",  "Auto-schedule: next irrigation at 06:00 tomorrow"),
            ("INFO",  "Fail-safe mode activated — pump OFF due to sensor timeout"),
        ]
        logs = []
        for idx, (ltype, msg) in enumerate(log_messages):
            ts = now - timedelta(hours=len(log_messages) - idx)
            logs.append({
                "_id": f"log{idx}",
                "deviceId": device_id,
                "type": ltype,
                "message": msg,
                "timestamp": ts.isoformat(),
            })
        self._store["logs"] = logs


if USE_MOCK:
    db = MockFirestore()
    logger.info("🔶  MockFirestore ready with seeded demo data")
