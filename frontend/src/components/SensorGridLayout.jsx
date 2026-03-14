/**
 * SensorGridLayout — Responsive grid wrapper for sensor cards.
 * 
 * Lays out children in a responsive grid:
 *   - 1 column on mobile
 *   - 2 columns on tablet
 *   - 3 columns on desktop
 *   - 5 columns on wide screens
 */

export default function SensorGridLayout({ children, columns = 'auto' }) {
    const gridClasses = columns === 'auto'
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
        : `grid-cols-1 sm:grid-cols-2 lg:grid-cols-${columns}`

    return (
        <div className={`grid ${gridClasses} gap-4`}>
            {children}
        </div>
    )
}
