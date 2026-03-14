import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'

const DEMO_KEY = 'aquaiq_demo_mode'

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth()

    // Safety net: if demo flag is in localStorage but state hasn't flushed yet, allow access
    const isDemoSession = localStorage.getItem(DEMO_KEY) === 'true'

    if (loading && !isDemoSession) return (
        <div className="min-h-screen flex items-center justify-center bg-surface-50">
            <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mb-2">
                    <span className="text-2xl">💧</span>
                </div>
                <div className="spinner w-8 h-8 border-[3px] text-primary-600" />
                <p className="text-surface-500 text-sm font-medium">Loading AquaIQ…</p>
            </div>
        </div>
    )

    const isAuthorised = !!user || isDemoSession
    return isAuthorised ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
    const { user, loading } = useAuth()
    const isDemoSession = localStorage.getItem(DEMO_KEY) === 'true'
    if (loading && !isDemoSession) return null
    const isAuthorised = !!user || isDemoSession
    return !isAuthorised ? children : <Navigate to="/dashboard" replace />
}

export default function App() {
    return (
        <AuthProvider>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                <Route
                    path="/dashboard"
                    element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </AuthProvider>
    )
}
