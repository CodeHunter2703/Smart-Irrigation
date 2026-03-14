import { useNavigate } from 'react-router-dom'
import {
    Wifi, Cloud, Cpu, BarChart3, Droplets, Zap,
    ArrowRight, Radio, GitBranch, Shield
} from 'lucide-react'

const FEATURES = [
    {
        icon: Droplets,
        title: 'Live Soil Sensing',
        desc: 'ESP32 + capacitive soil moisture sensor streams readings every 30 seconds via WiFi or LoRa fallback.',
        color: 'text-blue-500',
        bg: 'bg-blue-50',
    },
    {
        icon: Cloud,
        title: 'Weather Intelligence',
        desc: 'Integrates OpenWeatherMap forecast. Skips irrigation automatically when rain probability > 50%.',
        color: 'text-violet-500',
        bg: 'bg-violet-50',
    },
    {
        icon: Zap,
        title: 'AI Decision Engine',
        desc: 'Rule-based + LSTM-ready scheduler. Decides pump ON/OFF based on moisture, forecast and history.',
        color: 'text-amber-500',
        bg: 'bg-amber-50',
    },
    {
        icon: Radio,
        title: 'Resilient Connectivity',
        desc: 'Automatic failover from WiFi → LoRa. SD card logging keeps data safe during outages.',
        color: 'text-rose-500',
        bg: 'bg-rose-50',
    },
    {
        icon: BarChart3,
        title: 'Real-time Analytics',
        desc: 'Live charts for soil moisture, temperature and pump activity. Exportable event logs.',
        color: 'text-emerald-500',
        bg: 'bg-emerald-50',
    },
    {
        icon: Shield,
        title: 'Fail-safe Mode',
        desc: 'Sensor anomaly detection with automatic pump shutoff. No over-watering, no crop damage.',
        color: 'text-teal-500',
        bg: 'bg-teal-50',
    },
]

const ARCH_STEPS = [
    { label: 'Field Device', sub: 'ESP32 + DHT22 + Moisture Sensor', icon: Cpu },
    { label: 'Connectivity', sub: 'WiFi / LoRa Fallback', icon: Wifi },
    { label: 'Flask Backend', sub: 'Decision Logic + Weather API', icon: GitBranch },
    { label: 'Firebase', sub: 'Firestore + Realtime DB', icon: Cloud },
    { label: 'Dashboard', sub: 'React Analytics & Control Panel', icon: BarChart3 },
]

export default function LandingPage() {
    const navigate = useNavigate()

    return (
        <div className="min-h-screen bg-surface-50 flex flex-col">
            {/* ── Nav ─────────────────────────────────── */}
            <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-surface-200">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                            <Droplets size={18} className="text-white" />
                        </div>
                        <span className="font-bold text-surface-900 text-lg tracking-tight">
                            AquaIQ
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            id="nav-login-btn"
                            onClick={() => navigate('/login')}
                            className="btn-secondary text-sm py-2 px-4"
                        >
                            Login
                        </button>
                        <button
                            id="nav-dashboard-btn"
                            onClick={() => navigate('/dashboard')}
                            className="btn-primary text-sm py-2 px-4"
                        >
                            Open Dashboard
                        </button>
                    </div>
                </div>
            </nav>

            {/* ── Hero ─────────────────────────────────── */}
            <section className="hero-gradient pt-32 pb-24 px-6 text-white relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-32 -right-32 w-96 h-96 bg-white/5 rounded-full" />
                    <div className="absolute bottom-0 -left-24 w-72 h-72 bg-white/5 rounded-full" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                          w-[600px] h-[600px] bg-primary-500/10 rounded-full blur-3xl" />
                </div>

                <div className="max-w-4xl mx-auto text-center relative z-10 animate-fade-in">
                    {/* Hackathon badge */}
                    <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20
                          rounded-full px-4 py-1.5 text-sm font-medium mb-8 backdrop-blur-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Hackathon 2026 — IoT + AI Track
                    </div>

                    <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-tight tracking-tight">
                        Smart Irrigation
                        <span className="block text-emerald-400">Scheduler</span>
                    </h1>

                    <p className="text-xl text-white/80 mb-4 font-medium">
                        An end-to-end IoT solution that replaces traditional timers
                        <br className="hidden md:block" />
                        with <span className="text-emerald-300 font-semibold">data-driven automation</span>.
                    </p>

                    <p className="text-white/60 text-base mb-12 max-w-2xl mx-auto">
                        ESP32 field sensors → LoRa fallback → Flask AI controller → Firebase → Live dashboard.
                        Water crops only when needed. Save water, save costs, save time.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            id="hero-dashboard-btn"
                            onClick={() => navigate('/dashboard')}
                            className="group inline-flex items-center gap-3 bg-emerald-500 hover:bg-emerald-400
                         text-white font-bold px-8 py-4 rounded-2xl text-lg
                         transition-all duration-200 shadow-lg hover:shadow-emerald-500/30"
                        >
                            Open Dashboard
                            <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button
                            id="hero-learn-btn"
                            onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
                            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20
                         border border-white/20 text-white font-semibold px-8 py-4
                         rounded-2xl text-lg transition-all duration-200 backdrop-blur-sm"
                        >
                            Learn More
                        </button>
                    </div>
                </div>

                {/* Live metrics preview cards */}
                <div className="max-w-3xl mx-auto mt-16 grid grid-cols-3 gap-4 relative z-10">
                    {[
                        { label: 'Soil Moisture', value: '42%', icon: Droplets, color: 'text-blue-300' },
                        { label: 'Temperature', value: '29°C', icon: Zap, color: 'text-amber-300' },
                        { label: 'Pump Status', value: 'AUTO', icon: Cpu, color: 'text-emerald-300' },
                    ].map((m) => (
                        <div key={m.label} className="glass-card rounded-2xl p-5 text-center">
                            <m.icon size={24} className={`${m.color} mx-auto mb-2`} />
                            <div className="text-2xl font-bold text-white">{m.value}</div>
                            <div className="text-white/60 text-xs mt-1">{m.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Architecture Flow ─────────────────── */}
            <section className="py-16 px-6 bg-white border-b border-surface-200">
                <div className="max-w-5xl mx-auto">
                    <p className="text-center text-xs font-bold uppercase tracking-widest text-primary-600 mb-2">
                        System Architecture
                    </p>
                    <h2 className="text-2xl font-bold text-center text-surface-900 mb-12">
                        From field device to cloud dashboard
                    </h2>
                    <div className="flex flex-col md:flex-row items-center justify-center gap-0">
                        {ARCH_STEPS.map((step, i) => (
                            <div key={step.label} className="flex items-center">
                                <div className="flex flex-col items-center text-center px-4">
                                    <div className="w-14 h-14 rounded-2xl bg-primary-50 border border-primary-200
                                  flex items-center justify-center mb-3">
                                        <step.icon size={24} className="text-primary-600" />
                                    </div>
                                    <p className="font-bold text-surface-900 text-sm">{step.label}</p>
                                    <p className="text-surface-500 text-xs mt-0.5 max-w-[100px]">{step.sub}</p>
                                </div>
                                {i < ARCH_STEPS.length - 1 && (
                                    <ArrowRight size={20} className="text-surface-300 hidden md:block flex-shrink-0" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Features ─────────────────────────── */}
            <section id="features" className="py-20 px-6 bg-surface-50">
                <div className="max-w-6xl mx-auto">
                    <p className="text-center text-xs font-bold uppercase tracking-widest text-primary-600 mb-2">
                        Core Features
                    </p>
                    <h2 className="text-3xl font-bold text-center text-surface-900 mb-12">
                        Everything in one platform
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {FEATURES.map((f) => (
                            <div key={f.title} className="card-hover">
                                <div className={`w-12 h-12 ${f.bg} rounded-xl flex items-center justify-center mb-4`}>
                                    <f.icon size={24} className={f.color} />
                                </div>
                                <h3 className="font-bold text-surface-900 mb-2">{f.title}</h3>
                                <p className="text-surface-500 text-sm leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ──────────────────────────────── */}
            <section className="py-20 px-6 bg-primary-600">
                <div className="max-w-2xl mx-auto text-center">
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Ready to see it in action?
                    </h2>
                    <p className="text-primary-100 mb-8 text-lg">
                        Open the live dashboard — no setup required in demo mode.
                    </p>
                    <button
                        id="cta-dashboard-btn"
                        onClick={() => navigate('/dashboard')}
                        className="inline-flex items-center gap-3 bg-white text-primary-700
                       font-bold px-8 py-4 rounded-2xl text-lg hover:bg-primary-50
                       transition-all duration-200 shadow-lg"
                    >
                        Open Dashboard <ArrowRight size={22} />
                    </button>
                </div>
            </section>

            {/* ── Footer ───────────────────────────── */}
            <footer className="py-8 px-6 bg-surface-900 text-center text-surface-500 text-sm">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-primary-600 rounded-md flex items-center justify-center">
                        <Droplets size={12} className="text-white" />
                    </div>
                    <span className="font-bold text-white">AquaIQ</span>
                </div>
                <p>Smart Irrigation Scheduler • Hackathon 2026 • Built with React + Flask + Firebase</p>
            </footer>
        </div>
    )
}
