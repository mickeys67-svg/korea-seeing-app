const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * AnalysisService
 * Performs "Active" deep analysis of weather/seeing data using Gemini AI.
 * Goes beyond simple scoring to provide human-like astronomical judgment.
 */
const AnalysisService = {
    apiKey: process.env.GEMINI_API_KEY || null,
    model: null,

    init() {
        if (this.apiKey) {
            try {
                const genAI = new GoogleGenerativeAI(this.apiKey);
                this.model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                console.log("[Analysis] AI Analysis Engine initialized (Gemini 1.5 Flash)");
            } catch (e) {
                console.error("[Analysis] Init failed:", e.message);
            }
        }
    },

    /**
     * Performs a deep analysis of a specific forecast point.
     */
    async getActiveInsight(data, targetLang = 'ko') {
        if (!this.model) return null;

        try {
            const prompt = `Analyze this astronomical seeing data and provide a professional, active observation guide.
            
            Data Summary:
            - Final Score: ${data.score}/100 (Grade ${data.grade})
            - Predicted Seeing: ${data.usp.seeing}"
            - Transparency (0-8): ${data.scores.transparency}
            - Cloud Cover (0-8): ${data.scores.cloudCover}
            - Jet Stream Speed: ${data.raw.jetStreamSpeed} knots
            - Humidity: ${data.rh2m}%
            - Ground Winds: ${data.wind10m.speed} m/s
            
            Instruction:
            1. Act as an expert astronomer.
            2. Mention best equipment (Planetary, Deep sky, or Gaze).
            3. Note the primary limiting factor.
            4. Keep it under 200 characters.
            5. Return ONLY the analysis text in ${targetLang === 'ko' ? 'natural Korean' : 'English'}.
            Do NOT use generic templates. Be specific to the numbers above.`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text().trim();
        } catch (error) {
            console.error("[Analysis] Engine error:", error.message);
            return null;
        }
    }
};

AnalysisService.init();

module.exports = AnalysisService;
