import { useState } from 'react'
import { Calendar, Clock, Brain, Zap, CloudRain, Cpu, RefreshCw } from 'lucide-react'
import { format, parseISO } from 'date-fns'

function InfoRow({ label, children }) {
    return (
        <div className="flex items-start justify-between py-3 border-b border-surface-100 last:border-0">
            <span className="text-sm text-surface-500 font-medium">{label}</span>
            <div className="text-right">{children}</div>
        </div>
    )
}

export default function SchedulePanel({ prediction, onRunDecision }) {
    const [running, setRunning] = useState(false)
    const [lastResult, setLastResult] = useState(null)

    const handleRunDecision = async () => {
        setRunning(true)
        try {
            const res = await onRunDecision()
            setLastResult(res)
        } catch (e) {
            setLastResult({ error: e.message })
        } finally {
            setRunning(false)
        }
    }

    const pred = prediction?.prediction

    let nextTime = '—'
    let nextTimeRelative = ''
    if (pred?.nextIrrigationTime) {
        try {
            const dt = parseISO(pred.nextIrrigationTime)
            nextTime = format(dt, 'dd MMM yyyy, HH:mm')
            const diffMs = dt - new Date()
            if (diffMs > 0) {
                const diffH = Math.floor(diffMs / 3_600_000)
                const diffM = Math.floor((diffMs % 3_600_000) / 60_000)
                nextTimeRelative = diffH > 0 ? `in ${diffH}h ${diffM}m` : `in ${diffM}m`
            } else {
                nextTimeRelative = 'scheduled time passed'
            }
        } catch { }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Smart Schedule ──────────────────────────────────── */}
            <div className="card">
                <div className="flex items-center gap-2 mb-6">
                    <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
                        <Calendar size={18} className="text-violet-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-surface-900">Smart Schedule</h3>
                        <p className="text-xs text-surface-400">AI-predicted next irrigation</p>
                    </div>
                </div>

                {pred ? (
                    <>
                        {/* Next irrigation highlight */}
                        <div className="bg-gradient-to-br from-primary-50 to-emerald-50
                            border border-primary-200 rounded-2xl p-5 mb-5 text-center">
                            <p className="text-xs text-primary-600 font-semibold uppercase tracking-wide mb-1">
                                Next Irrigation
                            </p>
                            <div className="flex items-center justify-center gap-2 my-2">
                                <Clock size={20} className="text-primary-600" />
                                <span className="text-2xl font-bold text-primary-800">{nextTime}</span>
                            </div>
                            {nextTimeRelative && (
                                <span className="badge-green text-xs">{nextTimeRelative}</span>
                            )}
                        </div>

                        <div>
                            <InfoRow label="Confidence">
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-surface-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary-500 rounded-full"
                                            style={{ width: `${(pred.confidence || 0) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-bold text-surface-900">
                                        {((pred.confidence || 0) * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </InfoRow>

                            <InfoRow label="Method">
                                <span className="badge-gray text-xs font-mono">{pred.method || '—'}</span>
                            </InfoRow>

                            <InfoRow label="Based on">
                                <span className="text-sm text-surface-700">
                                    {prediction?.inputReadingsUsed || 0} sensor readings
                                </span>
                            </InfoRow>

                            <InfoRow label="Threshold">
                                <span className="text-sm font-semibold text-surface-900">
                                    {prediction?.threshold}% moisture
                                </span>
                            </InfoRow>
                        </div>

                        {pred.reason && (
                            <div className="mt-4 bg-surface-50 rounded-xl p-4">
                                <p className="text-xs font-semibold text-surface-600 mb-1">Reasoning</p>
                                <p className="text-sm text-surface-600 leading-relaxed">{pred.reason}</p>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-10 text-surface-400">
                        <Brain size={32} className="mx-auto mb-3 opacity-40" />
                        <p className="font-medium">No prediction available</p>
                        <p className="text-sm mt-1">Run the decision engine to generate a schedule</p>
                    </div>
                )}
            </div>

            {/* ── ML Info ─────────────────────────────────────────── */}
            <div className="space-y-6">
                <div className="card">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
                            <Brain size={18} className="text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-surface-900">ML Engine</h3>
                            <p className="text-xs text-surface-400">LSTM predictor (hackathon mode)</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {[
                            {
                                icon: '🧠',
                                title: 'Current Mode',
                                desc: 'Heuristic trend analysis (LSTM placeholder)',
                            },
                            {
                                icon: '📊',
                                title: 'Input Shape',
                                desc: 'Last 24 readings × [moisture, temp, humidity, hour]',
                            },
                            {
                                icon: '🎯',
                                title: 'Output',
                                desc: 'Recommended next irrigation time + confidence score',
                            },
                            {
                                icon: '🔮',
                                title: 'Production Plan',
                                desc: 'LSTM(64) → LSTM(32) → Dense(1) on 30-day training window',
                            },
                        ].map((item) => (
                            <div key={item.title} className="flex gap-3 p-3 rounded-xl bg-surface-50">
                                <span className="text-lg flex-shrink-0">{item.icon}</span>
                                <div>
                                    <p className="text-sm font-semibold text-surface-800">{item.title}</p>
                                    <p className="text-xs text-surface-500 mt-0.5">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Run Decision + Quick actions */}
                <div className="card">
                    <h3 className="font-bold text-surface-900 mb-4">Quick Actions</h3>
                    <div className="space-y-3">
                        <button
                            id="schedule-run-decision"
                            onClick={handleRunDecision}
                            disabled={running}
                            className="btn-primary w-full justify-center py-3"
                        >
                            {running ? (
                                <><div className="spinner w-4 h-4 border-white/30 border-t-white" /> Running decision…</>
                            ) : (
                                <><Zap size={16} /> Run AI Decision Now</>
                            )}
                        </button>
                    </div>

                    {lastResult && !lastResult.error && (
                        <div className="mt-4 bg-surface-50 rounded-xl p-4 animate-slide-up">
                            <div className="flex items-center gap-2 mb-2">
                                <Cpu size={14} className="text-primary-600" />
                                <p className="text-sm font-bold text-surface-900">
                                    Decision: Pump {lastResult.decision}
                                </p>
                            </div>
                            <p className="text-xs text-surface-600">{lastResult.reason}</p>
                            {lastResult.weather && (
                                <div className="flex items-center gap-1.5 mt-2">
                                    <CloudRain size={12} className="text-blue-500" />
                                    <p className="text-xs text-surface-500">
                                        Rain probability: {(lastResult.weather.rainProbability * 100).toFixed(0)}%
                                        ({lastResult.weather.source})
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
