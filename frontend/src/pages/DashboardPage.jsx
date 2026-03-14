import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    Droplets, Thermometer, Wind, Wifi, Radio, WifiOff,
    RefreshCw, LogOut, Settings as SettingsIcon, Menu, X, Cpu
} from 'lucide-react'
import * as api from '../api'

import SensorCards from '../components/SensorCards'
import SensorCharts from '../components/SensorCharts'
import SchedulePanel from '../components/SchedulePanel'
import LogsTable from '../components/LogsTable'
import SettingsPanel from '../components/SettingsPanel'
import WeatherWidget from '../components/WeatherWidget'
import CommunityPanel from '../components/CommunityPanel'
import SensorDashboard from '../components/SensorDashboard'
import ControlsPage from './ControlsPage'

const POLL_INTERVAL = 30_000      // refresh every 30 seconds
const DEVICE_ID = 'field-001'

const NAV_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'controls', label: 'Controls' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'community', label: '🌾 Community' },
    { id: 'logs', label: 'Event Logs' },
    { id: 'settings', label: 'Settings' },
]

export default function DashboardPage() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()

    const [activeTab, setActiveTab] = useState('overview')
    const [mobileOpen, setMobileOpen] = useState(false)
    const [latestData, setLatestData] = useState(null)
    const [history, setHistory] = useState([])
    const [logs, setLogs] = useState([])
    const [settings, setSettings] = useState(null)
    const [prediction, setPrediction] = useState(null)
    const [backendOk, setBackendOk] = useState(null)
    const [loadingMain, setLoadingMain] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [lastRefresh, setLastRefresh] = useState(null)

    // ── Fetch all dashboard data ─────────────────────────────────
    const fetchAll = useCallback(async (showSpinner = false) => {
        if (showSpinner) setRefreshing(true)
        try {
            // Health check
            try {
                await api.getHealth()
                setBackendOk(true)
            } catch {
                setBackendOk(false)
            }

            const [latest, hist, logsData, sett, pred] = await Promise.allSettled([
                api.getLatestSensor(DEVICE_ID),
                api.getSensorHistory(DEVICE_ID, 48),
                api.getLogs(DEVICE_ID, 50),
                api.getSettings(DEVICE_ID),
                api.getMLPrediction(DEVICE_ID),
            ])

            if (latest.status === 'fulfilled') setLatestData(latest.value)
            if (hist.status === 'fulfilled') setHistory(hist.value.readings || [])
            if (logsData.status === 'fulfilled') setLogs(logsData.value.logs || [])
            if (sett.status === 'fulfilled') setSettings(sett.value)
            if (pred.status === 'fulfilled') setPrediction(pred.value)

            setLastRefresh(new Date())
        } finally {
            setLoadingMain(false)
            setRefreshing(false)
        }
    }, [])

    // ── Initial load + polling ────────────────────────────────────
    useEffect(() => {
        fetchAll()
        const interval = setInterval(() => fetchAll(), POLL_INTERVAL)
        return () => clearInterval(interval)
    }, [fetchAll])

    // ── Decision run ─────────────────────────────────────────────
    const handleDecision = async () => {
        const result = await api.runDecision(DEVICE_ID)
        setTimeout(() => fetchAll(), 800)
        return result
    }

    // ── Settings save ─────────────────────────────────────────────
    const handleSettingsSave = async (newSettings) => {
        await api.updateSettings({ ...newSettings, deviceId: DEVICE_ID })
        fetchAll()
    }

    // ── Logout ────────────────────────────────────────────────────
    const handleLogout = async () => {
        try { await logout() } catch { }
        navigate('/')
    }

    const networkIcon = (net) => {
        if (!net || net === 'wifi') return <Wifi size={14} className="text-emerald-500" />
        if (net === 'lora') return <Radio size={14} className="text-violet-500" />
        return <WifiOff size={14} className="text-red-500" />
    }

    const networkBadge = (net) => {
        if (!net || net === 'wifi') return 'badge-green'
        if (net === 'lora') return 'badge-purple'
        return 'badge-red'
    }

    if (loadingMain) {
        return (
            <div className="min-h-screen bg-surface-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center">
                        <Droplets size={32} className="text-primary-600 animate-pulse" />
                    </div>
                    <div className="spinner w-8 h-8 border-[3px] text-primary-600" />
                    <p className="text-surface-600 font-medium">Loading dashboard…</p>
                    <p className="text-surface-400 text-sm">Connecting to field-001</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-surface-50 flex flex-col">
            {/* ── Top Bar ──────────────────────────────────────────── */}
            <header className="bg-white border-b border-surface-200 sticky top-0 z-40">
                <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                            <Droplets size={18} className="text-white" />
                        </div>
                        <div>
                            <span className="font-bold text-surface-900 text-base tracking-tight">AquaIQ</span>
                            <span className="hidden sm:inline ml-2 text-xs text-surface-400 font-mono">
                                {DEVICE_ID}
                            </span>
                        </div>
                    </div>

                    {/* Center — Status chips */}
                    <div className="hidden md:flex items-center gap-3">
                        {/* Backend status */}
                        <span className={backendOk ? 'badge-green' : 'badge-red'}>
                            <span className={`status-dot ${backendOk ? 'online' : 'offline'}`} />
                            {backendOk ? 'API Online' : 'API Offline'}
                        </span>
                        {/* Network */}
                        {latestData && (
                            <span className={networkBadge(latestData.network)}>
                                {networkIcon(latestData.network)}
                                {latestData.network?.toUpperCase() || 'WIFI'}
                            </span>
                        )}
                        {/* Pump */}
                        {latestData && (
                            <span className={latestData.pumpStatus === 'ON' ? 'badge-green' : 'badge-gray'}>
                                <Cpu size={12} />
                                Pump {latestData.pumpStatus || 'OFF'}
                            </span>
                        )}
                    </div>

                    {/* Right — actions */}
                    <div className="flex items-center gap-2">
                        {lastRefresh && (
                            <span className="hidden lg:block text-xs text-surface-400">
                                Updated {lastRefresh.toLocaleTimeString()}
                            </span>
                        )}
                        <button
                            id="dashboard-refresh-btn"
                            onClick={() => fetchAll(true)}
                            disabled={refreshing}
                            className="p-2 rounded-lg hover:bg-surface-100 text-surface-500
                         hover:text-surface-700 transition-colors disabled:opacity-50"
                            title="Refresh data"
                        >
                            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        </button>
                        <button
                            id="dashboard-logout-btn"
                            onClick={handleLogout}
                            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm text-surface-600
                         hover:text-surface-900 hover:bg-surface-100 rounded-lg transition-colors"
                        >
                            <LogOut size={14} />
                            <span className="hidden md:inline">Logout</span>
                        </button>
                        {/* Mobile menu toggle */}
                        <button
                            className="sm:hidden p-2 rounded-lg hover:bg-surface-100"
                            onClick={() => setMobileOpen(!mobileOpen)}
                        >
                            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </div>

                {/* ── Tab Nav ── */}
                <div className="border-t border-surface-100 max-w-screen-2xl mx-auto px-4 sm:px-6">
                    <nav className="flex gap-1 overflow-x-auto scrollbar-hide py-1">
                        {NAV_TABS.map((tab) => (
                            <button
                                key={tab.id}
                                id={`tab-${tab.id}`}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 text-sm font-semibold rounded-lg whitespace-nowrap transition-all duration-150
                  ${activeTab === tab.id
                                        ? 'bg-primary-50 text-primary-700'
                                        : 'text-surface-500 hover:text-surface-700 hover:bg-surface-50'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </header>

            {/* ── Page Content ─────────────────────────────────────── */}
            <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 py-6">
                {activeTab === 'overview' && (
                    <div className="space-y-6 animate-fade-in">
                        <SensorDashboard deviceId={DEVICE_ID} />
                        <SensorCards data={latestData} />
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2">
                                <SensorCharts history={history} />
                            </div>
                            <div className="lg:col-span-1">
                                <WeatherWidget />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'controls' && (
                    <div className="animate-fade-in">
                        <ControlsPage deviceId={DEVICE_ID} />
                    </div>
                )}

                {activeTab === 'analytics' && (
                    <div className="animate-fade-in">
                        <SensorCharts history={history} expanded />
                    </div>
                )}

                {activeTab === 'schedule' && (
                    <div className="animate-fade-in">
                        <SchedulePanel prediction={prediction} onRunDecision={handleDecision} />
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div className="animate-fade-in">
                        <LogsTable logs={logs} onRefresh={() => fetchAll(true)} />
                    </div>
                )}

                {activeTab === 'community' && (
                    <div className="animate-fade-in">
                        <CommunityPanel user={user} sensorData={latestData} />
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="animate-fade-in">
                        <SettingsPanel
                            settings={settings}
                            user={user}
                            onSave={handleSettingsSave}
                        />
                    </div>
                )}
            </main>
        </div>
    )
}
