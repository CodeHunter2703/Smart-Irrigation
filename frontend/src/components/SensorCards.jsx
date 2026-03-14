import { Droplets, Thermometer, Wind, Cpu, Wifi, Radio, WifiOff, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

function MetricCard({ id, icon: Icon, label, value, unit, color, bg, badge, sub }) {
    return (
        <div id={id} className="card-hover flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
                    <Icon size={20} className={color} />
                </div>
                {badge}
            </div>
            <div>
                <p className="metric-label">{label}</p>
                <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="metric-value text-surface-900">{value ?? '—'}</span>
                    {unit && <span className="text-sm text-surface-400 font-medium">{unit}</span>}
                </div>
                {sub && <p className="text-xs text-surface-400 mt-1">{sub}</p>}
            </div>
        </div>
    )
}

function MoistureBar({ value }) {
    const pct = Math.min(100, Math.max(0, value || 0))
    const color = pct < 30 ? 'bg-red-400' : pct < 50 ? 'bg-amber-400' : 'bg-emerald-500'
    return (
        <div className="mt-2">
            <div className="flex justify-between text-xs text-surface-400 mb-1">
                <span>Dry</span><span>Wet</span>
            </div>
            <div className="w-full h-2 bg-surface-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ${color}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}

export default function SensorCards({ data }) {
    if (!data) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="card animate-pulse">
                        <div className="w-10 h-10 bg-surface-100 rounded-xl mb-3" />
                        <div className="h-3 w-16 bg-surface-100 rounded mb-2" />
                        <div className="h-7 w-20 bg-surface-100 rounded" />
                    </div>
                ))}
            </div>
        )
    }

    const { soilMoisture, temperature, humidity, network, pumpStatus, timestamp } = data

    const networkLabel = !network || network === 'wifi' ? 'WiFi'
        : network === 'lora' ? 'LoRa'
            : 'Offline'
    const networkBadgeClass = !network || network === 'wifi' ? 'badge-green'
        : network === 'lora' ? 'badge-purple'
            : 'badge-red'
    const NetworkIcon = !network || network === 'wifi' ? Wifi
        : network === 'lora' ? Radio
            : WifiOff

    const timeAgo = timestamp
        ? formatDistanceToNow(new Date(timestamp), { addSuffix: true })
        : 'unknown'

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h2 className="section-title">Live Sensor Data</h2>
                <div className="flex items-center gap-1.5 text-xs text-surface-400">
                    <Clock size={12} />
                    Updated {timeAgo}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Soil Moisture */}
                <div id="card-moisture" className="card-hover col-span-2 md:col-span-1">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                            <Droplets size={20} className="text-blue-500" />
                        </div>
                    </div>
                    <p className="metric-label">Soil Moisture</p>
                    <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="metric-value text-surface-900">{soilMoisture?.toFixed(1) ?? '—'}</span>
                        <span className="text-sm text-surface-400 font-medium">%</span>
                    </div>
                    <MoistureBar value={soilMoisture} />
                </div>

                {/* Temperature */}
                <MetricCard
                    id="card-temperature"
                    icon={Thermometer}
                    label="Temperature"
                    value={temperature?.toFixed(1) ?? '—'}
                    unit="°C"
                    color="text-orange-500"
                    bg="bg-orange-50"
                    sub={temperature > 32 ? '🔥 High — crop stress risk' : temperature < 20 ? '❄️ Cool' : '✅ Normal range'}
                />

                {/* Humidity */}
                <MetricCard
                    id="card-humidity"
                    icon={Wind}
                    label="Humidity"
                    value={humidity?.toFixed(0) ?? '—'}
                    unit="%"
                    color="text-sky-500"
                    bg="bg-sky-50"
                    sub={humidity > 70 ? 'High — disease risk' : humidity < 40 ? 'Low — check irrigation' : 'Optimal'}
                />

                {/* Network */}
                <div id="card-network" className="card-hover">
                    <div className="w-10 h-10 bg-surface-100 rounded-xl flex items-center justify-center mb-3">
                        <NetworkIcon size={20} className={
                            networkLabel === 'WiFi' ? 'text-emerald-500' :
                                networkLabel === 'LoRa' ? 'text-violet-500' : 'text-red-500'
                        } />
                    </div>
                    <p className="metric-label">Network</p>
                    <p className="text-xl font-bold text-surface-900 mt-1">{networkLabel}</p>
                    <span className={`${networkBadgeClass} mt-2 text-xs`}>
                        <span className={`status-dot ${networkLabel === 'WiFi' ? 'online' :
                                networkLabel === 'LoRa' ? 'lora' : 'offline'
                            }`} />
                        {networkLabel === 'LoRa' ? 'Fallback active' : networkLabel === 'WiFi' ? 'Connected' : 'No connection'}
                    </span>
                </div>

                {/* Pump Status */}
                <div id="card-pump" className="card-hover">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3
            ${pumpStatus === 'ON' ? 'bg-emerald-50' : 'bg-surface-100'}
            ${pumpStatus === 'ON' ? 'pump-on' : ''}`}
                    >
                        <Cpu size={20} className={pumpStatus === 'ON' ? 'text-emerald-600' : 'text-surface-400'} />
                    </div>
                    <p className="metric-label">Pump Status</p>
                    <p className={`text-xl font-bold mt-1 ${pumpStatus === 'ON' ? 'text-emerald-600' : 'text-surface-400'}`}>
                        {pumpStatus || 'OFF'}
                    </p>
                    <span className={pumpStatus === 'ON' ? 'badge-green mt-2 text-xs' : 'badge-gray mt-2 text-xs'}>
                        <span className={`status-dot ${pumpStatus === 'ON' ? 'online' : ''}`}
                            style={pumpStatus !== 'ON' ? { background: '#cbd5e1' } : {}} />
                        {pumpStatus === 'ON' ? 'Running' : 'Standby'}
                    </span>
                </div>

                {/* Device ID */}
                <div id="card-device" className="card-hover">
                    <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center mb-3">
                        <Cpu size={20} className="text-primary-600" />
                    </div>
                    <p className="metric-label">Device</p>
                    <p className="text-base font-bold text-surface-900 mt-1 font-mono">field-001</p>
                    <span className="badge-green mt-2 text-xs">
                        <span className="status-dot online" />
                        ESP32 Active
                    </span>
                </div>
            </div>
        </div>
    )
}
