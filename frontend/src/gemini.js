/**
 * Gemini AI Service — Direct client-side integration
 * Uses @google/generative-ai SDK to call the Gemini API directly.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''

const SYSTEM_PROMPT = `You are an expert agriculture advisor integrated into the AquaIQ Smart Irrigation platform.
You help farmers with questions about:
- Irrigation timing and water management
- Crop diseases and pest control
- Fertilizer usage and soil nutrition
- Soil moisture monitoring and sensor data interpretation
- Weather-based irrigation decisions
- Crop-specific growing advice

Guidelines:
- Give practical, actionable advice that farmers can use immediately
- Use simple language — avoid overly technical jargon
- Consider Indian farming conditions (monsoon seasons, common crops like rice, wheat, cotton, tomato, brinjal)
- When applicable, mention cost-effective solutions
- Include specific numbers (quantities, timing, spacing) when possible
- Consider soil moisture data and weather patterns in your recommendations
- Keep responses concise but comprehensive (3-5 key points)
- Use bullet points and bold text for readability
- Add relevant emoji for visual clarity (🌱 💧 🌾 ☀️ 🐛)

If the user provides sensor data context (soil moisture, temperature, humidity), use it to give personalized recommendations.`

let genAI = null
let model = null

function getModel() {
    if (!model && API_KEY) {
        genAI = new GoogleGenerativeAI(API_KEY)
        model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: SYSTEM_PROMPT,
        })
    }
    return model
}

/**
 * Ask Gemini a question with optional sensor context.
 * @param {string} query - The farmer's question
 * @param {object} context - Optional sensor data { soilMoisture, temperature, humidity, cropType }
 * @returns {Promise<{ answer: string, source: string, model: string }>}
 */
export async function askGeminiDirect(query, context = {}) {
    const geminiModel = getModel()

    if (!geminiModel) {
        throw new Error('Gemini API key not configured')
    }

    // Build context-enriched prompt
    let enrichedQuery = query
    const contextParts = []
    if (context.cropType) contextParts.push(`Crop: ${context.cropType}`)
    if (context.soilMoisture != null) contextParts.push(`Current soil moisture: ${context.soilMoisture}%`)
    if (context.temperature != null) contextParts.push(`Temperature: ${context.temperature}°C`)
    if (context.humidity != null) contextParts.push(`Humidity: ${context.humidity}%`)
    if (contextParts.length > 0) {
        enrichedQuery = `[Sensor Data: ${contextParts.join(', ')}]\n\n${query}`
    }

    const result = await geminiModel.generateContent(enrichedQuery)
    const response = result.response
    const answer = response.text()

    return {
        answer,
        source: 'gemini',
        model: 'gemini-2.0-flash',
    }
}

/** Check if the Gemini API key is configured */
export function isGeminiConfigured() {
    return !!API_KEY
}
