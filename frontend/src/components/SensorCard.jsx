import { useState, useEffect } from 'react'

/**
 * SensorCard — A polished, reusable card for displaying a single sensor metric.
 * 
 * Features:
 *   - Animated icon with configurable background gradient
 *   - Color-coded status based on severity (green/yellow/red)
 *   - Subtle value change animation when data updates
 *   - Optional children slot for custom content (progress bars, indicators, etc.)
 */

const SEVERITY_STYLES = {
    optimal: {
        border: 'border-emerald-200/60',
        glow: 'shadow-[0_0_0_1px_rgba(16,185,129,0.08)]',
        dot: 'bg-emerald-500',
        label: 'text-emerald-600',
        labelBg: 'bg-emerald-50',
    },
    warning: {
        border: 'border-amber-200/60',
        glow: 'shadow-[0_0_0_1px_rgba(245,158,11,0.08)]',
        dot: 'bg-amber-500',
        label: 'text-amber-600',
        labelBg: 'bg-amber-50',
    },
    critical: {
        border: 'border-red-200/60',
        glow: 'shadow-[0_0_0_1px_rgba(239,68,68,0.08)]',
        dot: 'bg-red-500',
        label: 'text-red-600',
        labelBg: 'bg-red-50',
    },
    neutral: {
        border: 'border-surface-200/60',
        glow: '',
        dot: 'bg-surface-400',
        label: 'text-surface-500',
        labelBg: 'bg-surface-50',
    },
}

export default function SensorCard({
    title,
    value,
    unit,
    subtitle,
    icon: Icon,
    iconColor = 'text-primary-600',
    iconBg = 'bg-primary-50',
    severity = 'neutral',       // 'optimal' | 'warning' | 'critical' | 'neutral'
    severityLabel,               // e.g. "Optimal", "Low", "Critical"
    trend,                       // 'up' | 'down' | 'stable' | null
    children,
}) {
    const styles = SEVERITY_STYLES[severity] || SEVERITY_STYLES.neutral
    const [flash, setFlash] = useState(false)

    // Flash animation when value changes
    useEffect(() => {
        setFlash(true)
        const timer = setTimeout(() => setFlash(false), 600)
        return () => clearTimeout(timer)
    }, [value])

    const trendArrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : trend === 'stable' ? '→' : null

    return (
        <div
            className={`
                relative bg-white rounded-2xl border p-5
                shadow-card hover:shadow-card-hover hover:-translate-y-0.5
                transition-all duration-200 overflow-hidden
                ${styles.border} ${styles.glow}
            `}
        >
            {/* Top row — icon + severity badge */}
            <div className="flex items-start justify-between mb-3">
                {Icon && (
                    <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center`}>
                        <Icon size={20} className={iconColor} />
                    </div>
                )}
                {severityLabel && (
                    <span className={`
                        inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold
                        ${styles.labelBg} ${styles.label}
                    `}>
                        <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                        {severityLabel}
                    </span>
                )}
            </div>

            {/* Metric label */}
            <p className="text-sm font-medium text-surface-500 mb-1">{title}</p>

            {/* Value row */}
            <div className="flex items-baseline gap-1.5">
                <span className={`
                    text-2xl font-bold text-surface-900 tracking-tight
                    transition-all duration-300
                    ${flash ? 'scale-105' : 'scale-100'}
                `}>
                    {value ?? '—'}
                </span>
                {unit && <span className="text-sm text-surface-400 font-medium">{unit}</span>}
                {trendArrow && (
                    <span className={`text-xs font-bold ml-1 ${
                        trend === 'up' ? 'text-emerald-500'
                        : trend === 'down' ? 'text-red-500'
                        : 'text-surface-400'
                    }`}>
                        {trendArrow}
                    </span>
                )}
            </div>

            {/* Subtitle */}
            {subtitle && <p className="text-xs text-surface-400 mt-1.5">{subtitle}</p>}

            {/* Children slot (progress bars, custom content, etc.) */}
            {children}
        </div>
    )
}
