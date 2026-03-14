# 💧 Smart Irrigation Scheduler — AquaIQ

> **Hackathon 2026 | IoT + AI Track**
> An end-to-end IoT solution that replaces traditional timers with data-driven automation.

---

## 🏗 Architecture

```
Field (ESP32 + DHT22 + Soil Sensor)
        ↓  WiFi / LoRa fallback
Flask Backend (Decision Logic + Weather API)
        ↓
Firebase Firestore (sensor_readings, controls, logs, devices, settings)
        ↓
React Dashboard (Live charts, Controls, Schedule, Logs)
```

---

## 📁 Project Structure

```
Smart Irrigation/
├── backend/                  Flask API server
│   ├── app.py                Entry point + blueprint registration
│   ├── firebase_config.py    Firebase Admin SDK init (+ MockFirestore fallback)
│   ├── requirements.txt
│   ├── .env.example
│   └── routes/
│       ├── health.py         GET  /api/health
│       ├── sensor.py         POST /api/sensor-data
│       │                     GET  /api/latest
│       │                     GET  /api/history
│       ├── pump.py           POST /api/pump/on, /api/pump/off
│       │                     POST /api/valve/open, /api/valve/close
│       │                     POST /api/mode/automatic, /api/mode/manual
│       │                     POST /api/irrigation/start
│       ├── decision.py       POST /api/run-decision
│       │                     GET  /api/logs
│       ├── settings.py       GET/POST /api/settings
│       └── ml.py             GET  /api/ml/predict-schedule
│
└── frontend/                 React + Vite + Tailwind
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx            Routes + guards
    │   ├── api.js             API service layer
    │   ├── firebase.js        Firebase Web SDK
    │   ├── index.css          Tailwind + custom styles
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── pages/
    │   │   ├── LandingPage.jsx
    │   │   ├── LoginPage.jsx
    │   │   └── DashboardPage.jsx
    │   └── components/
    │       ├── SensorCards.jsx
    │       ├── SensorCharts.jsx
    │       ├── IrrigationControls.jsx
    │       ├── SchedulePanel.jsx
    │       ├── LogsTable.jsx
    │       └── SettingsPanel.jsx
    ├── .env.example
    ├── tailwind.config.js
    └── vite.config.js
```

---

## 🚀 Quick Start (Demo Mode — No Firebase Required)

### 1. Backend

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The Flask server starts on **http://localhost:5000**
In demo mode (no `firebase-credentials.json`), it uses an **in-memory MockFirestore** pre-seeded with 48 hours of sensor data.

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend starts on **http://localhost:5173**
- Click **"Enter as Demo User (skip auth)"** on the login page to bypass Firebase Auth.

---

## 🔥 Firebase Setup (Optional — for real data persistence)

1. Create a Firebase project at https://console.firebase.google.com
2. Enable **Firestore Database** (Native mode)
3. Enable **Authentication** → Email/Password provider
4. **Backend credentials**: Project Settings → Service Accounts → Generate new private key → save as `backend/firebase-credentials.json`
5. **Frontend config**: Project Settings → Your apps → Add Web App → copy config into `frontend/.env`

---

## 🌤 Weather API Setup (Optional)

1. Sign up at https://openweathermap.org/api (free tier)
2. Add your API key to `backend/.env`:
   ```
   OPENWEATHER_API_KEY=your_key_here
   WEATHER_CITY=YourCity
   ```
Without a key, the system uses realistic mock forecast data.

---

## 🔌 API Endpoints

| Method | Endpoint                   | Description                        |
|--------|----------------------------|------------------------------------|
| GET    | `/api/health`              | Server health check                |
| POST   | `/api/sensor-data`         | Ingest reading from ESP32          |
| GET    | `/api/latest?deviceId=`    | Latest sensor reading              |
| GET    | `/api/history?deviceId=`   | Historical readings (for charts)   |
| POST   | `/api/pump/on`             | Turn pump ON                       |
| POST   | `/api/pump/off`            | Turn pump OFF                      |
| POST   | `/api/valve/open`          | Open irrigation valve              |
| POST   | `/api/valve/close`         | Close irrigation valve             |
| POST   | `/api/mode/automatic`      | Set irrigation mode to automatic   |
| POST   | `/api/mode/manual`         | Set irrigation mode to manual      |
| POST   | `/api/irrigation/start`    | Start manual irrigation (minutes)  |
| POST   | `/api/run-decision`        | Run AI decision engine             |
| GET    | `/api/logs?deviceId=`      | Fetch event logs                   |
| GET    | `/api/settings?deviceId=`  | Get device settings                |
| POST   | `/api/settings`            | Update device settings             |
| GET    | `/api/ml/predict-schedule` | ML-predicted next irrigation time  |

---

## 🗂 Suggested Firebase Schema

Use Firestore documents keyed by `deviceId` for command + status sync:

```
sensor_readings (collection)
        └── auto-id document
                        ├── deviceId: "field-001"
                        ├── soilMoisture: 62.0
                        ├── temperature: 29.1
                        ├── humidity: 74
                        ├── waterLevel: "medium"       # low | medium | high
                        ├── pumpStatus: "OFF"
                        ├── network: "wifi"
                        └── timestamp: ISODate

controls (collection)
        └── field-001 (document)
                        ├── deviceId: "field-001"
                        ├── pump: "ON"                 # ON | OFF
                        ├── valve: "OPEN"              # OPEN | CLOSE
                        ├── irrigation_mode: "MANUAL"  # AUTOMATIC | MANUAL
                        ├── manual_irrigation:
                        │   ├── state: "STARTED"
                        │   ├── minutes: 10
                        │   └── requestedAt: ISODate
                        └── updatedAt: ISODate

devices (collection)
        └── field-001 (document)
                        ├── pumpStatus: "OFF"
                        ├── waterLevel: "medium"
                        ├── autoMode: true
                        └── lastSeen: ISODate
```

---

## 🧪 Simulate ESP32 Data (curl)

```bash
curl -X POST http://localhost:5000/api/sensor-data \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "field-001",
    "soilMoisture": 35,
    "temperature": 30,
    "humidity": 60,
    "network": "wifi"
  }'
```

---

## 🧠 ML Architecture (Production Roadmap)

Currently using heuristic trend analysis as LSTM placeholder.

**Full LSTM implementation (post-hackathon):**
```
Input:  (batch, 24, 4)   ← last 24 readings × [moisture, temp, humidity, hour_of_day]
LSTM1:  (64 units, return_sequences=True)
LSTM2:  (32 units)
Dense1: (16, ReLU)
Output: (1, Sigmoid)     ← irrigation probability
```

Training: Historical logs from Firestore, labeled with pump activation events.

---

## 📡 ESP32 Firmware Notes

The device should POST to `/api/sensor-data` every 30 seconds via HTTP.
On WiFi loss, it switches to LoRa and logs locally to SD card.
Set `network: "lora"` in the payload when using LoRa fallback.

---

**Built with React + Vite + Tailwind | Flask | Firebase | Recharts**
