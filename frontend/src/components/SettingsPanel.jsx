import { useState, useEffect } from 'react'
import {
    Settings2, Save, CheckCircle2, User, Server,
    Sliders, MapPin, Clock
} from 'lucide-react'

export default function SettingsPanel({ settings, user, onSave }) {
    const [form, setForm] = useState({
        deviceId: 'field-001',
        moistureThreshold: 40,
        autoMode: true,
        location: 'Field A',
        timezone: 'Asia/Kolkata',
    })
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        if (settings) setForm((prev) => ({ ...prev, ...settings }))
    }, [settings])

    const handleChange = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }))
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            await onSave(form)
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="max-w-2xl space-y-6">
            {/* ── Device Settings ─────────────────────────────────── */}
            <div className="card">
                <div className="flex items-center gap-2 mb-6">
                    <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center">
                        <Server size={18} className="text-primary-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-surface-900">Device Configuration</h3>
                        <p className="text-xs text-surface-400">ESP32 field device settings</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="setting-deviceId" className="label">Device ID</label>
                        <input
                            id="setting-deviceId"
                            type="text"
                            value={form.deviceId}
                            onChange={(e) => handleChange('deviceId', e.target.value)}
                            className="input-field font-mono"
                        />
                    </div>

                    <div>
                        <label htmlFor="setting-location" className="label">
                            <MapPin size={13} className="inline mr-1" />
                            Field Location
                        </label>
                        <input
                            id="setting-location"
                            type="text"
                            value={form.location || ''}
                            onChange={(e) => handleChange('location', e.target.value)}
                            placeholder="e.g. Field A — North Sector"
                            className="input-field"
                        />
                    </div>

                    <div>
                        <label htmlFor="setting-timezone" className="label">
                            <Clock size={13} className="inline mr-1" />
                            Timezone
                        </label>
                        <select
                            id="setting-timezone"
                            value={form.timezone || 'Asia/Kolkata'}
                            onChange={(e) => handleChange('timezone', e.target.value)}
                            className="input-field"
                        >
                            {[
                                'Asia/Kolkata',
                                'Asia/Dubai',
                                'UTC',
                                'America/New_York',
                                'America/Los_Angeles',
                                'Europe/London',
                                'Asia/Tokyo',
                            ].map((tz) => (
                                <option key={tz} value={tz}>{tz}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* ── Irrigation Settings ─────────────────────────────── */}
            <div className="card">
                <div className="flex items-center gap-2 mb-6">
                    <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
                        <Sliders size={18} className="text-emerald-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-surface-900">Irrigation Settings</h3>
                        <p className="text-xs text-surface-400">Decision engine parameters</p>
                    </div>
                </div>

                <div className="space-y-5">
                    {/* Threshold slider */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label htmlFor="settings-threshold" className="label mb-0">
                                Moisture Threshold
                            </label>
                            <span className="text-primary-600 font-bold">{form.moistureThreshold}%</span>
                        </div>
                        <input
                            id="settings-threshold"
                            type="range"
                            min={10}
                            max={80}
                            value={form.moistureThreshold}
                            onChange={(e) => handleChange('moistureThreshold', Number(e.target.value))}
                            className="w-full"
                            style={{
                                background: `linear-gradient(to right, #0d9257 0%, #0d9257 ${((form.moistureThreshold - 10) / 70) * 100}%, #e2e8f0 ${((form.moistureThreshold - 10) / 70) * 100}%, #e2e8f0 100%)`
                            }}
                        />
                        <div className="flex justify-between text-xs text-surface-400 mt-1">
                            <span>10% (Dry)</span><span>80% (Saturated)</span>
                        </div>
                    </div>

                    {/* Auto mode */}
                    <div className="flex items-center justify-between py-4 border-t border-surface-100">
                        <div>
                            <p className="font-semibold text-surface-800 text-sm">Auto Irrigation Mode</p>
                            <p className="text-xs text-surface-400 mt-0.5">
                                Decision engine controls the pump automatically
                            </p>
                        </div>
                        <label htmlFor="settings-automode" className="relative inline-flex items-center cursor-pointer">
                            <input
                                id="settings-automode"
                                type="checkbox"
                                checked={form.autoMode}
                                onChange={(e) => handleChange('autoMode', e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-surface-200 rounded-full peer
                              peer-checked:bg-primary-600 transition-colors duration-200
                              after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                              after:bg-white after:rounded-full after:h-5 after:w-5
                              after:transition-transform after:duration-200
                              peer-checked:after:translate-x-5" />
                        </label>
                    </div>
                </div>
            </div>

            {/* ── User Info ───────────────────────────────────────── */}
            {user && (
                <div className="card">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-9 h-9 bg-surface-100 rounded-xl flex items-center justify-center">
                            <User size={18} className="text-surface-600" />
                        </div>
                        <h3 className="font-bold text-surface-900">Account</h3>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-surface-50 rounded-xl">
                        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-primary-700 font-bold text-lg">
                                {user.email?.[0]?.toUpperCase() || 'U'}
                            </span>
                        </div>
                        <div>
                            <p className="font-semibold text-surface-900">{user.email}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Save Button ─────────────────────────────────────── */}
            <button
                id="settings-save-btn"
                onClick={handleSave}
                disabled={saving}
                className={`${saved ? 'btn-secondary' : 'btn-primary'} py-3 px-8`}
            >
                {saving ? (
                    <><div className="spinner w-4 h-4 border-white/30 border-t-white" />Saving…</>
                ) : saved ? (
                    <><CheckCircle2 size={16} className="text-emerald-500" />Settings Saved!</>
                ) : (
                    <><Save size={16} />Save All Settings</>
                )}
            </button>
        </div>
    )
}
