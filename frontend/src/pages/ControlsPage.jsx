/**
 * ControlsPage — Hardware control panel for the Smart Irrigation system.
 * 
 * This page provides manual control over irrigation hardware:
 *   - Pump Control: Toggle pump ON/OFF with safety validation
 *   - Valve Control: Open/close irrigation valves
 *   - Mode Control: Switch between Automatic and Manual modes
 *   - Manual Irrigation: Start timed irrigation sessions (1-120 minutes)
 * 
 * Communication flow:
 *   React Frontend → POST request → Flask API
 *   Flask → updates Firebase /controls/{deviceId}
 *   IoT device (ESP32) reads Firebase value → executes hardware action
 * 
 * Safety features:
 *   - Pump ON blocked if water level is low
 *   - Warnings for high soil moisture
 *   - Sensor offline alerts
 *   - Visual feedback for all actions
 */

import { useState, useCallback } from 'react'
import {
    Power, PowerOff, Droplets, GitBranch, Settings2,
    Timer, Play, AlertTriangle, CheckCircle2, Cpu,
    ToggleLeft, ToggleRight, Zap, RefreshCw, Shield
} from 'lucide-react'
import * as api from '../api'
import useRealtimeFieldData from '../hooks/useRealtimeFieldData'
import PumpStatusIndicator from '../components/PumpStatusIndicator'
import SensorDashboard from '../components/SensorDashboard'

// ── Feedback toast ────────────────────────────────────────────────────
function FeedbackBanner({ feedback, onDismiss }) {
    if (!feedback) return null

    const isError = feedback.type === 'error'

    return (
        <div
            className={`
                rounded-xl border px-4 py-3 text-sm animate-slide-up
                flex items-start gap-3
                ${isError
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }
            `}
        >
            {isError
                ? <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
                : <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />
            }
            <div className="flex-1">
                <p className="font-semibold">{feedback.message}</p>
                {feedback.warnings?.map((w, i) => (
                    <p key={i} className="mt-1 text-xs opacity-80">⚡ {w}</p>
                ))}
            </div>
            <button
                onClick={onDismiss}
                className="text-current opacity-50 hover:opacity-100 transition-opacity"
            >
                ✕
            </button>
        </div>
    )
}

// ── Control Card Wrapper ──────────────────────────────────────────────
function ControlCard({ icon: Icon, iconBg, iconColor, title, subtitle, children, highlight = false }) {
    return (
        <div className={`
            card space-y-4 transition-all duration-200
            ${highlight ? 'ring-2 ring-primary-200 ring-offset-2' : ''}
        `}>
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center`}>
                    <Icon size={20} className={iconColor} />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-surface-900">{title}</h3>
                    {subtitle && <p className="text-xs text-surface-400 mt-0.5">{subtitle}</p>}
                </div>
            </div>
            {children}
        </div>
    )
}

// ── Action Button ─────────────────────────────────────────────────────
function ActionButton({
    onClick, disabled, loading, children,
    variant = 'primary', fullWidth = false, id,
}) {
    const variants = {
        primary: 'btn-primary',
        danger: 'btn-danger',
        secondary: 'btn-secondary',
    }

    return (
        <button
            id={id}
            onClick={onClick}
            disabled={disabled || loading}
            className={`${variants[variant]} ${fullWidth ? 'w-full justify-center' : ''} py-2.5 relative`}
        >
            {loading ? (
                <div className="spinner w-4 h-4 border-current/30 border-t-current" />
            ) : children}
        </button>
    )
}

// ── Main Component ────────────────────────────────────────────────────
export default function ControlsPage({ deviceId = 'field-001' }) {
    const { data, warnings } = useRealtimeFieldData(deviceId)
    const [minutes, setMinutes] = useState(10)
    const [busyKey, setBusyKey] = useState('')
    const [feedback, setFeedback] = useState(null)

    // Generic action handler with loading state and feedback
    const runAction = useCallback(async (key, action, successMessage) => {
        setBusyKey(key)
        setFeedback(null)
        try {
            const response = await action()
            setFeedback({
                type: 'success',
                message: successMessage,
                warnings: response?.warnings || [],
            })
            // Auto-dismiss success after 5s
            setTimeout(() => setFeedback(prev =>
                prev?.type === 'success' ? null : prev
            ), 5000)
        } catch (error) {
            setFeedback({
                type: 'error',
                message: error.message || 'Action failed — check connection',
                warnings: [],
            })
        } finally {
            setBusyKey('')
        }
    }, [])

    // Safety checks
    const isWaterLow = data.waterLevel === 'low'
    const isMoistureHigh = typeof data.soilMoisture === 'number' && data.soilMoisture >= 75
    const isPumpOn = data.pumpStatus === 'ON'
    const isAutoMode = data.irrigationMode === 'AUTOMATIC'
    const isValveOpen = data.valve === 'OPEN'

    return (
        <div className="space-y-6">
            {/* ── Sensor Dashboard Section ────────────────────────── */}
            <SensorDashboard deviceId={deviceId} />

            {/* ── Controls Header ─────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
                        <Settings2 size={18} className="text-violet-600" />
                    </div>
                    <div>
                        <h2 className="section-title">Controls Panel</h2>
                        <p className="text-xs text-surface-400 mt-0.5">
                            Hardware control • Commands sent via Flask API → Firebase → IoT device
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <PumpStatusIndicator status={data.pumpStatus} size="md" />
                    <span className={`badge ${isAutoMode ? 'badge-purple' : 'badge-yellow'}`}>
                        {isAutoMode ? '🤖 Auto' : '🔧 Manual'}
                    </span>
                </div>
            </div>

            {/* ── Safety Warnings ─────────────────────────────────── */}
            {warnings.length > 0 && (
                <div className="space-y-2">
                    {warnings.map((warning) => (
                        <div
                            key={warning.id}
                            className={`
                                flex items-start gap-3 rounded-xl border px-4 py-3 text-sm
                                ${warning.severity === 'critical'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }
                            `}
                        >
                            <Shield size={16} className="mt-0.5 flex-shrink-0" />
                            <span>{warning.message}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Feedback Banner ─────────────────────────────────── */}
            <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

            {/* ── Control Cards Grid ──────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* ── Pump Control ─────────────────────────────── */}
                <ControlCard
                    icon={Cpu}
                    iconBg={isPumpOn ? 'bg-emerald-50' : 'bg-surface-100'}
                    iconColor={isPumpOn ? 'text-emerald-600' : 'text-surface-500'}
                    title="Pump Control"
                    subtitle="Toggle the irrigation pump on or off"
                    highlight={isPumpOn}
                >
                    {/* Pump visual indicator */}
                    <div className={`
                        rounded-xl p-4 flex items-center justify-between
                        transition-all duration-300
                        ${isPumpOn
                            ? 'bg-emerald-50 border-2 border-emerald-200'
                            : 'bg-surface-50 border-2 border-surface-200'
                        }
                    `}>
                        <div className="flex items-center gap-3">
                            <div className={`
                                w-14 h-14 rounded-full flex items-center justify-center
                                transition-all duration-300
                                ${isPumpOn ? 'bg-emerald-500 pump-on' : 'bg-surface-300'}
                            `}>
                                <Droplets size={28} className="text-white" />
                            </div>
                            <div>
                                <p className={`font-bold ${isPumpOn ? 'text-emerald-700' : 'text-surface-500'}`}>
                                    {isPumpOn ? 'Pump Running' : 'Pump Idle'}
                                </p>
                                <p className="text-xs text-surface-400">Device: {deviceId}</p>
                            </div>
                        </div>
                    </div>

                    {/* Pump buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <ActionButton
                            id="btn-pump-on"
                            variant="primary"
                            loading={busyKey === 'pump-on'}
                            disabled={busyKey !== '' || isWaterLow || isPumpOn}
                            onClick={() => runAction(
                                'pump-on',
                                () => api.pumpOn(deviceId, 'Manual ON from Controls tab'),
                                '✅ Pump turned ON successfully'
                            )}
                        >
                            <Power size={16} />
                            Turn ON
                        </ActionButton>
                        <ActionButton
                            id="btn-pump-off"
                            variant="danger"
                            loading={busyKey === 'pump-off'}
                            disabled={busyKey !== '' || !isPumpOn}
                            onClick={() => runAction(
                                'pump-off',
                                () => api.pumpOff(deviceId, 'Manual OFF from Controls tab'),
                                '🛑 Pump turned OFF'
                            )}
                        >
                            <PowerOff size={16} />
                            Turn OFF
                        </ActionButton>
                    </div>

                    {/* Safety note */}
                    {isWaterLow && (
                        <p className="text-xs text-red-600 font-medium flex items-center gap-1.5">
                            <AlertTriangle size={12} />
                            Pump ON disabled — water level is critically low
                        </p>
                    )}
                    {isMoistureHigh && !isWaterLow && (
                        <p className="text-xs text-amber-600 font-medium flex items-center gap-1.5">
                            <AlertTriangle size={12} />
                            Caution: soil moisture is already high
                        </p>
                    )}
                </ControlCard>

                {/* ── Valve Control ────────────────────────────── */}
                <ControlCard
                    icon={GitBranch}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    title="Valve Control"
                    subtitle="Open or close the irrigation valve"
                >
                    {/* Valve status */}
                    <div className={`
                        rounded-xl p-4 flex items-center justify-between
                        ${isValveOpen
                            ? 'bg-blue-50 border-2 border-blue-200'
                            : 'bg-surface-50 border-2 border-surface-200'
                        }
                    `}>
                        <div className="flex items-center gap-3">
                            <div className={`
                                w-14 h-14 rounded-full flex items-center justify-center
                                ${isValveOpen ? 'bg-blue-500' : 'bg-surface-300'}
                            `}>
                                <GitBranch size={28} className="text-white" />
                            </div>
                            <div>
                                <p className={`font-bold ${isValveOpen ? 'text-blue-700' : 'text-surface-500'}`}>
                                    {isValveOpen ? 'Valve Open' : 'Valve Closed'}
                                </p>
                                <p className="text-xs text-surface-400">
                                    {isValveOpen ? 'Water flowing through' : 'Water flow blocked'}
                                </p>
                            </div>
                        </div>
                        <span className={isValveOpen ? 'badge-green' : 'badge-gray'}>
                            {isValveOpen ? 'OPEN' : 'CLOSED'}
                        </span>
                    </div>

                    {/* Valve buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <ActionButton
                            id="btn-valve-open"
                            variant="primary"
                            loading={busyKey === 'valve-open'}
                            disabled={busyKey !== '' || isValveOpen}
                            onClick={() => runAction(
                                'valve-open',
                                () => api.valveOpen(deviceId),
                                '🚰 Valve opened — water flowing'
                            )}
                        >
                            <Play size={16} />
                            Open Valve
                        </ActionButton>
                        <ActionButton
                            id="btn-valve-close"
                            variant="secondary"
                            loading={busyKey === 'valve-close'}
                            disabled={busyKey !== '' || !isValveOpen}
                            onClick={() => runAction(
                                'valve-close',
                                () => api.valveClose(deviceId),
                                '🚰 Valve closed'
                            )}
                        >
                            <PowerOff size={16} />
                            Close Valve
                        </ActionButton>
                    </div>
                </ControlCard>

                {/* ── Mode Control ─────────────────────────────── */}
                <ControlCard
                    icon={Zap}
                    iconBg={isAutoMode ? 'bg-violet-50' : 'bg-amber-50'}
                    iconColor={isAutoMode ? 'text-violet-600' : 'text-amber-600'}
                    title="Mode Control"
                    subtitle="Switch between automatic and manual irrigation mode"
                >
                    {/* Mode indicator */}
                    <div className={`
                        rounded-xl p-4 flex items-center justify-between
                        ${isAutoMode
                            ? 'bg-violet-50 border-2 border-violet-200'
                            : 'bg-amber-50 border-2 border-amber-200'
                        }
                    `}>
                        <div className="flex items-center gap-3">
                            {isAutoMode
                                ? <ToggleRight size={40} className="text-violet-600" />
                                : <ToggleLeft size={40} className="text-amber-600" />
                            }
                            <div>
                                <p className={`font-bold ${isAutoMode ? 'text-violet-700' : 'text-amber-700'}`}>
                                    {isAutoMode ? 'Automatic Mode' : 'Manual Mode'}
                                </p>
                                <p className="text-xs text-surface-500">
                                    {isAutoMode
                                        ? 'AI decision engine controls the pump'
                                        : 'Pump and valve are manually controlled'
                                    }
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Mode buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <ActionButton
                            id="btn-mode-auto"
                            variant="primary"
                            loading={busyKey === 'mode-auto'}
                            disabled={busyKey !== '' || isAutoMode}
                            onClick={() => runAction(
                                'mode-auto',
                                () => api.modeAutomatic(deviceId),
                                '🤖 Automatic mode enabled'
                            )}
                        >
                            <Zap size={16} />
                            Automatic
                        </ActionButton>
                        <ActionButton
                            id="btn-mode-manual"
                            variant="secondary"
                            loading={busyKey === 'mode-manual'}
                            disabled={busyKey !== '' || !isAutoMode}
                            onClick={() => runAction(
                                'mode-manual',
                                () => api.modeManual(deviceId),
                                '🔧 Manual mode enabled'
                            )}
                        >
                            <Settings2 size={16} />
                            Manual
                        </ActionButton>
                    </div>
                </ControlCard>

                {/* ── Manual Irrigation ────────────────────────── */}
                <ControlCard
                    icon={Timer}
                    iconBg="bg-cyan-50"
                    iconColor="text-cyan-600"
                    title="Manual Irrigation"
                    subtitle="Start a timed irrigation session"
                >
                    {/* Duration selector */}
                    <div className="space-y-3">
                        <label className="label mb-0" htmlFor="irrigation-minutes">
                            Duration
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                id="irrigation-minutes"
                                type="range"
                                min={1}
                                max={120}
                                value={minutes}
                                onChange={(e) => setMinutes(Number(e.target.value))}
                                className="flex-1"
                                style={{
                                    background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${((minutes - 1) / 119) * 100}%, #e2e8f0 ${((minutes - 1) / 119) * 100}%, #e2e8f0 100%)`
                                }}
                            />
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="number"
                                    min={1}
                                    max={120}
                                    value={minutes}
                                    onChange={(e) => setMinutes(Math.max(1, Math.min(120, Number(e.target.value) || 1)))}
                                    className="input-field w-20 text-center py-1.5"
                                />
                                <span className="text-sm text-surface-500 font-medium">min</span>
                            </div>
                        </div>
                        <div className="flex justify-between text-xs text-surface-400">
                            <span>1 min</span>
                            <span>120 min</span>
                        </div>
                    </div>

                    {/* Quick duration presets */}
                    <div className="flex flex-wrap gap-2">
                        {[5, 10, 15, 30, 60].map((m) => (
                            <button
                                key={m}
                                onClick={() => setMinutes(m)}
                                className={`
                                    px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                                    ${minutes === m
                                        ? 'bg-cyan-100 text-cyan-700 border border-cyan-300'
                                        : 'bg-surface-50 text-surface-500 border border-surface-200 hover:bg-surface-100'
                                    }
                                `}
                            >
                                {m} min
                            </button>
                        ))}
                    </div>

                    {/* Start button */}
                    <ActionButton
                        id="btn-start-irrigation"
                        variant="primary"
                        fullWidth
                        loading={busyKey === 'manual-irrigation'}
                        disabled={busyKey !== '' || isWaterLow}
                        onClick={() => runAction(
                            'manual-irrigation',
                            () => api.startManualIrrigation(
                                deviceId,
                                Math.max(1, Math.min(120, Number(minutes) || 1))
                            ),
                            `🕒 Irrigation started for ${Math.max(1, Math.min(120, Number(minutes) || 1))} minute(s)`
                        )}
                    >
                        <Play size={16} />
                        Start Irrigation ({minutes} min)
                    </ActionButton>

                    {isWaterLow && (
                        <p className="text-xs text-red-600 font-medium flex items-center gap-1.5">
                            <AlertTriangle size={12} />
                            Manual irrigation disabled — water level is critically low
                        </p>
                    )}
                </ControlCard>
            </div>

            {/* ── Communication flow info ─────────────────────────── */}
            <div className="card bg-surface-50 border-surface-200">
                <div className="flex items-center gap-2 mb-3">
                    <RefreshCw size={16} className="text-surface-500" />
                    <h3 className="text-sm font-bold text-surface-700">Communication Flow</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-surface-500">
                    <span className="bg-white px-2.5 py-1 rounded-lg border border-surface-200 font-medium">
                        React Frontend
                    </span>
                    <span>→</span>
                    <span className="bg-white px-2.5 py-1 rounded-lg border border-surface-200 font-medium">
                        Flask API
                    </span>
                    <span>→</span>
                    <span className="bg-white px-2.5 py-1 rounded-lg border border-surface-200 font-medium">
                        Firebase Update
                    </span>
                    <span>→</span>
                    <span className="bg-white px-2.5 py-1 rounded-lg border border-surface-200 font-medium">
                        IoT Device (ESP32)
                    </span>
                    <span>→</span>
                    <span className="bg-white px-2.5 py-1 rounded-lg border border-surface-200 font-medium">
                        Hardware Action
                    </span>
                </div>
            </div>
        </div>
    )
}
