/**
 * SensorDashboard — Real-time sensor data visualization panel.
 * 
 * This component:
 *   - Uses Firebase real-time listeners (via useRealtimeFieldData hook)
 *   - Displays five core sensor metrics in styled cards
 *   - Shows color-coded severity (green/yellow/red)
 *   - Displays safety warnings (low water, high moisture, sensor offline)
 *   - Includes a mini sparkline chart for soil moisture trends
 *   - Auto-updates instantly when Firebase data changes
 */

import { Droplets, Thermometer, Wind, Gauge, Cpu, AlertTriangle, WifiOff, Activity } from 'lucide-react'
import SensorCard from './SensorCard'
import MoistureProgressBar from './MoistureProgressBar'
import PumpStatusIndicator from './PumpStatusIndicator'
import SensorGridLayout from './SensorGridLayout'
import useRealtimeFieldData from '../hooks/useRealtimeFieldData'

// ── Severity helpers ──────────────────────────────────────────────────
function getMoistureSeverity(value) {
    if (value == null) return { severity: 'neutral', label: 'No Data' }
    if (value < 30) return { severity: 'critical', label: 'Critical' }
    if (value < 60) return { severity: 'warning', label: 'Warning' }
    return { severity: 'optimal', label: 'Optimal' }
}

function getTemperatureSeverity(value) {
    if (value == null) return { severity: 'neutral', label: 'No Data' }
    if (value > 38) return { severity: 'critical', label: 'Extreme Heat' }
    if (value > 32) return { severity: 'warning', label: 'High' }
    if (value < 10) return { severity: 'critical', label: 'Too Cold' }
    if (value < 18) return { severity: 'warning', label: 'Cool' }
    return { severity: 'optimal', label: 'Normal' }
}

function getHumiditySeverity(value) {
    if (value == null) return { severity: 'neutral', label: 'No Data' }
    if (value > 85) return { severity: 'critical', label: 'Very High' }
    if (value > 70) return { severity: 'warning', label: 'High' }
    if (value < 30) return { severity: 'warning', label: 'Low' }
    return { severity: 'optimal', label: 'Optimal' }
}

function getWaterLevelSeverity(level) {
    if (level === 'low') return { severity: 'critical', label: 'Low' }
    if (level === 'high') return { severity: 'optimal', label: 'High' }
    if (level === 'medium') return { severity: 'optimal', label: 'Medium' }
    return { severity: 'neutral', label: 'Unknown' }
}

function toDisplayWaterLevel(level) {
    if (level === 'low') return 'Low'
    if (level === 'medium') return 'Medium'
    if (level === 'high') return 'High'
    return 'Unknown'
}

// ── Warning banner ────────────────────────────────────────────────────
function WarningBanner({ warnings }) {
    if (!warnings.length) return null

    return (
        <div className="space-y-2 animate-fade-in">
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
                    <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                    <div>
                        <span className="font-semibold">
                            {warning.severity === 'critical' ? '⚠️ Critical: ' : '⚡ Warning: '}
                        </span>
                        {warning.message}
                    </div>
                </div>
            ))}
        </div>
    )
}

// ── Water level visual ────────────────────────────────────────────────
function WaterLevelIndicator({ level }) {
    const levels = { low: 25, medium: 55, high: 85, unknown: 0 }
    const pct = levels[level] || 0
    const color = level === 'low' ? 'from-red-400 to-red-500'
        : level === 'medium' ? 'from-blue-400 to-blue-500'
        : level === 'high' ? 'from-emerald-400 to-emerald-500'
        : 'from-surface-300 to-surface-400'

    return (
        <div className="mt-3 flex items-end gap-1">
            {/* Mini water tank visual */}
            <div className="relative w-full h-6 bg-surface-100 rounded-lg overflow-hidden">
                <div
                    className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${color}
                        rounded-lg transition-all duration-700 ease-out`}
                    style={{ height: `${pct}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-surface-700 z-10">
                    {level?.toUpperCase() || '—'}
                </span>
            </div>
        </div>
    )
}

// ── Main Component ────────────────────────────────────────────────────
export default function SensorDashboard({ deviceId = 'field-001' }) {
    const { data, warnings, loading, error } = useRealtimeFieldData(deviceId)

    const moistureStatus = getMoistureSeverity(data.soilMoisture)
    const tempStatus = getTemperatureSeverity(data.temperature)
    const humidityStatus = getHumiditySeverity(data.humidity)
    const waterStatus = getWaterLevelSeverity(data.waterLevel)

    return (
        <section className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center">
                        <Activity size={18} className="text-primary-600" />
                    </div>
                    <div>
                        <h2 className="section-title">Sensor Dashboard</h2>
                        <p className="text-xs text-surface-400 mt-0.5">
                            Real-time via Firebase listeners • Auto-sync enabled
                        </p>
                    </div>
                </div>
                {/* Live indicator */}
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    <span className="text-xs font-medium text-emerald-600">LIVE</span>
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <WifiOff size={16} />
                    <span>Listener error: {error}</span>
                </div>
            )}

            {/* Safety warnings */}
            <WarningBanner warnings={warnings} />

            {/* Loading skeleton */}
            {loading && (
                <SensorGridLayout>
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="card animate-pulse">
                            <div className="flex items-start justify-between mb-3">
                                <div className="w-10 h-10 bg-surface-100 rounded-xl" />
                                <div className="w-16 h-5 bg-surface-100 rounded-full" />
                            </div>
                            <div className="h-4 w-24 bg-surface-100 rounded mb-2" />
                            <div className="h-8 w-20 bg-surface-100 rounded" />
                        </div>
                    ))}
                </SensorGridLayout>
            )}

            {/* Sensor cards grid */}
            {!loading && (
                <SensorGridLayout>
                    {/* Soil Moisture */}
                    <SensorCard
                        title="Soil Moisture"
                        value={data.soilMoisture?.toFixed(1) ?? '—'}
                        unit="%"
                        icon={Droplets}
                        iconColor="text-blue-500"
                        iconBg="bg-blue-50"
                        severity={moistureStatus.severity}
                        severityLabel={moistureStatus.label}
                        subtitle={
                            data.soilMoisture < 30 ? 'Soil is too dry — irrigation recommended'
                            : data.soilMoisture > 75 ? 'Saturated — avoid over-watering'
                            : 'Within healthy range'
                        }
                    >
                        <MoistureProgressBar value={data.soilMoisture ?? 0} />
                    </SensorCard>

                    {/* Temperature */}
                    <SensorCard
                        title="Temperature"
                        value={data.temperature?.toFixed(1) ?? '—'}
                        unit="°C"
                        icon={Thermometer}
                        iconColor="text-orange-500"
                        iconBg="bg-orange-50"
                        severity={tempStatus.severity}
                        severityLabel={tempStatus.label}
                        subtitle={
                            data.temperature > 32 ? '🔥 High — crop stress risk'
                            : data.temperature < 18 ? '❄️ Cool — growth may slow'
                            : '✅ Normal temperature range'
                        }
                    />

                    {/* Humidity */}
                    <SensorCard
                        title="Humidity"
                        value={data.humidity?.toFixed(0) ?? '—'}
                        unit="%"
                        icon={Wind}
                        iconColor="text-sky-500"
                        iconBg="bg-sky-50"
                        severity={humidityStatus.severity}
                        severityLabel={humidityStatus.label}
                        subtitle={
                            data.humidity > 70 ? 'High — disease/fungal risk'
                            : data.humidity < 40 ? 'Low — evaporation increase'
                            : 'Optimal humidity level'
                        }
                    />

                    {/* Water Level */}
                    <SensorCard
                        title="Water Level"
                        value={toDisplayWaterLevel(data.waterLevel)}
                        icon={Gauge}
                        iconColor={data.waterLevel === 'low' ? 'text-red-500' : 'text-blue-500'}
                        iconBg={data.waterLevel === 'low' ? 'bg-red-50' : 'bg-blue-50'}
                        severity={waterStatus.severity}
                        severityLabel={waterStatus.label}
                        subtitle={
                            data.waterLevel === 'low' ? '🚨 Refill tank immediately — pump blocked'
                            : data.waterLevel === 'high' ? 'Tank full — ready for irrigation'
                            : 'Adequate water supply'
                        }
                    >
                        <WaterLevelIndicator level={data.waterLevel} />
                    </SensorCard>

                    {/* Pump Status */}
                    <SensorCard
                        title="Pump Status"
                        value={<PumpStatusIndicator status={data.pumpStatus} size="lg" />}
                        icon={Cpu}
                        iconColor={data.pumpStatus === 'ON' ? 'text-emerald-600' : 'text-surface-400'}
                        iconBg={data.pumpStatus === 'ON' ? 'bg-emerald-50' : 'bg-surface-100'}
                        severity={data.pumpStatus === 'ON' ? 'optimal' : 'neutral'}
                        severityLabel={data.pumpStatus === 'ON' ? 'Running' : 'Standby'}
                        subtitle={
                            data.pumpStatus === 'ON'
                                ? 'Irrigation active — water being pumped'
                                : 'Pump idle — awaiting command'
                        }
                    />
                </SensorGridLayout>
            )}
        </section>
    )
}
