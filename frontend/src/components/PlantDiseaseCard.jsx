import { useState, useRef, useCallback } from 'react'
import * as api from '../api'

// ── Utility ──────────────────────────────────────────────────────────────────
function formatLabel(raw) {
  if (!raw) return ''
  const parts = raw.split('___')
  const crop = parts[0]?.replace(/_/g, ' ') ?? ''
  const cond = parts[1]?.replace(/_/g, ' ') ?? 'Unknown'
  return { crop, condition: cond }
}

function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: '#94a3b8' }}>Confidence</span>
        <span style={{ color, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ background: '#1e293b', borderRadius: 99, height: 6, overflow: 'hidden' }}>
        <div
          style={{
            width: `${pct}%`, height: '100%', borderRadius: 99,
            background: `linear-gradient(90deg, ${color}aa, ${color})`,
            transition: 'width 0.8s cubic-bezier(.4,0,.2,1)',
          }}
        />
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PlantDiseaseCard() {
  const [demoLoading, setDemoLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeDemo, setActiveDemo] = useState(null)   // 'healthy' | 'diseased'
  const [result, setResult] = useState(null)           // prediction result
  const [originalB64, setOriginalB64] = useState(null)
  const [heatmapB64, setHeatmapB64] = useState(null)
  const [geminiInsight, setGeminiInsight] = useState(null)
  const [geminiLoading, setGeminiLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const fileRef = useRef()

  // ── Ask Gemini for insight ────────────────────────────────────────────────
  const fetchGeminiInsight = useCallback(async (predResult) => {
    setGeminiLoading(true)
    setGeminiInsight(null)
    try {
      const { crop, condition } = formatLabel(predResult.label)
      const isHealthy = predResult.is_healthy
      const query = isHealthy
        ? `My ${crop} plant leaf was classified as HEALTHY with ${Math.round(predResult.confidence * 100)}% confidence. What are the best practices to keep it healthy and prevent common diseases?`
        : `My ${crop} plant was diagnosed with "${condition}" (confidence: ${Math.round(predResult.confidence * 100)}%). 
           Please explain:
           1. What causes this disease?
           2. What are the immediate treatment steps I should take?
           3. How can I prevent it from spreading to other plants?
           4. What organic/chemical treatments are recommended in Indian farming?`
      const res = await api.askGemini(query, { cropType: crop })
      setGeminiInsight(res.answer)
    } catch (e) {
      setGeminiInsight('Could not fetch AI insights — check your Gemini API key in the backend .env file.')
    } finally {
      setGeminiLoading(false)
    }
  }, [])

  // ── Run prediction on a base64 image ─────────────────────────────────────
  const runPrediction = useCallback(async (b64, isDemoType = null) => {
    setError(null)
    setResult(null)
    setHeatmapB64(null)
    setGeminiInsight(null)
    try {
      const res = await api.predictPlantDisease(b64, isDemoType)
      setResult(res)
      setOriginalB64(res.original_base64 || b64)
      setHeatmapB64(res.heatmap_base64 || null)
      fetchGeminiInsight(res)
    } catch (e) {
      setError(e.message || 'Prediction failed')
    }
  }, [fetchGeminiInsight])

  // ── Demo button handler ───────────────────────────────────────────────────
  const runDemo = useCallback(async (type) => {
    setDemoLoading(true)
    setActiveDemo(type)
    setResult(null)
    setHeatmapB64(null)
    setGeminiInsight(null)
    setError(null)
    try {
      const demos = await api.getDemoImages()
      const img = demos[type]
      if (!img) throw new Error('Demo image not found on server')
      await runPrediction(img.base64, type)
    } catch (e) {
      setError(e.message || 'Demo failed')
    } finally {
      setDemoLoading(false)
    }
  }, [runPrediction])

  // ── File upload handler ───────────────────────────────────────────────────
  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setActiveDemo(null)
    setResult(null)
    setHeatmapB64(null)
    setGeminiInsight(null)
    setError(null)
    try {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const b64 = ev.target.result.split(',')[1]
        await runPrediction(b64)
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (e) {
      setError(e.message)
      setUploading(false)
    }
  }, [runPrediction])

  const isLoading = demoLoading || uploading
  const { crop, condition } = result ? formatLabel(result.label) : {}

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      border: '1px solid rgba(99,102,241,0.25)',
      borderRadius: 20,
      padding: '28px 28px 24px',
      color: '#f1f5f9',
      fontFamily: "'Inter', system-ui, sans-serif",
      boxShadow: '0 25px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle bg glow */}
      <div style={{
        position: 'absolute', top: -80, right: -80, width: 240, height: 240,
        background: 'radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 14,
          background: 'linear-gradient(135deg, #16a34a, #22c55e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, boxShadow: '0 4px 12px rgba(34,197,94,0.35)',
        }}>🌿</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>
            Plant Disease Detection
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            AI-powered • MobileNet V2 • PlantVillage dataset • GradCAM heatmap
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span style={{
            background: 'rgba(34,197,94,0.15)', color: '#4ade80',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 600,
          }}>38 crop classes</span>
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        {/* Upload */}
        <button
          id="plant-disease-upload-btn"
          onClick={() => fileRef.current?.click()}
          disabled={isLoading}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 12, fontWeight: 600,
            fontSize: 13, cursor: isLoading ? 'not-allowed' : 'pointer',
            background: 'rgba(99,102,241,0.15)', color: '#a5b4fc',
            border: '1px solid rgba(99,102,241,0.35)',
            opacity: isLoading ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
        >
          <span>📤</span> Upload Leaf Image
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

        {/* Demo — Healthy */}
        <button
          id="plant-disease-demo-healthy-btn"
          onClick={() => runDemo('healthy')}
          disabled={isLoading}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 12, fontWeight: 600,
            fontSize: 13, cursor: isLoading ? 'not-allowed' : 'pointer',
            background: activeDemo === 'healthy' && result
              ? 'rgba(34,197,94,0.25)' : 'rgba(34,197,94,0.12)',
            color: '#4ade80',
            border: `1px solid ${activeDemo === 'healthy' && result ? 'rgba(34,197,94,0.6)' : 'rgba(34,197,94,0.3)'}`,
            opacity: isLoading ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
        >
          {demoLoading && activeDemo === 'healthy' ? '⏳' : '▶ Demo: Healthy Leaf'}
        </button>

        {/* Demo — Diseased */}
        <button
          id="plant-disease-demo-diseased-btn"
          onClick={() => runDemo('diseased')}
          disabled={isLoading}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 12, fontWeight: 600,
            fontSize: 13, cursor: isLoading ? 'not-allowed' : 'pointer',
            background: activeDemo === 'diseased' && result
              ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.1)',
            color: '#f87171',
            border: `1px solid ${activeDemo === 'diseased' && result ? 'rgba(239,68,68,0.6)' : 'rgba(239,68,68,0.3)'}`,
            opacity: isLoading ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
        >
          {demoLoading && activeDemo === 'diseased' ? '⏳' : '▶ Demo: Diseased Leaf'}
        </button>
      </div>

      {/* ── Loading State ── */}
      {isLoading && (
        <div style={{
          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 14, padding: '20px 24px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 32, height: 32, border: '3px solid rgba(99,102,241,0.3)',
            borderTop: '3px solid #818cf8', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div>
            <div style={{ fontWeight: 600, color: '#a5b4fc' }}>Running inference…</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              MobileNet V2 is classifying the leaf image
            </div>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 20,
          color: '#fca5a5', fontSize: 13,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Result Section ── */}
      {result && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* ── Prediction Label Card ── */}
          <div style={{
            background: result.is_healthy
              ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(21,128,61,0.1))'
              : 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(153,27,27,0.1))',
            border: `1px solid ${result.is_healthy ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
            borderRadius: 16, padding: '18px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{
                fontSize: 32, width: 52, height: 52, borderRadius: 14,
                background: result.is_healthy ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {result.is_healthy ? '✅' : '⚠️'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
                  Crop
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{crop}</div>
                <div style={{
                  fontSize: 14, fontWeight: 600,
                  color: result.is_healthy ? '#86efac' : '#fca5a5',
                  marginBottom: 12,
                }}>
                  {condition}
                </div>
                <ConfidenceBar value={result.confidence} />
              </div>
            </div>
            {result.model_status === 'demo_fallback' && (
              <div style={{
                marginTop: 12, padding: '8px 12px', borderRadius: 8,
                background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)',
                fontSize: 11, color: '#fde047',
              }}>
                ⚠️ Model file not found — copy <code>best_mobilenet(1).pth</code> to <code>backend/models/</code> for live inference
              </div>
            )}
          </div>

          {/* ── Image Comparison ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>
                📸 Visual Analysis
              </div>
              {heatmapB64 && (
                <div style={{ display: 'flex', background: 'rgba(30,41,59,0.8)', borderRadius: 8, padding: 3, gap: 3 }}>
                  {['Original', 'GradCAM'].map((label, i) => (
                    <button
                      key={label}
                      onClick={() => setShowHeatmap(i === 1)}
                      style={{
                        padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', border: 'none',
                        background: showHeatmap === (i === 1)
                          ? (i === 1 ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)')
                          : 'transparent',
                        color: showHeatmap === (i === 1) ? '#f1f5f9' : '#64748b',
                        transition: 'all 0.2s',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: heatmapB64 ? '1fr 1fr' : '1fr', gap: 12 }}>
              {/* Original */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', top: 8, left: 8, zIndex: 2,
                  background: 'rgba(15,23,42,0.85)', borderRadius: 6,
                  padding: '3px 8px', fontSize: 10, fontWeight: 700, color: '#94a3b8',
                  backdropFilter: 'blur(4px)',
                }}>ORIGINAL</div>
                <img
                  src={`data:image/jpeg;base64,${originalB64}`}
                  alt="Original leaf"
                  style={{
                    width: '100%', aspectRatio: '1', objectFit: 'cover',
                    borderRadius: 12, border: '1px solid rgba(99,102,241,0.2)',
                    display: 'block',
                  }}
                />
              </div>
              {/* GradCAM */}
              {heatmapB64 && (
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute', top: 8, left: 8, zIndex: 2,
                    background: 'rgba(15,23,42,0.85)', borderRadius: 6,
                    padding: '3px 8px', fontSize: 10, fontWeight: 700, color: '#f87171',
                    backdropFilter: 'blur(4px)',
                  }}>GradCAM HEATMAP</div>
                  <img
                    src={`data:image/png;base64,${heatmapB64}`}
                    alt="GradCAM heatmap"
                    style={{
                      width: '100%', aspectRatio: '1', objectFit: 'cover',
                      borderRadius: 12,
                      border: '1px solid rgba(239,68,68,0.3)',
                      display: 'block',
                    }}
                  />
                  <div style={{
                    position: 'absolute', bottom: 8, left: 8, right: 8,
                    background: 'rgba(15,23,42,0.85)', borderRadius: 8,
                    padding: '6px 10px', fontSize: 10, color: '#94a3b8',
                    backdropFilter: 'blur(4px)',
                  }}>
                    🔴 Red = high activation area the model focused on
                  </div>
                </div>
              )}
              {!heatmapB64 && (
                <div style={{
                  border: '1px dashed rgba(99,102,241,0.2)', borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  aspectRatio: '1', color: '#475569', fontSize: 12, textAlign: 'center', padding: 16,
                }}>
                  GradCAM unavailable<br />(model file needed)
                </div>
              )}
            </div>
          </div>

          {/* ── Gemini AI Insights ── */}
          <div style={{
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: 16, padding: '18px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
              }}>✨</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Gemini AI Farmwise Insights</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Powered by Google Gemini 2.0</div>
              </div>
              {geminiLoading && (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 14, height: 14, border: '2px solid rgba(99,102,241,0.3)',
                    borderTop: '2px solid #818cf8', borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  <span style={{ fontSize: 11, color: '#64748b' }}>Analyzing…</span>
                </div>
              )}
            </div>
            {geminiInsight ? (
              <div style={{
                fontSize: 13, lineHeight: 1.7, color: '#cbd5e1',
                whiteSpace: 'pre-wrap',
              }}>
                {geminiInsight
                  .replace(/\*\*(.*?)\*\*/g, '$1')   // render bold as plain (simple version)
                }
              </div>
            ) : geminiLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[80, 60, 90, 70].map((w, i) => (
                  <div key={i} style={{
                    height: 12, borderRadius: 6, background: 'rgba(99,102,241,0.15)',
                    width: `${w}%`, animation: 'pulse 1.5s ease-in-out infinite',
                    animationDelay: `${i * 0.15}s`,
                  }} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {!result && !isLoading && !error && (
        <div style={{
          textAlign: 'center', padding: '32px 0 8px',
          borderTop: '1px solid rgba(30,41,59,0.6)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🍃</div>
          <div style={{ fontWeight: 600, fontSize: 15, color: '#94a3b8', marginBottom: 6 }}>
            Ready to detect plant diseases
          </div>
          <div style={{ fontSize: 12, color: '#475569', maxWidth: 320, margin: '0 auto' }}>
            Click <strong>▶ Demo: Healthy Leaf</strong> or <strong>▶ Demo: Diseased Leaf</strong> above
            to see the AI in action instantly — or upload your own leaf photo.
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:.4 } 50% { opacity:.8 } }
      `}</style>
    </div>
  )
}
