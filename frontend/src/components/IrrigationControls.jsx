import { useState } from 'react'
import {
    Play, Square, Zap, Settings2, CheckCircle2,
    AlertTriangle, Cpu, ToggleLeft, ToggleRight, Droplets
} from 'lucide-react'

export default function IrrigationControls({
    data, settings, onPumpOn, onPumpOff, onDecision, onSettingsChange
}) {
    const [pumpLoading, setPumpLoading] = useState(false)
    const [decisionLoading, setDecisionLoading] = useState(false)
    const [decisionResult, setDecisionResult] = useState(null)
    const [threshold, setThreshold] = useState(settings?.moistureThreshold ?? 40)
    const [autoMode, setAutoMode] = useState(settings?.autoMode ?? true)
    const [settingsSaved, setSettingsSaved] = useState(false)

    const pumpStatus = data?.pumpStatus || 'OFF'
    const isPumpOn = pumpStatus === 'ON'

    const handlePumpOn = async () => {
        setPumpLoading(true)
        try { await onPumpOn() } finally { setPumpLoading(false) }
    }

    const handlePumpOff = async () => {
        setPumpLoading(true)
        try { await onPumpOff() } finally { setPumpLoading(false) }
    }

    const handleDecision = async () => {
        setDecisionLoading(true)
        setDecisionResult(null)
        try {
            const res = await onDecision()
            setDecisionResult(res)
        } catch (e) {
            setDecisionResult({ error: e.message })
        } finally {
            setDecisionLoading(false)
        }
    }

    const handleSaveSettings = async () => {
        await onSettingsChange({ moistureThreshold: threshold, autoMode })
        setSettingsSaved(true)
        setTimeout(() => setSettingsSaved(false), 2500)
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Manual Pump Control ─────────────────────────────── */}
            <div className="card">
                <div className="flex items-center gap-2 mb-6">
                    <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center">
                        <Cpu size={18} className="text-primary-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-surface-900">Pump Control</h3>
                        <p className="text-xs text-surface-400">Manual override</p>
                    </div>
                    <div className="ml-auto">
                        <span className={isPumpOn ? 'badge-green' : 'badge-gray'}>
                            <span className={`status-dot ${isPumpOn ? 'online' : ''}`}
                                style={!isPumpOn ? { background: '#cbd5e1' } : {}} />
                            {pumpStatus}
                        </span>
                    </div>
                </div>

                {/* Pump visual */}
                <div className={`rounded-2xl p-6 flex flex-col items-center mb-6
          ${isPumpOn ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-surface-50 border-2 border-surface-200'}`}>
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-3
            ${isPumpOn ? 'bg-emerald-500 pump-on' : 'bg-surface-300'}`}>
                        <Droplets size={36} className="text-white" />
                    </div>
                    <p className={`text-lg font-bold ${isPumpOn ? 'text-emerald-700' : 'text-surface-500'}`}>
                        {isPumpOn ? 'Pump Running' : 'Pump Idle'}
                    </p>
                    <p className="text-sm text-surface-400">Device: field-001</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button
                        id="btn-pump-on"
                        onClick={handlePumpOn}
                        disabled={pumpLoading || isPumpOn}
                        className="btn-primary justify-center py-3"
                    >
                        {pumpLoading && !isPumpOn ? (
                            <div className="spinner w-4 h-4 border-white/30 border-t-white" />
                        ) : <Play size={16} />}
                        Start Pump
                    </button>
                    <button
                        id="btn-pump-off"
                        onClick={handlePumpOff}
                        disabled={pumpLoading || !isPumpOn}
                        className="btn-danger justify-center py-3"
                    >
                        {pumpLoading && isPumpOn ? (
                            <div className="spinner w-4 h-4 border-white/30 border-t-white" />
                        ) : <Square size={16} />}
                        Stop Pump
                    </button>
                </div>

                <p className="text-xs text-surface-400 text-center mt-3">
                    Manual override bypasses auto-scheduling and writes directly to device
                </p>
            </div>

            {/* ── Auto Mode + Threshold ──────────────────────────── */}
            <div className="card">
                <div className="flex items-center gap-2 mb-6">
                    <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
                        <Settings2 size={18} className="text-violet-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-surface-900">Automation Settings</h3>
                        <p className="text-xs text-surface-400">Configure decision engine</p>
                    </div>
                </div>

                {/* Auto mode toggle */}
                <div className="flex items-center justify-between p-4 bg-surface-50 rounded-xl mb-4">
                    <div>
                        <p className="font-semibold text-surface-800 text-sm">Auto Irrigation Mode</p>
                        <p className="text-xs text-surface-400 mt-0.5">
                            When ON, decision engine controls the pump automatically
                        </p>
                    </div>
                    <button
                        id="btn-auto-toggle"
                        onClick={() => setAutoMode(!autoMode)}
                        className={`flex-shrink-0 transition-colors duration-200
              ${autoMode ? 'text-primary-600' : 'text-surface-300'}`}
                    >
                        {autoMode
                            ? <ToggleRight size={40} />
                            : <ToggleLeft size={40} />
                        }
                    </button>
                </div>

                {/* Moisture threshold slider */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <label htmlFor="slider-threshold" className="label mb-0">
                            Moisture Threshold
                        </label>
                        <span className="text-primary-600 font-bold text-lg">{threshold}%</span>
                    </div>
                    <input
                        id="slider-threshold"
                        type="range"
                        min={10}
                        max={80}
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value))}
                        className="w-full"
                        style={{
                            background: `linear-gradient(to right, #0d9257 0%, #0d9257 ${((threshold - 10) / 70) * 100}%, #e2e8f0 ${((threshold - 10) / 70) * 100}%, #e2e8f0 100%)`
                        }}
                    />
                    <div className="flex justify-between text-xs text-surface-400 mt-1">
                        <span>10% (Very dry)</span>
                        <span>80% (Saturated)</span>
                    </div>
                    <p className="text-xs text-surface-400 mt-2">
                        Pump triggers when soil moisture falls below this value
                    </p>
                </div>

                <button
                    id="btn-save-settings"
                    onClick={handleSaveSettings}
                    className={settingsSaved ? 'btn-secondary w-full justify-center py-2.5' : 'btn-primary w-full justify-center py-2.5'}
                >
                    {settingsSaved ? <><CheckCircle2 size={16} className="text-emerald-500" /> Saved!</> : 'Save Settings'}
                </button>
            </div>

            {/* ── Run Decision Engine ────────────────────────────── */}
            <div className="card lg:col-span-2">
                <div className="flex items-center gap-2 mb-6">
                    <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
                        <Zap size={18} className="text-amber-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-surface-900">AI Decision Engine</h3>
                        <p className="text-xs text-surface-400">
                            Fetch current sensor data + weather forecast → apply logic → decide
                        </p>
                    </div>
                    <button
                        id="btn-run-decision"
                        onClick={handleDecision}
                        disabled={decisionLoading}
                        className="btn-primary ml-auto"
                    >
                        {decisionLoading ? (
                            <><div className="spinner w-4 h-4 border-white/30 border-t-white" />Running…</>
                        ) : (
                            <><Zap size={16} />Run Decision</>
                        )}
                    </button>
                </div>

                {/* Logic explanation */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                    {[
                        {
                            condition: 'moisture < threshold',
                            AND: 'rainProbability < 50%',
                            result: '→ Pump ON',
                            color: 'border-emerald-200 bg-emerald-50',
                            textColor: 'text-emerald-700',
                        },
                        {
                            condition: 'rainProbability ≥ 50%',
                            AND: null,
                            result: '→ Skip irrigation',
                            color: 'border-blue-200 bg-blue-50',
                            textColor: 'text-blue-700',
                        },
                        {
                            condition: 'moisture ≥ threshold',
                            AND: null,
                            result: '→ No action',
                            color: 'border-surface-200 bg-surface-50',
                            textColor: 'text-surface-700',
                        },
                    ].map((rule, i) => (
                        <div key={i} className={`rounded-xl border p-4 ${rule.color}`}>
                            <p className="text-xs font-mono text-surface-600">{rule.condition}</p>
                            {rule.AND && <p className="text-xs font-mono text-surface-600">AND {rule.AND}</p>}
                            <p className={`text-sm font-bold mt-2 ${rule.textColor}`}>{rule.result}</p>
                        </div>
                    ))}
                </div>

                {/* Decision result */}
                {decisionResult && (
                    <div className={`rounded-xl border p-4 animate-slide-up
            ${decisionResult.error
                            ? 'bg-red-50 border-red-200'
                            : decisionResult.decision === 'ON'
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-blue-50 border-blue-200'}`}
                    >
                        {decisionResult.error ? (
                            <div className="flex items-start gap-2 text-red-700">
                                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-semibold text-sm">Decision failed</p>
                                    <p className="text-xs mt-0.5">{decisionResult.error}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start gap-2">
                                <CheckCircle2 size={16} className={`mt-0.5 flex-shrink-0
                  ${decisionResult.decision === 'ON' ? 'text-emerald-600' : 'text-blue-600'}`} />
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-bold text-sm text-surface-900">
                                            Decision: Pump {decisionResult.decision}
                                        </p>
                                        {decisionResult.weather && (
                                            <span className="badge-gray text-xs">
                                                ☁ Rain: {(decisionResult.weather.rainProbability * 100).toFixed(0)}%
                                                ({decisionResult.weather.source})
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-surface-600 mt-1">{decisionResult.reason}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
