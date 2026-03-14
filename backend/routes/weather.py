"""
Weather Route — WeatherAPI.com
==============================
GET /api/weather?city=Mumbai
GET /api/weather?lat=18.97&lon=72.83

Uses https://www.weatherapi.com (free tier — no activation delay).
Supports city name, lat/lon coordinates, or IP address as query param.
Falls back to rich mock data if the API key is missing or fails.
"""

import os
import random
import requests
from pathlib import Path
from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone, timedelta

# Force-load the .env from backend/ (parent of routes/)
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_env_path, override=False)
print(f"🌍 WeatherAPI key loaded: {'YES' if os.getenv('OPENWEATHER_API_KEY') else 'NO'} (path: {_env_path})")

weather_bp = Blueprint("weather", __name__)

DEFAULT_CITY    = os.getenv("WEATHER_CITY", "Mumbai")
WEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
BASE_URL        = "https://api.weatherapi.com/v1"


# ─── Mock data (used when no API key) ─────────────────────────────────────────

def _mock_weather(city: str) -> dict:
    conditions = [
        ("Sunny",           "//cdn.weatherapi.com/weather/64x64/day/113.png",  0.05),
        ("Partly cloudy",   "//cdn.weatherapi.com/weather/64x64/day/116.png",  0.10),
        ("Overcast",        "//cdn.weatherapi.com/weather/64x64/day/122.png",  0.20),
        ("Light rain",      "//cdn.weatherapi.com/weather/64x64/day/296.png",  0.65),
        ("Moderate rain",   "//cdn.weatherapi.com/weather/64x64/day/302.png",  0.85),
        ("Patchy rain",     "//cdn.weatherapi.com/weather/64x64/day/176.png",  0.40),
    ]
    cond = random.choice(conditions)
    temp = round(random.uniform(22, 38), 1)
    now  = datetime.now(timezone.utc)

    forecast = []
    for i in range(5):
        fc = random.choice(conditions)
        t  = now + timedelta(hours=(i + 1) * 3)
        forecast.append({
            "time": t.strftime("%H:%M"),
            "temp": round(temp + random.uniform(-4, 4), 1),
            "description": fc[0],
            "icon": f"https:{fc[1]}",
            "rainProbability": round(max(0, fc[2] + random.uniform(-0.1, 0.1)), 2),
            "humidity": random.randint(40, 95),
            "windSpeed": round(random.uniform(5, 25), 1),
        })

    rain_prob = round(cond[2] + random.uniform(-0.05, 0.1), 2)
    humidity  = random.randint(45, 90)

    return {
        "source": "mock",
        "city": city,
        "country": "IN",
        "region": "",
        "current": {
            "temp": temp,
            "feelsLike": round(temp + random.uniform(-3, 3), 1),
            "humidity": humidity,
            "windSpeed": round(random.uniform(5, 25), 1),
            "windDir": random.choice(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]),
            "uvIndex": round(random.uniform(1, 10), 1),
            "visibility": round(random.uniform(5, 20), 1),
            "description": cond[0],
            "icon": f"https:{cond[1]}",
            "rainProbability": rain_prob,
            "sunrise": "06:15",
            "sunset": "18:45",
            "isDay": True,
        },
        "forecast": forecast,
        "irrigationAdvice": _irrigation_advice(rain_prob, humidity),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _irrigation_advice(rain_prob: float, humidity: int) -> dict:
    if rain_prob >= 0.7:
        return {"action": "skip",     "message": "Heavy rain expected — skip irrigation today",       "color": "blue"}
    elif rain_prob >= 0.4:
        return {"action": "reduce",   "message": "Light rain likely — reduce irrigation by 50%",      "color": "yellow"}
    elif humidity > 80:
        return {"action": "reduce",   "message": "High humidity — reduce irrigation slightly",        "color": "yellow"}
    else:
        return {"action": "irrigate", "message": "Dry conditions — proceed with normal schedule",     "color": "green"}


# ─── Live API call ─────────────────────────────────────────────────────────────

@weather_bp.route("/weather", methods=["GET"])
def get_weather():
    city = request.args.get("city", DEFAULT_CITY)
    lat  = request.args.get("lat",  type=float)
    lon  = request.args.get("lon",  type=float)

    # Prefer lat/lon if provided (more precise than city name)
    if lat is not None and lon is not None:
        q = f"{lat},{lon}"
        location_source = "gps"
    else:
        q = city
        location_source = "city"

    print(f"🔑 WEATHER_API_KEY at request time: {repr(WEATHER_API_KEY)}")
    if not WEATHER_API_KEY:
        print("⚠️  No API key — returning mock")
        return jsonify(_mock_weather(city))
        return jsonify(_mock_weather(city))

    try:
        # ── Current + 1-day forecast in a single call ──────────────────
        resp = requests.get(
            f"{BASE_URL}/forecast.json",
            params={
                "key":   WEATHER_API_KEY,
                "q":     q,
                "days":  1,
                "aqi":   "no",
                "alerts":"no",
            },
            timeout=8,
        )
        resp.raise_for_status()
        data = resp.json()

        loc  = data["location"]
        cur  = data["current"]
        day  = data["forecast"]["forecastday"][0]

        # Sunrise / sunset from forecast day
        sunrise = day["astro"]["sunrise"]   # e.g. "06:22 AM"
        sunset  = day["astro"]["sunset"]    # e.g. "06:48 PM"

        # Hourly forecast — pick next 5 slots after current hour
        now_hour   = datetime.now().hour
        hourly_raw = day["hour"]
        upcoming   = [h for h in hourly_raw if datetime.fromtimestamp(h["time_epoch"]).hour > now_hour][:5]
        if not upcoming:
            upcoming = hourly_raw[-5:]

        forecast_slots = [
            {
                "time":            datetime.fromtimestamp(h["time_epoch"]).strftime("%H:%M"),
                "temp":            round(h["temp_c"], 1),
                "description":     h["condition"]["text"],
                "icon":            f"https:{h['condition']['icon']}",
                "rainProbability": round(h["chance_of_rain"] / 100, 2),
                "humidity":        h["humidity"],
                "windSpeed":       round(h["wind_kph"], 1),
            }
            for h in upcoming
        ]

        rain_prob_pct = day["day"]["daily_chance_of_rain"]
        rain_prob     = round(rain_prob_pct / 100, 2)
        humidity      = cur["humidity"]

        return jsonify({
            "source":         "weatherapi",
            "city":           loc["name"],
            "region":         loc.get("region", ""),
            "country":        loc["country"],
            "lat":            loc["lat"],
            "lon":            loc["lon"],
            "locationSource": location_source,
            "current": {
                "temp":            round(cur["temp_c"], 1),
                "feelsLike":       round(cur["feelslike_c"], 1),
                "humidity":        humidity,
                "windSpeed":       round(cur["wind_kph"], 1),
                "windDir":         cur.get("wind_dir", ""),
                "uvIndex":         cur.get("uv"),
                "visibility":      cur.get("vis_km"),
                "description":     cur["condition"]["text"],
                "icon":            f"https:{cur['condition']['icon']}",
                "rainProbability": rain_prob,
                "sunrise":         sunrise,
                "sunset":          sunset,
                "isDay":           bool(cur.get("is_day", 1)),
            },
            "forecast":          forecast_slots,
            "irrigationAdvice":  _irrigation_advice(rain_prob, humidity),
            "timestamp":         datetime.now(timezone.utc).isoformat(),
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

import pandas as pd
from firebase_config import db
from firebase_admin import firestore

def fetch_weather_history(city: str) -> list:
    """Fetch current + last 7 days historical weather from weatherapi.com"""
    import requests
    import random
    from datetime import datetime, timedelta, timezone
    
    now = datetime.now(timezone.utc)
    
    if not WEATHER_API_KEY:
        print("⚠️  No API key — generating mock history data")
        records = []
        for i in range(7, -1, -1):
            dt = now - timedelta(days=i)
            records.append({
                "datetime": dt.strftime("%Y-%m-%d %H:%M"),
                "temp": round(random.uniform(22, 38), 1),
                "humidity": random.randint(40, 95),
                "sealevelpressure": random.randint(1000, 1020),
                "cloudcover": random.randint(0, 100),
                "precip_mm": round(random.uniform(0, 15) if random.random() > 0.6 else 0.0, 1)
            })
        return records

    records = []
    current_hour = now.hour

    # 1. Fetch history for past 7 days
    for i in range(7, 0, -1):
        dt = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        try:
            resp = requests.get(
                f"{BASE_URL}/history.json",
                params={"key": WEATHER_API_KEY, "q": city, "dt": dt},
                timeout=5
            )
            if resp.status_code == 200:
                data = resp.json()
                hour_data = data["forecast"]["forecastday"][0]["hour"][current_hour]
                records.append({
                    "datetime": hour_data["time"],
                    "temp": hour_data["temp_c"],
                    "humidity": hour_data["humidity"],
                    "sealevelpressure": hour_data["pressure_mb"],
                    "cloudcover": hour_data["cloud"],
                    "precip_mm": hour_data["precip_mm"]
                })
        except Exception as e:
            print(f"Error fetching history for {dt}: {e}")

    # 2. Fetch current weather
    try:
        resp = requests.get(
            f"{BASE_URL}/current.json",
            params={"key": WEATHER_API_KEY, "q": city},
            timeout=5
        )
        if resp.status_code == 200:
            data = resp.json()
            cur = data["current"]
            loc = data["location"]
            records.append({
                "datetime": loc["localtime"],
                "temp": cur["temp_c"],
                "humidity": cur["humidity"],
                "sealevelpressure": cur["pressure_mb"],
                "cloudcover": cur["cloud"],
                "precip_mm": cur["precip_mm"]
            })
    except Exception as e:
        print(f"Error fetching current weather: {e}")

    # If API failed, return mock data
    if not records:
        print("⚠️  API calls failed — generating mock history data")
        for i in range(7, -1, -1):
            dt = now - timedelta(days=i)
            records.append({
                "datetime": dt.strftime("%Y-%m-%d %H:%M"),
                "temp": round(random.uniform(22, 38), 1),
                "humidity": random.randint(40, 95),
                "sealevelpressure": random.randint(1000, 1020),
                "cloudcover": random.randint(0, 100),
                "precip_mm": round(random.uniform(0, 5) if random.random() > 0.5 else 0.0, 1)
            })
            
    return records


def compute_rain_features(df: pd.DataFrame) -> pd.DataFrame:
    """Engineers rainfall features exactly like the ML training pipeline."""
    df["datetime"] = pd.to_datetime(df["datetime"])
    df = df.sort_values(by="datetime", ascending=True).reset_index(drop=True)
    
    if "precip_mm" not in df.columns:
        df["precip_mm"] = 0.0
    
    df["precip_mm"] = df["precip_mm"].fillna(0)
    
    # ML specific logic exactly as requested:
    df["rain_lag1"] = df["precip_mm"].shift(1)
    df["rain_roll3"] = df["precip_mm"].rolling(3, min_periods=1).mean()
    df["rain_roll7"] = df["precip_mm"].rolling(7, min_periods=1).mean()
    
    return df


@weather_bp.route("/weather/store", methods=["POST"])
def store_weather_features():
    """
    POST /api/weather/store
    Fetches current + last 7 days historical weather, computes engineered 
    features, and stores the latest row in Firestore. Does not run prediction.
    """
    try:
        data = request.json or {}
        city = data.get("city", DEFAULT_CITY)
        
        records = fetch_weather_history(city)
        if not records:
            return jsonify({"error": "Failed to fetch weather data"}), 502
            
        df = pd.DataFrame(records)
        df_features = compute_rain_features(df)
        
        # Extract the latest row
        latest = df_features.iloc[-1]
        
        # ML PREDICTION LOGIC
        import pickle
        import os
        import xgboost  # Ensure xgboost is available, otherwise model loading might fail implicitly
        
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        will_rain = 0
        predicted_rainfall = 0.0
        
        try:
            with open(os.path.join(backend_dir, "model_features.pkl"), "rb") as f:
                features = pickle.load(f)
            with open(os.path.join(backend_dir, "rain_classifier.pkl"), "rb") as f:
                clf = pickle.load(f)
            with open(os.path.join(backend_dir, "rain_regressor.pkl"), "rb") as f:
                reg = pickle.load(f)
            
            # Prepare the 1-row DataFrame with the exact features required
            X_pred = pd.DataFrame([latest])
            X_pred = X_pred[features]
            
            # Predict
            will_rain = int(clf.predict(X_pred)[0])
            if will_rain == 1:
                predicted_rainfall = round(float(reg.predict(X_pred)[0]), 2)
                # Ensure no negative rainfall
                if predicted_rainfall < 0:
                    predicted_rainfall = 0.0
            
        except Exception as e:
            print(f"⚠️ ML Prediction failed: {e}")
            import traceback
            traceback.print_exc()
        
        # Format the document for Firestore using server timestamp
        doc_data = {
            "timestamp": firestore.SERVER_TIMESTAMP,
            "temp": float(latest["temp"]),
            "humidity": float(latest["humidity"]),
            "sealevelpressure": float(latest["sealevelpressure"]),
            "cloudcover": float(latest["cloudcover"]),
            "rain_lag1": float(latest["rain_lag1"]) if pd.notna(latest["rain_lag1"]) else 0.0,
            "rain_roll3": float(latest["rain_roll3"]) if pd.notna(latest["rain_roll3"]) else 0.0,
            "rain_roll7": float(latest["rain_roll7"]) if pd.notna(latest["rain_roll7"]) else 0.0,
            "will_rain": will_rain,
            "predicted_rainfall": predicted_rainfall
        }
        
        # Store structured weather features in Firestore
        db.collection("weather_features").add(doc_data)
        
        # Return success (exclude SERVER_TIMESTAMP for JSON response)
        resp_data = doc_data.copy()
        resp_data["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        return jsonify({
            "success": True,
            "message": "Weather features stored successfully",
            "data": resp_data
        }), 201

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

