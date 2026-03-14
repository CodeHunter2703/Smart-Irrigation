/**
 * MoistureProgressBar — Animated progress bar with color-coded moisture levels.
 * 
 * Color guide:
 *   < 30%  → Red (critical — soil too dry)
 *   30-60% → Yellow/Amber (warning — needs attention)
 *   > 60%  → Green (optimal moisture level)
 * 
 * Includes a gradient fill, percentage label, and smooth width transition.
 */

export default function MoistureProgressBar({ value = 0, showLabel = true, height = 'h-2.5' }) {
    const bounded = Math.max(0, Math.min(100, Number(value) || 0))

    // Determine color and severity based on moisture level
    const getBarStyle = (pct) => {
        if (pct < 30) return {
            gradient: 'from-red-400 to-red-500',
            bg: 'bg-red-100',
            text: 'text-red-600',
            label: 'Critical',
        }
        if (pct < 60) return {
            gradient: 'from-amber-400 to-amber-500',
            bg: 'bg-amber-100',
            text: 'text-amber-600',
            label: 'Warning',
        }
        return {
            gradient: 'from-emerald-400 to-emerald-500',
            bg: 'bg-emerald-100',
            text: 'text-emerald-600',
            label: 'Optimal',
        }
    }

    const style = getBarStyle(bounded)

    return (
        <div className="mt-3">
            {/* Progress bar track */}
            <div className={`w-full ${height} ${style.bg} rounded-full overflow-hidden`}>
                <div
                    className={`h-full rounded-full bg-gradient-to-r ${style.gradient} transition-all duration-700 ease-out`}
                    style={{ width: `${bounded}%` }}
                />
            </div>

            {/* Labels */}
            {showLabel && (
                <div className="mt-1.5 flex justify-between items-center text-[11px]">
                    <span className="text-surface-400">
                        🏜️ Dry
                    </span>
                    <span className={`font-semibold ${style.text}`}>
                        {style.label}
                    </span>
                    <span className="text-surface-400">
                        💧 Wet
                    </span>
                </div>
            )}
        </div>
    )
}
