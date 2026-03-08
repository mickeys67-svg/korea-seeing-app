/**
 * TranslationService
 * Note: Recommendations are now pre-translated by ScoringService (ko/ja/zh/en).
 * This service is kept as a passthrough for backward compatibility with
 * weatherController.translateForecastBatch() calls.
 * No external API needed.
 */
const TranslationService = {
    init() {
        console.log("[Translation] Passthrough mode (recommendations pre-translated by ScoringService)");
    },

    /**
     * Translates a single recommendation string.
     * Since ScoringService now returns pre-translated text in the target language,
     * this simply returns the text as-is (no-op passthrough).
     */
    translateRecommendation(text, _targetLang = 'ko') {
        return text || '';
    },

    /**
     * Bulk translates an array of forecast items.
     * No-op: recommendations arrive pre-translated from ScoringService.
     */
    translateForecastBatch(items, _targetLang = 'ko') {
        return items || [];
    }
};

TranslationService.init();

module.exports = TranslationService;
