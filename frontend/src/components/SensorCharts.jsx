import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, AreaChart, Area,
    BarChart, Bar, ReferenceLine,
} from 'recharts'
import { format } from 'date-fns'

const COLORS = {
    moisture: '#3b82f6',
    temperature: '#f97316',
    humidity: '#06b6d4',
    pump: '#10b981',
}

function ChartCard({ id, title, subtitle, children, height = 220 }) {
    return (
        <div id={id} className="card">
            <div className="mb-4">
                <h3 className="font-bold text-surface-900">{title}</h3>
                {subtitle && <p className="text-xs text-surface-400 mt-0.5">{subtitle}</p>}
            </div>
            <div style={{ height }}>
                {children}
            </div>
        </div>
    )
}

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
        <div className="bg-white border border-surface-200 rounded-xl shadow-lg px-4 py-3">
            <p className="text-xs font-semibold text-surface-500 mb-2">{label}</p>
            {payload.map((p) => (
                <p key={p.name} className="text-sm font-medium" style={{ color: p.color }}>
                    {p.name}: <strong>{p.value?.toFixed(1)}</strong> {p.unit || ''}
                </p>
            ))}
        </div>
    )
}

function formatTime(ts) {
    try { return format(new Date(ts), 'HH:mm') } catch { return ts }
}

function formatDate(ts) {
    try { return format(new Date(ts), 'MM/dd HH:mm') } catch { return ts }
}

export default function SensorCharts({ history, expanded = false }) {
    if (!history || history.length === 0) {
        return (
            <div className="card text-center py-16 text-surface-400">
                <p className="font-medium">No historical data available yet</p>
                <p className="text-sm mt-1">Post sensor data to see charts</p>
            </div>
        )
    }

    // Trim for overview vs expanded
    const data = expanded ? history : history.slice(-24)

    const chartData = data.map((r) => ({
        time: formatTime(r.timestamp),
        fullTime: formatDate(r.timestamp),
        moisture: parseFloat(r.soilMoisture?.toFixed(1)),
        temperature: parseFloat(r.temperature?.toFixed(1)),
        humidity: parseFloat(r.humidity?.toFixed(1)),
        pump: r.pumpStatus === 'ON' ? 1 : 0,
    }))

    return (
        <div className={`grid gap-6 ${expanded ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
            {/* Soil Moisture */}
            <ChartCard
                id="chart-moisture"
                title="Soil Moisture Over Time"
                subtitle="% volumetric water content — 30-min readings"
                height={expanded ? 300 : 220}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                            <linearGradient id="gradMoisture" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={COLORS.moisture} stopOpacity={0.15} />
                                <stop offset="95%" stopColor={COLORS.moisture} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false}
                            axisLine={false} unit="%" />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="4 4"
                            label={{ value: 'Threshold', position: 'right', fontSize: 10, fill: '#f59e0b' }} />
                        <Area type="monotone" dataKey="moisture" name="Moisture" stroke={COLORS.moisture}
                            strokeWidth={2} fill="url(#gradMoisture)" dot={false} activeDot={{ r: 5 }}
                            unit="%" />
                    </AreaChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* Temperature */}
            <ChartCard
                id="chart-temperature"
                title="Temperature Over Time"
                subtitle="°C — DHT22 sensor readings"
                height={expanded ? 300 : 220}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
                        <YAxis domain={[15, 45]} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false}
                            axisLine={false} unit="°" />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="temperature" name="Temperature" stroke={COLORS.temperature}
                            strokeWidth={2} dot={false} activeDot={{ r: 5 }} unit="°C" />
                        <Line type="monotone" dataKey="humidity" name="Humidity" stroke={COLORS.humidity}
                            strokeWidth={1.5} dot={false} strokeDasharray="4 4" unit="%" />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    </LineChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* Pump Activity Timeline */}
            <ChartCard
                id="chart-pump"
                title="Pump Activity Timeline"
                subtitle="1 = ON, 0 = OFF — irrigation events"
                height={expanded ? 250 : 180}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
                        <YAxis domain={[0, 1]} ticks={[0, 1]} tick={{ fontSize: 11, fill: '#94a3b8' }}
                            tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="pump" name="Pump" fill={COLORS.pump} radius={[2, 2, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* Combined */}
            {expanded && (
                <ChartCard
                    id="chart-combined"
                    title="Combined Sensor Overview"
                    subtitle="All readings normalised — historical trend"
                    height={300}
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="fullTime" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                            <Line type="monotone" dataKey="moisture" name="Moisture %" stroke={COLORS.moisture} strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="temperature" name="Temperature °C" stroke={COLORS.temperature} strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="humidity" name="Humidity %" stroke={COLORS.humidity} strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}
        </div>
    )
}
