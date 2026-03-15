"""
Smart Irrigation Scheduler - Flask Backend
==========================================
Central controller that handles:
  - Sensor data ingestion (from ESP32 via HTTP/MQTT)
  - Decision logic (moisture + weather → pump control)
  - Firebase Firestore integration
  - MQTT simulation (print-based)
  - Weather API (real or mocked)
  - ML placeholder for LSTM-based scheduling
"""

from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
import os

load_dotenv(override=True)

# Debug: confirm Gemini key is loaded
_gk = os.getenv("GEMINI_API_KEY", "")
print(f"🔑 Gemini API key: {'LOADED (' + _gk[:8] + '...)' if _gk else 'NOT SET — will use demo fallback'}")

from routes.sensor import sensor_bp
from routes.pump import pump_bp
from routes.decision import decision_bp
from routes.settings import settings_bp
from routes.ml import ml_bp
from routes.health import health_bp
from routes.weather import weather_bp
from routes.community import community_bp
from routes.gemini import gemini_bp
from routes.plant_disease import plant_disease_bp
from routes.rain_forecast import rain_forecast_bp

app = Flask(__name__)

# Allow requests from the React frontend
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Register all route blueprints under /api prefix
app.register_blueprint(health_bp, url_prefix="/api")
app.register_blueprint(sensor_bp, url_prefix="/api")
app.register_blueprint(pump_bp, url_prefix="/api")
app.register_blueprint(decision_bp, url_prefix="/api")
app.register_blueprint(settings_bp, url_prefix="/api")
app.register_blueprint(ml_bp, url_prefix="/api")
app.register_blueprint(weather_bp, url_prefix="/api")
app.register_blueprint(community_bp, url_prefix="/api")
app.register_blueprint(gemini_bp, url_prefix="/api")
app.register_blueprint(plant_disease_bp, url_prefix="/api")
app.register_blueprint(rain_forecast_bp, url_prefix="/api")

if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "true").lower() == "true"
    print(f"🚀 Smart Irrigation Backend running on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
