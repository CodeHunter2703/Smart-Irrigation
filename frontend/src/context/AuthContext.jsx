import { createContext, useContext, useEffect, useState } from 'react'
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
} from 'firebase/auth'
import { auth } from '../firebase'

const AuthContext = createContext(null)

// Synthetic demo user — used when Firebase isn't configured
const DEMO_USER = {
    uid: 'demo-user-001',
    email: 'demo@aquaiq.app',
    displayName: 'Demo Farmer',
    isDemo: true,
}

const DEMO_KEY = 'aquaiq_demo_mode'

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // If a previous demo session exists, restore it immediately
        if (localStorage.getItem(DEMO_KEY) === 'true') {
            setUser(DEMO_USER)
            setLoading(false)
            return
        }

        // Otherwise try real Firebase auth
        let settled = false
        const unsub = onAuthStateChanged(
            auth,
            (u) => {
                // Only apply if not in demo mode
                if (localStorage.getItem(DEMO_KEY) !== 'true') {
                    setUser(u)
                }
                if (!settled) { settled = true; setLoading(false) }
            },
            (_err) => {
                // Firebase misconfigured (demo placeholder keys) — just proceed as logged-out
                if (!settled) { settled = true; setLoading(false) }
            }
        )

        // Safety net: if Firebase never calls back within 3 s (no internet, wrong config), unblock UI
        const timer = setTimeout(() => {
            if (!settled) { settled = true; setLoading(false) }
        }, 3000)

        return () => { unsub(); clearTimeout(timer) }
    }, [])

    /** Skip Firebase — set a demo session in localStorage */
    const demoLogin = () => {
        localStorage.setItem(DEMO_KEY, 'true')
        setUser(DEMO_USER)
    }

    const login = (email, password) => signInWithEmailAndPassword(auth, email, password)
    const signup = (email, password) => createUserWithEmailAndPassword(auth, email, password)

    const logout = async () => {
        localStorage.removeItem(DEMO_KEY)
        setUser(null)
        try { await signOut(auth) } catch { }
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout, demoLogin }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
