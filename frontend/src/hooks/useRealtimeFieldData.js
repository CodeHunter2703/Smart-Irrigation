import { useEffect, useMemo, useState, useRef } from 'react'
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../firebase'

function parseTimestamp(value) {
    if (!value) return null
    if (typeof value?.toDate === 'function') return value.toDate()
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

function normalizeWaterLevel(value) {
    if (value == null) return 'unknown'
    if (typeof value === 'number') {
        if (value < 30) return 'low'
        if (value < 70) return 'medium'
        return 'high'
    }

    const level = String(value).trim().toLowerCase()
    if (['low', 'medium', 'high'].includes(level)) return level

    const asNum = Number(level)
    if (!Number.isNaN(asNum)) return normalizeWaterLevel(asNum)
    return 'unknown'
}

/**
 * Picks the newest document from a snapshot by comparing timestamps client-side.
 * Used as a fallback when the composite index (deviceId + timestamp) is missing.
 */
function newestFromSnapshot(snap) {
    if (snap.empty) return null
    let best = null
    let bestTs = ''
    for (const d of snap.docs) {
        const data = d.data()
        const ts = data.timestamp?.toDate?.()?.toISOString?.() ?? data.timestamp ?? ''
        if (ts >= bestTs) {
            bestTs = ts
            best = data
        }
    }
    return best
}

export default function useRealtimeFieldData(deviceId = 'field-001') {
    const [sensor, setSensor] = useState(null)
    const [device, setDevice] = useState(null)
    const [controls, setControls] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const usingFallback = useRef(false)

    useEffect(() => {
        setLoading(true)
        setError('')
        usingFallback.current = false
        let unsubscribeSensor = () => {}

        /**
         * Strategy 1 (preferred): Composite index query
         *   where(deviceId) + orderBy(timestamp desc) + limit(1)
         *   Requires a Firestore composite index to exist.
         *
         * Strategy 2 (fallback): Simple query, sort client-side
         *   where(deviceId) + limit(10), pick the newest in JS.
         *   Works without any index, but less efficient.
         */
        function subscribePrimary() {
            const sensorQuery = query(
                collection(db, 'sensor_readings'),
                where('deviceId', '==', deviceId),
                orderBy('timestamp', 'desc'),
                limit(1)
            )

            unsubscribeSensor = onSnapshot(sensorQuery, (snap) => {
                setSensor(snap.empty ? null : snap.docs[0].data())
                setLoading(false)
            }, (err) => {
                const msg = err.message || ''
                // If the error is about a missing index, fall back gracefully
                if (msg.includes('index') || msg.includes('requires an index')) {
                    console.warn('⚠️ Composite index missing — falling back to simple query')
                    usingFallback.current = true
                    subscribeFallback()
                } else {
                    setError(msg || 'Failed to subscribe to sensor data')
                    setLoading(false)
                }
            })
        }

        function subscribeFallback() {
            // Simple query without orderBy — no composite index needed
            const fallbackQuery = query(
                collection(db, 'sensor_readings'),
                where('deviceId', '==', deviceId),
                limit(10)
            )

            unsubscribeSensor = onSnapshot(fallbackQuery, (snap) => {
                setSensor(newestFromSnapshot(snap))
                setLoading(false)
                setError('')   // clear the original index error
            }, (err) => {
                setError(err.message || 'Failed to subscribe to sensor data')
                setLoading(false)
            })
        }

        // Start with the preferred strategy
        subscribePrimary()

        const unsubscribeDevice = onSnapshot(doc(db, 'devices', deviceId), (snap) => {
            setDevice(snap.exists() ? snap.data() : null)
        })

        const unsubscribeControls = onSnapshot(doc(db, 'controls', deviceId), (snap) => {
            setControls(snap.exists() ? snap.data() : null)
        })

        return () => {
            unsubscribeSensor()
            unsubscribeDevice()
            unsubscribeControls()
        }
    }, [deviceId])

    const merged = useMemo(() => {
        const waterLevel = normalizeWaterLevel(
            sensor?.waterLevel ?? sensor?.water_level ?? device?.waterLevel
        )

        const rawPumpStatus = controls?.pump ?? device?.pumpStatus ?? sensor?.pumpStatus ?? 'OFF'
        const pumpStatus = String(rawPumpStatus).toUpperCase() === 'ON' ? 'ON' : 'OFF'

        const irrigationMode = controls?.irrigation_mode
            ?? (device?.autoMode ? 'AUTOMATIC' : 'MANUAL')
            ?? 'MANUAL'

        const valve = controls?.valve ?? 'CLOSE'
        const sensorTime = parseTimestamp(sensor?.timestamp)
        const lastSeen = parseTimestamp(device?.lastSeen ?? sensor?.timestamp)

        return {
            soilMoisture: typeof sensor?.soilMoisture === 'number' ? sensor.soilMoisture : null,
            temperature: typeof sensor?.temperature === 'number' ? sensor.temperature : null,
            humidity: typeof sensor?.humidity === 'number' ? sensor.humidity : null,
            waterLevel,
            pumpStatus,
            valve,
            irrigationMode,
            network: sensor?.network ?? device?.network ?? 'offline',
            timestamp: sensorTime,
            lastSeen,
        }
    }, [controls, device, sensor])

    const warnings = useMemo(() => {
        const items = []
        const now = Date.now()
        const lastSeenMs = merged.lastSeen?.getTime()
        const isOffline = !lastSeenMs || (now - lastSeenMs) > 5 * 60 * 1000

        if (isOffline) {
            items.push({ id: 'offline', severity: 'critical', message: 'Sensor appears offline (no recent updates).' })
        }

        if (merged.waterLevel === 'low') {
            items.push({ id: 'water-low', severity: 'critical', message: 'Water level is LOW. Pump activation will be blocked.' })
        }

        if (typeof merged.soilMoisture === 'number' && merged.soilMoisture >= 75) {
            items.push({ id: 'moisture-high', severity: 'warning', message: 'Soil moisture is already high. Avoid over-irrigation.' })
        }

        return items
    }, [merged.lastSeen, merged.soilMoisture, merged.waterLevel])

    return {
        data: merged,
        warnings,
        loading,
        error,
    }
}
