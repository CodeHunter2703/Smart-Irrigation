import { useState, useCallback } from 'react'
import * as api from '../api'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const FEATURE_META = {
  temp:             { label: 'Temperature',         unit: '°C',  icon: '🌡️' },
  humidity:         { label: 'Humidity',             unit: '%',   icon: '💧' },
  sealevelpressure: { label: 'Sea-Level Pressure',  unit: 'hPa', icon: '🌊' },
  cloudcover:       { label: 'Cloud Cover',          unit: '%',   icon: '☁️' },
  windspeed:        { label: 'Wind Speed',           unit: 'km/h',icon: '💨' },
  rain_lag1:        { label: 'Rainfall Lag-1',       unit: 'mm',  icon: '🌧️' },
  rain_roll3:       { label: 'Rainfall Roll-3',      unit: 'mm',  icon: '📊' },
  rain_roll7:       { label: 'Rainfall Roll-7',      unit: 'mm',  icon: '📈' },
}

const DEFAULT_MANUAL = {
  temp: 28, humidity: 65, sealevelpressure: 1013, cloudcover: 40, windspeed: 10,
  rain_lag1: 0, rain_roll3: 0, rain_roll7: 0,
}

function Chip({ children, color = 'blue' }) {
  const colors = {
    blue:  { bg: 'rgba(99,102,241,0.15)',  border: 'rgba(99,102,241,0.4)',  text: '#a5b4fc' },
    green: { bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.4)',   text: '#4ade80' },
    red:   { bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.4)',   text: '#f87171' },
    amber: { bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.4)',  text: '#fbbf24' },
  }
  const c = colors[color] || colors.blue
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700,
    }}>{children}</span>
  )
}

function ProbBar({ value, color }) {
  const pct = Math.round(value * 100)
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: 'rgba(30,41,59,0.8)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 99,
          background: `linear-gradient(90deg, ${color}80, ${color})`,
          transition: 'width 1s cubic-bezier(.4,0,.2,1)',
        }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color, minWidth: 36 }}>{pct}%</span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RainForecastCard() {
  const [mode, setMode]               = useState('latest')      // 'latest' | 'date' | 'manual'
  const [selectedDate, setSelectedDate] = useState('')
  const [manualFeatures, setManualFeatures] = useState({ ...DEFAULT_MANUAL })
  const [loading, setLoading]         = useState(false)
  const [result, setResult]           = useState(null)
  const [error, setError]             = useState(null)
  const [geminiInsight, setGeminiInsight] = useState(null)
  const [geminiLoading, setGeminiLoading] = useState(false)

  // ── Gemini insight ────────────────────────────────────────────────────────
  const fetchGeminiInsight = useCallback(async (res) => {
    setGeminiLoading(true)
    setGeminiInsight(null)
    try {
      const willRain = res.will_rain
      const prob = Math.round(res.rain_probability * 100)
      const mm = res.rainfall_mm
      const query = willRain
        ? `The AI rain forecasting model predicts RAIN with ${prob}% probability (~${mm}mm). 
           Based on this:
           1. Should the farmer skip or delay irrigation today?
           2. What crops are most at risk from this rain?
           3. Any waterlogging prevention tips?
           4. What should the farmer do with the irrigation pump?`
        : `The AI rain forecasting model predicts NO RAIN with ${prob}% confidence.
           1. Should the farmer irrigate today?
           2. What is the recommended watering schedule given dry conditions?
           3. Any soil moisture conservation tips?`
      const r = await api.askGemini(query, {})
      setGeminiInsight(r.answer)
    } catch {
      setGeminiInsight('Could not fetch AI insights — check the Gemini API key.')
    }
    setGeminiLoading(false)
  }, [])

  // ── Run forecast ──────────────────────────────────────────────────────────
  const runForecast = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setGeminiInsight(null)
    try {
      let payload
      if (mode === 'manual') {
        payload = { mode: 'manual', features: manualFeatures }
      } else if (mode === 'date' && selectedDate) {
        payload = { mode: 'date', date: selectedDate, deviceId: 'field-001' }
      } else {
        payload = { mode: 'latest', deviceId: 'field-001' }
      }
      const res = await api.predictRain(payload)
      setResult(res)
      fetchGeminiInsight(res)
    } catch (e) {
      setError(e.message || 'Prediction failed')
    } finally {
      setLoading(false)
    }
  }, [mode, selectedDate, manualFeatures, fetchGeminiInsight])

  const modeBtnStyle = (m) => ({
    padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700,
    cursor: 'pointer', border: '1px solid',
    background: mode === m ? 'rgba(99,102,241,0.25)' : 'transparent',
    borderColor: mode === m ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.2)',
    color: mode === m ? '#a5b4fc' : '#64748b',
    transition: 'all 0.2s',
  })

  const featOrder = result?.feature_order || Object.keys(FEATURE_META)
  const importance = result?.feature_importance || {}
  const maxImp = Math.max(...Object.values(importance), 0.001)

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      border: '1px solid rgba(99,102,241,0.2)',
      borderRadius: 20, padding: '28px 28px 24px',
      color: '#f1f5f9', fontFamily: "'Inter', system-ui, sans-serif",
      boxShadow: '0 25px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* bg glow */}
      <div style={{
        position: 'absolute', top: -60, right: -60, width: 200, height: 200,
        background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 14,
          background: 'linear-gradient(135deg, #1d4ed8, #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
        }}>🌧️</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>Rain Forecasting</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Two-stage cascade · rain_classifier.pkl → rain_regressor.pkl · 8 features
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {result && <Chip color={result.will_rain ? 'blue' : 'green'}>
            {result.will_rain ? '🌧️ Rain Predicted' : '☀️ No Rain'}
          </Chip>}
        </div>
      </div>

      {/* ── Judge Mode Controls ── */}
      <div style={{
        background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: 16, padding: '16px 18px', marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
          ⚖️ Judge Mode — Select Input
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {[
            { id: 'latest', label: '▶ Latest Firestore Data' },
            { id: 'date',   label: '📅 Pick a Date' },
            { id: 'manual', label: '✏️ Manual Input' },
          ].map(({ id, label }) => (
            <button key={id} style={modeBtnStyle(id)} onClick={() => setMode(id)}>{label}</button>
          ))}
        </div>

        {mode === 'date' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 12, color: '#94a3b8' }}>Select date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{
                background: 'rgba(15,23,42,0.8)', color: '#f1f5f9',
                border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8,
                padding: '6px 10px', fontSize: 13, outline: 'none',
              }}
            />
          </div>
        )}

        {mode === 'manual' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 10, marginTop: 4 }}>
            {Object.entries(FEATURE_META).map(([key, meta]) => (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>
                  {meta.icon} {meta.label} ({meta.unit})
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={manualFeatures[key]}
                  onChange={e => setManualFeatures(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                  style={{
                    background: 'rgba(15,23,42,0.8)', color: '#f1f5f9',
                    border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8,
                    padding: '6px 10px', fontSize: 13, outline: 'none',
                  }}
                />
              </label>
            ))}
          </div>
        )}

        <button
          id="rain-forecast-run-btn"
          onClick={runForecast}
          disabled={loading || (mode === 'date' && !selectedDate)}
          style={{
            marginTop: 14, padding: '10px 22px', borderRadius: 12, fontWeight: 700,
            fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
            background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
            color: '#fff', border: 'none', opacity: loading ? 0.7 : 1,
            display: 'inline-flex', alignItems: 'center', gap: 8,
            boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
            transition: 'all 0.2s',
          }}
        >
          {loading ? (
            <>
              <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'rain-spin 0.8s linear infinite' }} />
              Running forecast…
            </>
          ) : '⚡ Run Rain Forecast'}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#fca5a5', fontSize: 13,
        }}>⚠️ {error}</div>
      )}

      {/* ── Results ── */}
      {result && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* ── Model Input Features Table ── */}
          <div style={{
            background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 14, padding: '16px 18px',
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#94a3b8', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              📋 Model Input Features
              <Chip color="blue">
                {result.readings_used > 0 ? `From ${result.readings_used} Firestore readings` : result.data_source}
              </Chip>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
              {featOrder.map(key => {
                const meta = FEATURE_META[key] || { label: key, unit: '', icon: '📊' }
                const val = result.features_used?.[key]
                return (
                  <div key={key} style={{
                    background: 'rgba(15,23,42,0.6)', borderRadius: 10, padding: '10px 12px',
                    border: '1px solid rgba(99,102,241,0.15)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{meta.icon} {meta.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginTop: 2 }}>
                        {val != null ? Number(val).toFixed(2) : '—'}
                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400, marginLeft: 3 }}>{meta.unit}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Cascade Logic Visualizer ── */}
          <div style={{
            background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 14, padding: '16px 18px',
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
              🔗 Forecasting Model — Cascade Logic
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(result.cascade_steps || []).map((step, idx) => (
                <div key={idx}>
                  <div style={{
                    background: step.step === 1
                      ? (result.will_rain ? 'rgba(99,102,241,0.12)' : 'rgba(34,197,94,0.1)')
                      : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${step.step === 1 ? (result.will_rain ? 'rgba(99,102,241,0.35)' : 'rgba(34,197,94,0.35)') : 'rgba(239,68,68,0.35)'}`,
                    borderRadius: 12, padding: '14px 16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 8,
                        background: step.step === 1 ? '#4f46e5' : '#dc2626',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0,
                      }}>{step.step}</div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{step.name}</div>
                      <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', marginLeft: 2 }}>({step.model})</div>
                      <div style={{ marginLeft: 'auto' }}>
                        <Chip color={step.step === 1 ? (result.will_rain ? 'blue' : 'green') : 'red'}>
                          {step.output}
                        </Chip>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: step.step === 1 ? 10 : 0 }}>
                      {step.description}
                    </div>
                    {step.step === 1 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 11, color: '#94a3b8', width: 80 }}>🌧️ Rain</span>
                          <ProbBar value={result.rain_probability} color="#6366f1" />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 11, color: '#94a3b8', width: 80 }}>☀️ No Rain</span>
                          <ProbBar value={result.no_rain_probability} color="#22c55e" />
                        </div>
                      </div>
                    )}
                  </div>
                  {idx < (result.cascade_steps.length - 1) && (
                    <div style={{ textAlign: 'center', color: '#4f46e5', fontSize: 18, margin: '4px 0' }}>↓</div>
                  )}
                </div>
              ))}

              {/* Irrigation Advice */}
              <div style={{
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{ fontSize: 20 }}>
                  {result.irrigation_action === 'skip' ? '⏸️' : result.irrigation_action === 'reduce' ? '🔄' : '💧'}
                </span>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 2 }}>Irrigation Recommendation</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>{result.irrigation_advice}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Feature Importance ── */}
          {Object.keys(importance).length > 0 && (
            <div style={{
              background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 14, padding: '16px 18px',
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>
                🎯 Feature Importance (Classifier)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(importance)
                  .sort(([, a], [, b]) => b - a)
                  .map(([key, val]) => {
                    const meta = FEATURE_META[key] || { label: key, unit: '', icon: '📊' }
                    const pct = Math.round((val / maxImp) * 100)
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, color: '#94a3b8', width: 140, flexShrink: 0 }}>
                          {meta.icon} {meta.label}
                        </span>
                        <div style={{ flex: 1, height: 8, background: 'rgba(15,23,42,0.8)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{
                            width: `${pct}%`, height: '100%', borderRadius: 99,
                            background: 'linear-gradient(90deg, #4f46e580, #6366f1)',
                            transition: 'width 0.8s cubic-bezier(.4,0,.2,1)',
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#a5b4fc', width: 38, textAlign: 'right', fontWeight: 700 }}>
                          {(val * 100).toFixed(1)}%
                        </span>
                      </div>
                    )
                  })}
              </div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 10 }}>
                * Derived from classifier model's feature_importances_ (tree-based) or |coef| (linear)
              </div>
            </div>
          )}

          {/* ── Gemini AI Insights ── */}
          <div style={{
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: 14, padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
              }}>✨</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Gemini AI — Farming Advice</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Based on rain forecast output</div>
              </div>
              {geminiLoading && (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 14, height: 14, border: '2px solid rgba(99,102,241,0.3)', borderTop: '2px solid #818cf8', borderRadius: '50%', animation: 'rain-spin 0.8s linear infinite' }} />
                  <span style={{ fontSize: 11, color: '#64748b' }}>Analyzing…</span>
                </div>
              )}
            </div>
            {geminiInsight ? (
              <div style={{ fontSize: 13, lineHeight: 1.75, color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
                {geminiInsight.replace(/\*\*(.*?)\*\*/g, '$1')}
              </div>
            ) : geminiLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[85, 65, 92, 75, 50].map((w, i) => (
                  <div key={i} style={{
                    height: 11, borderRadius: 5, background: 'rgba(99,102,241,0.15)',
                    width: `${w}%`, animation: 'rain-pulse 1.5s ease-in-out infinite',
                    animationDelay: `${i * 0.12}s`,
                  }} />
                ))}
              </div>
            ) : null}
          </div>

          {/* ── Meta info footer ── */}
          <div style={{ fontSize: 10, color: '#334155', display: 'flex', gap: 16, flexWrap: 'wrap', paddingTop: 4 }}>
            <span>Generated: {new Date(result.generated_at).toLocaleString()}</span>
            <span>Source: {result.data_source}</span>
            <span>Model: {result.model_status}</span>
            <span>Readings used: {result.readings_used}</span>
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {!result && !loading && !error && (
        <div style={{ textAlign: 'center', padding: '28px 0 8px', borderTop: '1px solid rgba(30,41,59,0.6)' }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🌦️</div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#94a3b8', marginBottom: 6 }}>Ready to forecast rain</div>
          <div style={{ fontSize: 12, color: '#475569', maxWidth: 340, margin: '0 auto' }}>
            Choose <strong>Latest Firestore Data</strong> for a live prediction, <strong>Pick a Date</strong>
            to test historical data, or <strong>Manual Input</strong> to enter feature values directly.
          </div>
        </div>
      )}

      <style>{`
        @keyframes rain-spin { to { transform: rotate(360deg); } }
        @keyframes rain-pulse { 0%,100% { opacity:.3 } 50% { opacity:.7 } }
      `}</style>
    </div>
  )
}
