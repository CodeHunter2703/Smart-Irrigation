/**
 * PumpStatusIndicator — Visual indicator showing pump ON/OFF state.
 * 
 * Features:
 *   - Glowing green dot with pulse animation when pump is ON
 *   - Muted gray for OFF state
 *   - Size variants: 'sm', 'md', 'lg'
 */

export default function PumpStatusIndicator({ status = 'OFF', size = 'md' }) {
    const isOn = String(status).toUpperCase() === 'ON'

    const sizeStyles = {
        sm: { badge: 'px-2 py-0.5 text-[11px]', dot: 'w-1.5 h-1.5' },
        md: { badge: 'px-2.5 py-1 text-xs', dot: 'w-2 h-2' },
        lg: { badge: 'px-3 py-1.5 text-sm', dot: 'w-2.5 h-2.5' },
    }

    const s = sizeStyles[size] || sizeStyles.md

    return (
        <span
            className={`
                inline-flex items-center gap-1.5 rounded-full font-semibold
                transition-all duration-300
                ${s.badge}
                ${isOn
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-glow-green'
                    : 'bg-surface-100 text-surface-500 border border-surface-200'
                }
            `}
        >
            {/* Status dot with pulse animation when ON */}
            <span className="relative flex items-center justify-center">
                {isOn && (
                    <span
                        className={`absolute ${s.dot} rounded-full bg-emerald-400 animate-ping opacity-75`}
                    />
                )}
                <span
                    className={`
                        relative ${s.dot} rounded-full
                        ${isOn ? 'bg-emerald-500' : 'bg-surface-400'}
                    `}
                />
            </span>
            {isOn ? 'ON' : 'OFF'}
        </span>
    )
}
