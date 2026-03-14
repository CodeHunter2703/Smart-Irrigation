import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Droplets, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function LoginPage() {
    const [mode, setMode] = useState('login')       // 'login' | 'signup'
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPw, setShowPw] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const { login, signup, demoLogin } = useAuth()
    const navigate = useNavigate()

    // Demo bypass — sets a localStorage flag + synthetic user, then navigates
    const handleDemoLogin = () => {
        demoLogin()
        navigate('/dashboard')
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!email || !password) return setError('Please fill all fields.')
        if (password.length < 6) return setError('Password must be at least 6 characters.')

        setLoading(true)
        setError('')
        try {
            if (mode === 'login') {
                await login(email, password)
            } else {
                await signup(email, password)
            }
            navigate('/dashboard')
        } catch (err) {
            const msgs = {
                'auth/user-not-found': 'No account found with this email.',
                'auth/wrong-password': 'Incorrect password.',
                'auth/email-already-in-use': 'An account already exists with this email.',
                'auth/invalid-email': 'Invalid email address.',
                'auth/invalid-credential': 'Invalid credentials. Use Demo Login for testing.',
            }
            setError(msgs[err.code] || err.message || 'Authentication failed.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-surface-50 to-primary-50
                    flex items-center justify-center px-4">
            <div className="w-full max-w-md animate-slide-up">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link to="/" className="inline-flex flex-col items-center gap-3">
                        <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center shadow-lg">
                            <Droplets size={28} className="text-white" />
                        </div>
                        <span className="text-2xl font-extrabold text-surface-900 tracking-tight">
                            AquaIQ
                        </span>
                    </Link>
                    <p className="text-surface-500 mt-2 text-sm">Smart Irrigation Scheduler</p>
                </div>

                {/* Card */}
                <div className="card shadow-xl">
                    {/* Tab switcher */}
                    <div className="flex bg-surface-100 rounded-xl p-1 mb-6">
                        {['login', 'signup'].map((m) => (
                            <button
                                key={m}
                                id={`auth-tab-${m}`}
                                onClick={() => { setMode(m); setError('') }}
                                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-150
                  ${mode === m
                                        ? 'bg-white text-surface-900 shadow-sm'
                                        : 'text-surface-500 hover:text-surface-700'
                                    }`}
                            >
                                {m === 'login' ? 'Sign In' : 'Create Account'}
                            </button>
                        ))}
                    </div>

                    <form id="auth-form" onSubmit={handleSubmit} className="space-y-4">
                        {/* Email */}
                        <div>
                            <label htmlFor="auth-email" className="label">Email address</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
                                <input
                                    id="auth-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="farmer@example.com"
                                    className="input-field pl-10"
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="auth-password" className="label">Password</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
                                <input
                                    id="auth-password"
                                    type={showPw ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="input-field pl-10 pr-10"
                                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(!showPw)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-400
                             hover:text-surface-600 transition-colors"
                                >
                                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200
                              rounded-xl px-4 py-3 text-sm text-red-700">
                                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            id="auth-submit-btn"
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full justify-center py-3 text-base"
                        >
                            {loading ? (
                                <><div className="spinner border-white/30 border-t-white w-5 h-5" />
                                    {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                                </>
                            ) : (
                                mode === 'login' ? 'Sign In' : 'Create Account'
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="relative my-5">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-surface-200" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-white px-3 text-xs text-surface-400 font-medium">
                                Hackathon Demo Mode
                            </span>
                        </div>
                    </div>

                    {/* Demo bypass */}
                    <button
                        id="demo-login-btn"
                        onClick={handleDemoLogin}
                        className="btn-secondary w-full justify-center py-3 text-sm"
                    >
                        🚀 Enter as Demo User (skip auth)
                    </button>

                    <p className="text-center text-xs text-surface-400 mt-4">
                        Demo mode uses the Flask backend with mock Firebase data.
                        <br />No credentials needed.
                    </p>
                </div>

                <p className="text-center mt-6">
                    <Link to="/" className="text-sm text-surface-500 hover:text-surface-700 transition-colors">
                        ← Back to home
                    </Link>
                </p>
            </div>
        </div>
    )
}
