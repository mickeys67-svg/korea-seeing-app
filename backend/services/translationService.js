/**
 * TranslationService
 * Handles translation for astronomical recommendations using static translation maps.
 * No external API needed - all recommendation strings are predefined.
 */
const TranslationService = {
    // Static translation maps for each supported language
    translations: {
        ko: {
            'Steady skies! Excellent conditions, great for all targets.':
                '안정적인 하늘! 모든 관측 대상에 탁월한 조건입니다.',
            'Stable air and very good conditions. Suitable for most observations.':
                '안정된 대기와 매우 좋은 조건. 대부분의 관측에 적합합니다.',
            'Average conditions. Stable enough for bright solar system targets.':
                '보통 조건. 밝은 태양계 대상 관측은 가능합니다.',
            'Poor conditions. Unstable air limiting casual observation.':
                '불량한 조건. 불안정한 대기로 일반 관측이 제한됩니다.',
            'Atmosphere is too unstable for observation.':
                '대기가 너무 불안정하여 관측이 어렵습니다.'
        },
        ja: {
            'Steady skies! Excellent conditions, great for all targets.':
                '安定した空！全ての観測対象に最適な条件です。',
            'Stable air and very good conditions. Suitable for most observations.':
                '安定した大気と非常に良い条件。ほとんどの観測に適しています。',
            'Average conditions. Stable enough for bright solar system targets.':
                '平均的な条件。明るい太陽系天体の観測は可能です。',
            'Poor conditions. Unstable air limiting casual observation.':
                '不良な条件。不安定な大気により一般観測が制限されます。',
            'Atmosphere is too unstable for observation.':
                '大気が不安定すぎて観測が困難です。'
        }
    },

    init() {
        console.log("[Translation] Static translation engine initialized (no API key needed)");
    },

    /**
     * Translates a single recommendation string using static map.
     */
    translateRecommendation(text, targetLang = 'ko') {
        if (!text) return text;
        if (targetLang.toLowerCase().startsWith('en')) return text;

        const langMap = this.translations[targetLang];
        if (langMap && langMap[text]) {
            return langMap[text];
        }

        // Fallback: return original text if no translation found
        return text;
    },

    /**
     * Bulk translates an array of forecast items.
     */
    translateForecastBatch(items, targetLang = 'ko') {
        if (!items || items.length === 0) return items;
        if (targetLang.toLowerCase().startsWith('en')) return items;

        return items.map(item => ({
            ...item,
            recommendation: this.translateRecommendation(item.recommendation, targetLang)
        }));
    }
};

TranslationService.init();

module.exports = TranslationService;
