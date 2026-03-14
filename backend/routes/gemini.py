"""
Gemini AI Routes
================
Handles Gemini API integration for agriculture-related Q&A.
Falls back to a demo response if no API key is configured.
"""

from flask import Blueprint, request, jsonify
import os
import json
import requests as http_requests

gemini_bp = Blueprint("gemini", __name__)

GEMINI_MODEL = "gemini-2.0-flash"

def _get_gemini_key():
    """Read API key at request time so .env changes are picked up on restart."""
    return os.getenv("GEMINI_API_KEY", "")

# System prompt that gives Gemini smart irrigation context
SYSTEM_PROMPT = """You are an expert agriculture advisor integrated into the AquaIQ Smart Irrigation platform.
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

If the user provides sensor data context (soil moisture, temperature, humidity), use it to give personalized recommendations.
"""


import random

def _get_demo_response(query, context=None):
    """Return a rich, dynamic demo response based on keywords and sensor context."""
    query_lower = query.lower()
    context = context or {}
    
    # Extract dynamic context with sensible defaults
    moisture = context.get('soilMoisture', 45)
    temp = context.get('temperature', 30)
    humidity = context.get('humidity', 60)
    
    # Default intro dynamically using sensor data
    intro = f"🌱 **Smart Farming Analysis**\n*Based on your current field data (Moisture: {moisture}%, Temp: {temp}°C, Humidity: {humidity}%), here is my advice:*\n\n"
    
    # Keyword detection with realistic dynamic responses
    if "rice" in query_lower or "paddy" in query_lower:
        return intro + f"🌾 **Rice/Paddy Cultivation in Maharashtra**\n\n1. **Planting Time:** The optimal time to plant Kharif rice is between June and July, perfectly timing with the onset of the monsoon.\n2. **Water Requirements:** Rice requires standing water (about 2-5cm) during the vegetative stage. With your current moisture at {moisture}%, you should prepare the field for pudding soon.\n3. **Varieties:** Given the local climate of {temp}°C, varieties like *Sahyadri* or *Ratnagiri* are highly recommended.\n\n💧 *Pro tip: Use the SRI (System of Rice Intensification) method to save up to 40% water while boosting yield.*"
        
    elif "wheat" in query_lower:
        return intro + f"🌾 **Wheat Farming Best Practices**\n\n1. **Sowing Time:** For maximum yield, sow wheat between early to mid-November when ambient temperatures drop to 20-22°C. Your current temp of {temp}°C is slightly warm for sowing right now.\n2. **Crucial Irrigation:** Provide water at crown root initiation (21 days), tillering, and heading stages.\n3. **Soil Conditions:** Wheat thrives in well-drained loams. The {moisture}% soil moisture is a good baseline, just ensure no waterlogging occurs.\n\n☀️ *Watch out for yellow rust disease during high-humidity periods.*"
        
    elif "tomato" in query_lower:
        return intro + f"🍅 **Tomato Yield Optimization**\n\n1. **Drip Irrigation:** Highly recommended! It saves water and prevents foliar diseases. Your field's 45% moisture is directly in the sweet spot for tomatoes.\n2. **Spacing & Staking:** Maintain 60x45cm spacing and use bamboo staking to prevent fruits from touching the wet ground.\n3. **Pest Control:** Fruit borers are common. Use Neem Seed Kernel Extract (NSKE 5%) spray every 15 days as a preventative measure.\n\n💧 *Tomatoes are very sensitive to waterlogging. Moderate but consistent moisture is key.*"
        
    elif "onion" in query_lower:
        return intro + f"🧅 **Onion Crop Management**\n\n1. **Irrigation Schedule:** Onions need light, frequent irrigation. However, you MUST stop all watering 15-20 days before harvesting to ensure the bulbs cure properly.\n2. **Nutrient Management:** Apply a split dose of Nitrogen. A basal dose of Phosphorus and Potash is essential for bulb sizing.\n3. **Disease Alert:** Thrips are a major threat at {temp}°C temperatures. Keep a close eye on the foliage and use yellow sticky traps.\n\n☀️ *Your current humidity of {humidity}% is normal, but high humidity can trigger purple blotch fungus.*"
        
    elif any(word in query_lower for word in ["disease", "pest", "insect", "fungus", "borer", "wilt", "yellow"]):
        return intro + f"🐛 **Crop Protection Guide**\n\n1. **Identification:** Yellowing leaves often indicate a nitrogen deficiency or fungal issue, while curling leaves usually point to viral attacks transmitted by aphids.\n2. **Immediate Action:** Remove any severely affected plants immediately to halt the spread within your field.\n3. **Organic Defense:** Spraying Neem oil (10,000 ppm) mixed with a mild soap solution is a great first-line defense before resorting to chemical pesticides.\n\n☀️ *Note: A temperature of {temp}°C combined with {humidity}% humidity can accelerate certain fungal life cycles. Monitor your crops carefully this week!*"
        
    elif any(word in query_lower for word in ["fertilizer", "npk", "urea", "dap", "organic", "compost"]):
        return intro + f"🧪 **Fertilizer & Soil Nutrition**\n\n1. **Balanced NPK:** Always apply fertilizers based on a recent soil test (costing around ₹50-₹100 at your local KVK).\n2. **Application Rules:** Apply during early morning or late evening. Crucially, **never** mix Urea directly with DAP.\n3. **Integration:** Combine chemical fertilizers with farmyard manure or vermicompost to significantly improve your soil's water-retention capacity.\n\n🌱 *Your soil is currently at {moisture}% moisture, which is perfect for applying fertilizers without causing root-burn.*"
        
    elif any(word in query_lower for word in ["irrigat", "water", "drip", "sprinkler", "moisture", "pump"]):
        return intro + f"💧 **Smart Water Management**\n\n1. **Timing:** Always water your crops between 6-8 AM. This simple change reduces evaporation loss by up to 30%.\n2. **Technology:** If possible, upgrade to drip irrigation for row crops — it saves 40-60% more water compared to traditional flood irrigation.\n3. **Mulching:** Adding a layer of organic mulch over your topsoil reduces your overall water requirement by 25-30%.\n\n🌱 *Your sensors show {moisture}% moisture. For most crops, maintaining between 40-60% is considered the optimal zone.*"
        
    else:
        # Generic personalized tip
        tips = [
            f"1. **Monitor Moisture:** Your field is currently at {moisture}% moisture. Try to keep this between 40-60% for most non-aquatic crops.\n2. **Smart Scheduling:** With current temperatures at {temp}°C, evaporation is quite high. Consider shifting to evening or early morning irrigation routines to save water.\n3. **Crop Rotation:** Rotate your crops each season to naturally combat pests and naturally replenish soil nutrients.\n4. **Drainage:** Always ensure your fields don't get waterlogged after heavy monsoon rains.",
            
            f"1. **Weather Planning:** The current {humidity}% humidity and {temp}°C temperature mean your plants are transpiring normally. Check the AquaIQ dashboard forecast before scheduling the next pump cycle.\n2. **Weed Control:** Remember that weeds compete with your crops for your valuable {moisture}% soil moisture. Manual weeding early on saves money later.\n3. **Observation:** Spend 10 minutes walking your field daily; early pest detection is your best cost-saving measure.",
            
            f"1. **Soil Health:** At {temp}°C, soil microbiology is highly active. Adding compost now will rapidly break down into usable nutrients.\n2. **Irrigation Efficiency:** Drip systems operate best with your current moisture level ({moisture}%). If you use flood irrigation, consider land leveling.\n3. **Record Keeping:** Track today's {humidity}% humidity against crop yield at the end of the season. Data helps you farm smarter!"
        ]
        return intro + random.choice(tips) + "\n\n💡 *Feel free to ask me about specific crops, diseases, or fertilizer schedules!*"


@gemini_bp.route("/gemini/ask", methods=["POST"])
def ask_gemini():
    """Send a question to Gemini AI and return the response."""
    data = request.json or {}
    query = data.get("query", "").strip()
    context = data.get("context", {})  # Optional: sensor data, crop type, etc.

    if not query:
        return jsonify({"error": "Please provide a question"}), 400

    # Build context-enriched prompt
    enriched_query = query
    if context:
        context_parts = []
        if context.get("cropType"):
            context_parts.append(f"Crop: {context['cropType']}")
        if context.get("soilMoisture") is not None:
            context_parts.append(f"Current soil moisture: {context['soilMoisture']}%")
        if context.get("temperature") is not None:
            context_parts.append(f"Temperature: {context['temperature']}°C")
        if context.get("humidity") is not None:
            context_parts.append(f"Humidity: {context['humidity']}%")
        if context_parts:
            enriched_query = f"[Sensor Data: {', '.join(context_parts)}]\n\n{query}"

    # Try real Gemini API if key is available
    api_key = _get_gemini_key()
    print(f"🔑 Gemini API key loaded: {'YES (' + api_key[:8] + '...)' if api_key else 'NO — using demo fallback'}")
    if api_key:
        models_to_try = [GEMINI_MODEL, "gemini-1.5-flash"]
        for model in models_to_try:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
                payload = {
                    "system_instruction": {
                        "parts": [{"text": SYSTEM_PROMPT}]
                    },
                    "contents": [
                        {
                            "parts": [{"text": enriched_query}]
                        }
                    ],
                    "generationConfig": {
                        "temperature": 0.7,
                        "maxOutputTokens": 1024,
                    }
                }

                import time
                for attempt in range(2):  # Try twice (retry once on 429)
                    resp = http_requests.post(url, json=payload, timeout=30)
                    print(f"📡 Gemini API ({model}) attempt {attempt+1}: status {resp.status_code}")
                    if resp.status_code == 429 and attempt == 0:
                        print("⏳ Rate limited — waiting 15s and retrying...")
                        time.sleep(15)
                        continue
                    break

                if resp.status_code != 200:
                    print(f"❌ Gemini API error ({model}): {resp.text[:300]}")
                    continue  # Try next model

                result = resp.json()

                # Extract text from Gemini response
                answer = (
                    result.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                )
                if answer:
                    return jsonify({
                        "answer": answer,
                        "source": "gemini",
                        "model": model,
                    })
            except Exception as e:
                print(f"⚠️  Gemini API error ({model}): {e}")
                continue  # Try next model

    # Demo fallback
    demo_answer = _get_demo_response(query, context)
    return jsonify({
        "answer": demo_answer,
        "source": "demo",
        "model": "demo-fallback",
    })
