/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            colors: {
                primary: {
                    50: '#edfcf4',
                    100: '#d3f8e4',
                    200: '#aaf0cc',
                    300: '#73e3ac',
                    400: '#3acf87',
                    500: '#16b36a',
                    600: '#0d9257',
                    700: '#0c7548',
                    800: '#0d5c3b',
                    900: '#0c4c32',
                    950: '#052a1c',
                },
                emerald: {
                    400: '#34d399',
                    500: '#10b981',
                    600: '#059669',
                },
                surface: {
                    50: '#f8fafc',
                    100: '#f1f5f9',
                    200: '#e2e8f0',
                    300: '#cbd5e1',
                    400: '#94a3b8',
                    500: '#64748b',
                    600: '#475569',
                    700: '#334155',
                    800: '#1e293b',
                    900: '#0f172a',
                    950: '#020617',
                },
                status: {
                    online: '#22c55e',
                    offline: '#ef4444',
                    warning: '#f59e0b',
                    lora: '#8b5cf6',
                }
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'fade-in': 'fadeIn 0.5s ease-in-out',
                'slide-up': 'slideUp 0.4s ease-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(16px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
            boxShadow: {
                'card': '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.06)',
                'card-hover': '0 4px 12px 0 rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.04)',
                'glow-green': '0 0 0 3px rgba(16,185,129,0.15)',
            },
        },
    },
    plugins: [],
}
