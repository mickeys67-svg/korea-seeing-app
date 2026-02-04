const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * TranslationService
 * Handles natural language translation for astronomical recommendations using Gemini AI.
 */
const TranslationService = {
    apiKey: process.env.GEMINI_API_KEY || null,
    model: null,

    init() {
        if (this.apiKey) {
            try {
                const genAI = new GoogleGenerativeAI(this.apiKey);
                // Using "gemini-pro" as it's the most stable/supported identifier across SDK versions
                this.model = genAI.getGenerativeModel({ model: "gemini-pro" });
                console.log(`[Translation] AI Model Initialized: gemini-pro (Key: ${this.apiKey.substring(0, 8)}...)`);
            } catch (e) {
                console.error("[Translation] Init failed:", e.message);
            }
        } else {
            console.warn("[Translation] No GEMINI_API_KEY found. Falling back to original labels.");
        }
    },

    /**
     * Translates a single recommendation string into the target language.
     */
    async translateRecommendation(text, targetLang = 'ko') {
        if (!this.model || !text) return text;
        if (targetLang.toLowerCase().startsWith('en')) return text;

        try {
            const prompt = `Translate this to natural ${targetLang}: "${text}". Context: astronomy observation quality description. Return ONLY the translated text.`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const translatedText = response.text().trim();

            console.log(`[Translation] SUCCESS: ${text} -> ${translatedText}`);
            return translatedText || text;
        } catch (error) {
            console.error("[Translation] AI Error:", error.message);

            // Attempt dynamic model fallback if gemini-pro fails with specific 404
            if (error.message.includes("not found") && this.model.model === "gemini-pro") {
                console.log("[Translation] Trying fallback to gemini-1.5-pro-latest");
                try {
                    const genAI = new GoogleGenerativeAI(this.apiKey);
                    this.model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
                    return this.translateRecommendation(text, targetLang);
                } catch (e) { }
            }

            return text;
        }
    },

    /**
     * Bulk translates an array of forecast items.
     */
    async translateForecastBatch(items, targetLang = 'ko') {
        if (!this.model || !items || items.length === 0) return items;
        if (targetLang.toLowerCase().startsWith('en')) return items;

        const uniqueRecs = [...new Set(items.map(i => i.recommendation))];
        const translationMap = {};

        try {
            await Promise.all(uniqueRecs.map(async (rec) => {
                translationMap[rec] = await this.translateRecommendation(rec, targetLang);
            }));

            return items.map(item => ({
                ...item,
                recommendation: translationMap[item.recommendation] || item.recommendation
            }));
        } catch (e) {
            console.error("[Translation] Batch failed:", e.message);
            return items;
        }
    }
};

TranslationService.init();

module.exports = TranslationService;
