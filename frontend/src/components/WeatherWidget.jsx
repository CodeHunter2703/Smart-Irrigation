import { useState, useEffect } from 'react'
import {
    Cloud, Wind, Droplets, Sunrise, Sunset,
    Thermometer, AlertTriangle, CheckCircle2, Info,
    RefreshCw, MapPin, CloudRain, Sun
} from 'lucide-react'

const CITY = import.meta.env.VITE_WEATHER_CITY || 'Mumbai'

function AdviceBanner({ advice }) {
    if (!advice) return null
    const styles = {
        green: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', Icon: CheckCircle2 },
        yellow: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', Icon: AlertTriangle },
        blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', Icon: Info },
    }
    const s = styles[advice.color] || styles.green
    const { Icon } = s
    return (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium ${s.bg} ${s.border} ${s.text}`}>
            <Icon size={16} className="flex-shrink-0" />
            {advice.message}
        </div>
    )
}

function ForecastSlot({ slot }) {
    return (
        <div className="flex flex-col items-center gap-1 min-w-[64px]">
            <span className="text-xs text-surface-400 font-medium">{slot.time}</span>
            <img src={slot.icon} alt={slot.description} className="w-10 h-10" />
            <span className="text-sm font-bold text-surface-800">{slot.temp}°</span>
            <span className="text-[10px] text-blue-500 font-semibold">{Math.round(slot.rainProbability * 100)}%</span>
        </div>
    )
}

export default function WeatherWidget({ city = CITY }) {
    const [weather, setWeather] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [refreshing, setRefreshing] = useState(false)
    const [lastUpdated, setLastUpdated] = useState(null)
    const [locationInfo, setLocationInfo] = useState(null)

    const resolveLocation = async () => {
        // ── Tier 1: Check if device document has GPS/IP coords ──────
        try {
            const res = await fetch(`/api/latest?deviceId=field-001`)
            if (res.ok) {
                const device = await res.json()
                if (device.lat && device.lon) {
                    return {
                        lat: device.lat,
                        lon: device.lon,
                        source: device.locationSource || 'device',
                        label: device.locationCity || city,
                    }
                }
            }
        } catch (_) { }

        // ── Tier 2: Browser Geolocation API ─────────────────────────
        try {
            const pos = await new Promise((resolve, reject) =>
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
            )
            return {
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
                source: 'browser',
                label: 'Your Location',
            }
        } catch (_) { }

        // ── Tier 3: Fallback to configured city name ─────────────────
        return { city, source: 'config', label: city }
    }

    const fetchWeather = async (showSpinner = false) => {
        if (showSpinner) setRefreshing(true)
        try {
            const loc = await resolveLocation()
            setLocationInfo(loc)
            let url = '/api/weather'
            if (loc.lat && loc.lon) {
                url += `?lat=${loc.lat}&lon=${loc.lon}`
            } else {
                url += `?city=${encodeURIComponent(loc.city || city)}`
            }
            const res = await fetch(url)
            if (!res.ok) throw new Error('Weather fetch failed')
            const data = await res.json()
            setWeather(data)
            setError(null)
            setLastUpdated(new Date())
        } catch (e) {
            console.error('Weather error:', e)
            setError(e.message || 'Unable to load weather data')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => {
        fetchWeather()
        const interval = setInterval(() => fetchWeather(), 10 * 60 * 1000) // refresh every 10 min
        return () => clearInterval(interval)
    }, [city])

    if (loading) {
        return (
            <div className="card animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl" />
                    <div className="h-5 w-32 bg-surface-200 rounded-lg" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-16 bg-surface-100 rounded-xl" />
                    ))}
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="card border border-red-100">
                <div className="flex items-center gap-2 text-red-500">
                    <AlertTriangle size={18} />
                    <span className="text-sm font-semibold">{error.message || String(error)}</span>
                </div>
            </div>
        )
    }

    const c = weather?.current
    const rainPct = Math.round((c?.rainProbability || 0) * 100)

    return (
        <div className="card space-y-5">
            {/* ── Header ─────────────────────────────────────── */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                        <Cloud size={18} className="text-blue-500" />
                    </div>
                    <div>
                        <h3 className="font-bold text-surface-900 leading-tight">Weather</h3>
                        <div className="flex items-center gap-1 text-xs text-surface-400">
                            <MapPin size={10} />
                            {weather.city}, {weather.country}
                            {locationInfo?.source === 'gps' && (
                                <span className="ml-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-semibold">📡 GPS</span>
                            )}
                            {locationInfo?.source === 'browser' && (
                                <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold">📍 Live</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <button
                        onClick={() => fetchWeather(true)}
                        disabled={refreshing}
                        className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-600 transition-colors disabled:opacity-40"
                        title="Refresh weather"
                    >
                        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                    {lastUpdated && (
                        <span className="text-[10px] text-surface-300">{lastUpdated.toLocaleTimeString()}</span>
                    )}
                </div>
            </div>

            {/* ── Current Temp Hero ──────────────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {c?.icon && (
                        <img src={c.icon} alt={c.description} className="w-16 h-16 drop-shadow-sm" />
                    )}
                    <div>
                        <div className="text-4xl font-black text-surface-900 leading-none">
                            {c?.temp}°<span className="text-xl font-semibold text-surface-400">C</span>
                        </div>
                        <p className="text-sm text-surface-500 mt-1 capitalize">{c?.description}</p>
                        <p className="text-xs text-surface-400">Feels like {c?.feelsLike}°C</p>
                    </div>
                </div>

                {/* Rain probability ring */}
                <div className="flex flex-col items-center gap-1">
                    <div className="relative w-16 h-16">
                        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="26" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                            <circle
                                cx="32" cy="32" r="26" fill="none"
                                stroke={rainPct >= 50 ? '#3b82f6' : '#10b981'}
                                strokeWidth="6"
                                strokeDasharray={`${(rainPct / 100) * 163} 163`}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className={`text-xs font-bold ${rainPct >= 50 ? 'text-blue-500' : 'text-emerald-500'}`}>{rainPct}%</span>
                        </div>
                    </div>
                    <span className="text-[10px] text-surface-400 font-medium">Rain chance</span>
                </div>
            </div>

            {/* ── Stat Grid ─────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-surface-50 rounded-xl p-3 flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Droplets size={16} className="text-blue-500" />
                    </div>
                    <div>
                        <p className="text-xs text-surface-400">Humidity</p>
                        <p className="text-sm font-bold text-surface-800">{c?.humidity}%</p>
                    </div>
                </div>

                <div className="bg-surface-50 rounded-xl p-3 flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Wind size={16} className="text-cyan-500" />
                    </div>
                    <div>
                        <p className="text-xs text-surface-400">Wind</p>
                        <p className="text-sm font-bold text-surface-800">{c?.windSpeed} <span className="text-xs font-normal">km/h</span></p>
                    </div>
                </div>

                <div className="bg-surface-50 rounded-xl p-3 flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Sunrise size={16} className="text-orange-400" />
                    </div>
                    <div>
                        <p className="text-xs text-surface-400">Sunrise</p>
                        <p className="text-sm font-bold text-surface-800">{c?.sunrise}</p>
                    </div>
                </div>

                <div className="bg-surface-50 rounded-xl p-3 flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Sunset size={16} className="text-rose-400" />
                    </div>
                    <div>
                        <p className="text-xs text-surface-400">Sunset</p>
                        <p className="text-sm font-bold text-surface-800">{c?.sunset}</p>
                    </div>
                </div>
            </div>

            {/* ── Irrigation Advice ─────────────────────────── */}
            <AdviceBanner advice={weather?.irrigationAdvice} />

            {/* ── Hourly Forecast ───────────────────────────── */}
            {weather?.forecast?.length > 0 && (
                <div>
                    <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">3-Hour Forecast</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {weather.forecast.map((slot, i) => (
                            <ForecastSlot key={i} slot={slot} />
                        ))}
                    </div>
                </div>
            )}

            {/* ── AI Rainfall Predictor ──────────────────────── */}
            <div className="mt-4 pt-4 border-t border-surface-100">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">AI Rainfall Prediction</p>
                    <button
                        onClick={async () => {
                            setRefreshing(true);
                            try {
                                const res = await fetch('/api/weather/store', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ city: weather?.city || city })
                                });
                                const data = await res.json();
                                if (data.success && data.data) {
                                    setWeather(w => ({ ...w, mlPrediction: data.data }));
                                }
                            } catch (e) {
                                console.error('Failed to fetch ML Prediction', e);
                            } finally {
                                setRefreshing(false);
                            }
                        }}
                        disabled={refreshing}
                        className="text-[10px] font-bold bg-primary-50 text-primary-600 px-2.5 py-1 rounded-lg hover:bg-primary-100 transition-colors"
                    >
                        {weather?.mlPrediction ? 'Recalculate' : 'Run Analysis'}
                    </button>
                </div>
                {weather?.mlPrediction ? (
                    <div className="flex items-center justify-between bg-surface-50 rounded-xl p-3 border border-surface-200">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${weather.mlPrediction.will_rain === 1 ? 'bg-blue-100' : 'bg-emerald-100'}`}>
                                {weather.mlPrediction.will_rain === 1 ? <CloudRain size={20} className="text-blue-500" /> : <Sun size={20} className="text-emerald-500" />}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-surface-900">
                                    {weather.mlPrediction.will_rain === 1 ? 'Rain Expected' : 'No Rain'}
                                </p>
                                <p className="text-xs text-surface-500">Based on past 7 days</p>
                            </div>
                        </div>
                        {weather.mlPrediction.will_rain === 1 && (
                            <div className="text-right">
                                <p className="text-lg font-black text-blue-600">{weather.mlPrediction.predicted_rainfall} <span className="text-xs font-semibold">mm</span></p>
                                <p className="text-[10px] text-surface-400">Predicted Volume</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-surface-50 rounded-xl p-4 text-center border border-dashed border-surface-200">
                        <p className="text-xs text-surface-500">Run the AI engine to predict rainfall intensity using XGBoost.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
