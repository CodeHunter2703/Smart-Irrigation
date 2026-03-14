/**
 * API service layer — all Flask backend calls go through here.
 * Base URL is read from VITE_API_BASE_URL env var (default: /api via Vite proxy)
 */

const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

async function request(method, path, body) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
    }
    if (body) opts.body = JSON.stringify(body)

    const res = await fetch(`${BASE}${path}`, opts)
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error || `HTTP ${res.status}`)
    }
    return res.json()
}

const get = (path) => request('GET', path)
const post = (path, body) => request('POST', path, body)

// ── Health ──────────────────────────────────────────────────────
export const getHealth = () => get('/health')

// ── Sensor ──────────────────────────────────────────────────────
export const getLatestSensor = (deviceId = 'field-001') =>
    get(`/latest?deviceId=${deviceId}`)

export const getSensorHistory = (deviceId = 'field-001', limit = 50) =>
    get(`/history?deviceId=${deviceId}&limit=${limit}`)

export const postSensorData = (data) => post('/sensor-data', data)

// ── Pump ────────────────────────────────────────────────────────
export const pumpOn = (deviceId = 'field-001', reason) =>
    post('/pump/on', { deviceId, reason })

export const pumpOff = (deviceId = 'field-001', reason) =>
    post('/pump/off', { deviceId, reason })

export const valveOpen = (deviceId = 'field-001') =>
    post('/valve/open', { deviceId })

export const valveClose = (deviceId = 'field-001') =>
    post('/valve/close', { deviceId })

export const modeAutomatic = (deviceId = 'field-001') =>
    post('/mode/automatic', { deviceId })

export const modeManual = (deviceId = 'field-001') =>
    post('/mode/manual', { deviceId })

export const startManualIrrigation = (deviceId = 'field-001', minutes = 10) =>
    post('/irrigation/start', { deviceId, minutes })

// ── Decision ────────────────────────────────────────────────────
export const runDecision = (deviceId = 'field-001') =>
    post('/run-decision', { deviceId })

// ── Logs ────────────────────────────────────────────────────────
export const getLogs = (deviceId = 'field-001', limit = 50) =>
    get(`/logs?deviceId=${deviceId}&limit=${limit}`)

// ── Settings ────────────────────────────────────────────────────
export const getSettings = (deviceId = 'field-001') =>
    get(`/settings?deviceId=${deviceId}`)

export const updateSettings = (settings) => post('/settings', settings)

// ── ML ──────────────────────────────────────────────────────────
export const getMLPrediction = (deviceId = 'field-001') =>
    get(`/ml/predict-schedule?deviceId=${deviceId}`)

// ── Weather ─────────────────────────────────────────────────
export const getWeather = (city = 'Mumbai') =>
    get(`/weather?city=${city}`)

// ── Community ───────────────────────────────────────────────
export const getCommunityPosts = () => get('/community/posts')

export const createCommunityPost = (postData) => post('/community/posts', postData)

export const upvotePost = (postId, userId) =>
    post(`/community/posts/${postId}/upvote`, { userId })

export const getComments = (postId) =>
    get(`/community/posts/${postId}/comments`)

export const addComment = (postId, comment) =>
    post(`/community/posts/${postId}/comments`, comment)

// ── Gemini AI ───────────────────────────────────────────────
export const askGemini = (query, context = {}) =>
    post('/gemini/ask', { query, context })
