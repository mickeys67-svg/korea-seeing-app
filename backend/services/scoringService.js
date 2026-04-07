const ScoringService = {
    // === SCORING HELPERS (0 = Best, 8 = Worst) ===

    // Jet Stream Score: Based on 250hPa Wind Speed (knots)
    // Using simplified "overhead" approach since we don't have distance map yet.
    calculateJetStreamScore: (speedMs) => {
        if (speedMs == null) return 4; // Unknown = neutral (CLAUDE.md spec: null=4)
        const speedKt = speedMs * 1.94384; // m/s to knots

        // Thresholds: CLAUDE.md spec <60/100/130/160kt
        if (speedKt < 60) return 0;
        if (speedKt < 100) return 2;
        if (speedKt < 130) return 4;
        if (speedKt < 160) return 6;
        return 8;
    },

    // Convection Score: Based on CAPE and Time of Day
    calculateConvectionScore: (cape, hour) => {
        if (cape == null) return 2; // Unknown = mild instability (neutral, not falsely stable)

        let baseScore = 0;
        if (cape < 100) baseScore = 0;
        else if (cape < 500) baseScore = 2;
        else if (cape < 1000) baseScore = 4;
        else if (cape < 2000) baseScore = 6;
        else baseScore = 8;

        // Time factor
        let timeFactor = 1.0;
        if (hour >= 20 && hour <= 23) timeFactor = 0.7; // Stabilization
        else if (hour >= 12 && hour <= 18) timeFactor = 1.3; // Active

        return Math.min(8, Math.round(baseScore * timeFactor * 10) / 10);
    },

    // Cloud Normalization: 0-100% -> 0-8 scale (clamped)
    normalizeCloud: (percent) => {
        if (typeof percent !== 'number' || isNaN(percent)) return null;
        return Math.min(8, Math.max(0, Math.round((percent * 8) / 100)));
    },

    // Final Observation Score (0-100, Higher is Better)
    //
    // 1→2→3 Probability Model:
    //   1. Cloud check — what fraction of sky is open?
    //   2. Atmospheric quality — how good is the air? (only when sky is open)
    //   3. Final score = atmospheric_quality × cloud_probability
    //
    // ═══ v4.0: 국제 기준 통합 모델 ═══
    // Cloud = sky AVAILABILITY (하늘이 열려있는 확률)
    // Seeing/Transparency/Wind/Convection = atmospheric QUALITY (대기 품질)
    // Final = quality × availability (Meteoblue/Astrospheric 방식)
    //
    calculateObservationScore: (params, lang = 'en') => {
        // ═══ v4.0: 국제 기준 통합 가중치 ═══
        // 제트스트림: USP seeing에 이미 포함 (Cn² → r₀에 반영) → 별도 가중치 제거
        // Meteoblue/Astrospheric 기준: seeing과 jet은 하나의 turbulence 지표
        const WEIGHTS = {
            seeing: 0.45,        // 시잉 (제트 효과 포함)
            transparency: 0.25,  // 투명도 (습도+에어로졸+미세먼지)
            wind: 0.15,          // 지상풍
            convection: 0.15     // 대류 불안정
        };

        const _safe = (v, fallback) => (typeof v === 'number' && !isNaN(v)) ? v : fallback;
        const seeingScore = _safe(params.seeing, 4);       // NaN/missing → neutral
        const transparencyScore = _safe(params.transparency, 4);
        const cloudScore = _safe(params.cloud, 4);          // 4 = 반 흐림 (중립)
        const windScore = _safe(params.wind, 3);
        const convectionScore = _safe(params.convection, 2);

        // ═══ v4.0: sigmoid k=0.7 (완화) ═══
        // k=1.0은 구름 4→6에서 0.55→0.14로 급락 → 점수 편차 과대
        // k=0.7: 구름 0→0.95, 2→0.85, 4→0.55, 6→0.22, 8→0.06
        // 국제 기준: 구름 50%에서도 간헐적 관측 가능 → 부드러운 전환
        let cloudMultiplier = 1.0 / (1.0 + Math.exp(0.7 * (cloudScore - 4.2)));

        // Cirrus bonus: if cloud is predominantly high (>70%) with clear low layers
        // Max +0.10 — thin cirrus allows astronomical observation (ESO "thin cirrus" category)
        if (params.cloudLayers) {
            const { low, mid, high } = params.cloudLayers;
            if (low != null && mid != null && high != null) {
                const total = Math.max(1, low + mid + high);
                const highFrac = high / total;
                if (highFrac > 0.7 && low < 20) {
                    const bonus = 0.10 * Math.min(1.0, (highFrac - 0.7) / 0.3);
                    cloudMultiplier = Math.min(1.0, cloudMultiplier + bonus);
                }
            }
        }

        // Step 2: Atmospheric quality (cloud excluded)
        const weightedBadness =
            seeingScore * WEIGHTS.seeing +
            transparencyScore * WEIGHTS.transparency +
            windScore * WEIGHTS.wind +
            convectionScore * WEIGHTS.convection;

        const atmosphericQuality = (1 - weightedBadness / 8) * 100;

        // Step 3: Final = quality × cloud probability
        let finalScore = atmosphericQuality * cloudMultiplier;

        // v3.1: Dew point spread penalty — condensation/fog warning (Tier 1)
        // T - Tdew < 3°C → optics fogging risk, direct score reduction
        if (params.dewPointSpread != null && params.dewPointSpread < 3) {
            const dewPenalty = params.dewPointSpread < 2 ? 0.85 : 0.92;
            finalScore *= dewPenalty;
        }

        // v3.1: Bortle light pollution cap (Tier 3)
        // Deep-sky limited in high Bortle zones; planets/moon unaffected
        if (params.bortle != null) {
            if (params.bortle >= 8) finalScore = Math.min(finalScore, 72);
            else if (params.bortle >= 7) finalScore = Math.min(finalScore, 78);
            else if (params.bortle >= 6) finalScore = Math.min(finalScore, 84);
            // Bortle 5 and below: no cap
        }

        // Hard gate: cloud ≥7 → cap to 10 (sky essentially blocked)
        if (cloudScore >= 7) {
            finalScore = Math.min(finalScore, 10);
        }

        // Ensure result is a valid number and clamped
        if (isNaN(finalScore)) finalScore = 0;
        const roundedScore = Math.max(0, Math.min(100, Math.round(finalScore * 10) / 10));

        return {
            score: roundedScore,
            grade: ScoringService.getGrade(roundedScore),
            recommendation: ScoringService.getRecommendation(roundedScore, cloudScore, lang)
        };
    },

    getGrade: (score) => {
        if (score >= 85) return 'S';
        if (score >= 70) return 'A';
        if (score >= 55) return 'B';
        if (score >= 40) return 'C';
        return 'D';
    },

    getRecommendation: (score, cloudScore, lang = 'en') => {
        const msgs = {
            // ── Cloud gates (override score-based) ──
            cloudBlocked: {
                ko: '관측 불가. 구름이 하늘을 완전히 덮고 있어 망원경 설치를 권장하지 않습니다. 실내에서 장비 정비나 관측 계획 수립에 활용하세요.',
                ja: '観測不可。厚い雲で空が完全に覆われています。望遠鏡の設置は推奨しません。機材メンテナンスや観測計画の時間にどうぞ。',
                zh: '无法观测。厚云完全遮蔽天空，不建议架设望远镜。建议利用时间维护设备或制定观测计划。',
                en: 'Sky fully overcast — do not set up a telescope. Use this time for equipment maintenance or planning future sessions.'
            },
            cloudAndAtmoBad: {
                ko: '관측이 매우 어렵습니다. 구름이 많고 대기도 불안정합니다. 구름 사이로 보이더라도 상이 심하게 일렁여 의미 있는 관측이 불가능합니다.',
                ja: '観測は非常に困難。雲が多く大気も不安定です。雲の隙間が見えても像が激しく揺れ、意味のある観測はできません。',
                zh: '观测非常困难。云量大且大气不稳定。即使云隙露出也会因气流剧烈抖动而无法获得有效观测。',
                en: 'Very difficult conditions — heavy cloud cover with unstable atmosphere. Even brief clear gaps will show badly distorted images.'
            },
            cloudPartial: {
                ko: '구름 사이로 간헐적 관측 가능. 맑은 틈이 보일 때 달이나 밝은 행성을 빠르게 확인할 수 있습니다. 장노출 촬영은 피하세요.',
                ja: '雲の隙間から断続的に観測可能。晴れ間が見えたら月や明るい惑星を素早く確認できます。長時間露光は避けてください。',
                zh: '可通过云隙间歇性观测。出现晴空时可快速观测月球或明亮行星。避免长时间曝光拍摄。',
                en: 'Intermittent observing through cloud gaps. Quick views of the Moon or bright planets when holes appear. Avoid long-exposure imaging.'
            },
            // ── Score-based tiers (clear/partly-clear sky) ──
            S: {
                ko: '최상의 관측 조건! 행성 표면 세부 구조(목성 대적반, 토성 카시니 간극), 이중성 분리, 딥스카이 대상까지 고배율(200배 이상) 관측에 최적입니다. 촬영에도 탁월한 밤입니다.',
                ja: '最高の観測条件！惑星の表面構造（木星の大赤斑、土星のカッシーニの間隙）、二重星の分離、ディープスカイ対象まで高倍率（200倍以上）で観測に最適です。撮影にも素晴らしい夜です。',
                zh: '最佳观测条件！行星表面细节（木星大红斑、土星卡西尼环缝）、双星分离、深空目标均可用高倍率（200倍以上）观测。也是天文摄影的绝佳夜晚。',
                en: 'Superb conditions! Planetary detail (Jupiter\'s GRS, Saturn\'s Cassini Division), tight double stars, and deep-sky targets all excellent at high power (200×+). Outstanding night for imaging too.'
            },
            A: {
                ko: '매우 좋은 조건. 달 크레이터 세부, 행성 대기 띠 관측에 적합합니다. 밝은 성운·성단(M42, M31)도 선명합니다. 150~200배까지 안정적으로 사용할 수 있습니다.',
                ja: '非常に良い条件。月のクレーター詳細、惑星の大気帯の観測に適しています。明るい星雲・星団（M42、M31）もはっきり見えます。150〜200倍まで安定して使用可能です。',
                zh: '非常好的条件。适合观测月球环形山细节和行星大气带。明亮星云星团（M42、M31）也很清晰。可稳定使用150~200倍放大。',
                en: 'Very good conditions. Lunar craters and planetary cloud bands show well. Bright nebulae and clusters (M42, M31) are clear. Stable up to 150–200× magnification.'
            },
            B: {
                ko: '보통 조건. 달, 목성, 토성 등 밝은 대상은 충분히 즐길 수 있습니다. 고배율보다 중배율(100~150배)을 추천합니다. 밝은 딥스카이는 관측 가능하지만 미세 디테일은 제한적입니다.',
                ja: '平均的な条件。月、木星、土星など明るい天体は十分楽しめます。高倍率より中倍率（100〜150倍）がおすすめです。明るいディープスカイは観測可能ですが、微細なディテールは制限的です。',
                zh: '一般条件。月球、木星、土星等明亮目标可充分观赏。建议使用中等倍率（100~150倍）而非高倍率。明亮深空天体可观测但细节有限。',
                en: 'Average conditions. Moon, Jupiter, and Saturn are enjoyable. Use moderate power (100–150×) rather than high. Bright deep-sky objects visible but fine detail is limited.'
            },
            C: {
                ko: '불안정한 대기. 달과 밝은 행성만 저배율(50~100배)로 관측하세요. 상이 일렁이므로 촬영보다 안시 관측 위주로 하시고, 순간적으로 안정될 때를 포착하세요.',
                ja: '不安定な大気。月と明るい惑星のみ低倍率（50〜100倍）で観測してください。像が揺れるため撮影より眼視観測を中心に、瞬間的に安定する瞬間を捉えてください。',
                zh: '大气不稳定。仅建议用低倍率（50~100倍）观测月球和明亮行星。星像会抖动，以目视观测为主而非拍摄，把握瞬间稳定的时刻。',
                en: 'Unstable air. Stick to the Moon and bright planets at low power (50–100×). Images will shimmer — focus on visual observing and catch brief moments of steadiness.'
            },
            D: {
                ko: '관측이 어려운 조건입니다. 망원경 고배율은 상이 심하게 흔들립니다. 쌍안경으로 밝은 별이나 별자리를 감상하거나, 맨눈으로 은하수가 보이는지 확인해보세요.',
                ja: '観測が困難な条件です。望遠鏡の高倍率では像が大きく乱れます。双眼鏡で明るい星や星座を楽しむか、肉眼で天の川が見えるか確認してみてください。',
                zh: '观测困难的条件。望远镜高倍率下星像严重抖动。建议用双筒望远镜欣赏明亮星星和星座，或用肉眼确认银河可见度。',
                en: 'Difficult conditions. Telescope views will be heavily distorted at any power. Try binoculars for bright stars and constellations, or simply enjoy a naked-eye sky survey.'
            }
        };

        const L = lang === 'ko' ? 'ko' : lang === 'ja' ? 'ja' : lang === 'zh' ? 'zh' : 'en';

        // Cloud gate — sky blocked overrides score-based recommendation
        if (cloudScore >= 7) return msgs.cloudBlocked[L];
        if (cloudScore >= 5 && score < 20) return msgs.cloudAndAtmoBad[L];
        if (cloudScore >= 5) return msgs.cloudPartial[L];

        // Score-based tiers (clear or mostly-clear sky)
        if (score >= 85) return msgs.S[L];
        if (score >= 70) return msgs.A[L];
        if (score >= 55) return msgs.B[L];
        if (score >= 40) return msgs.C[L];
        return msgs.D[L];
    }
};

module.exports = ScoringService;
