/**
 * AnalysisService — Warp AI Rule-based Engine v2.0
 * Advanced astronomical observation analysis using pure computation.
 * Features: 24h trend analysis, multi-factor insights, optimal window detection.
 * Cost: $0 | Latency: 0ms | Dependencies: none
 */
const AnalysisService = {
    init() {
        console.log("[Analysis] Rule-based analysis engine initialized (no API key needed)");
    },

    /**
     * All limiting factors sorted by severity (returns array, not just top 1).
     */
    _getLimitingFactors(data) {
        const factors = [];
        const scores = data.scores || {};
        const raw = data.raw || {};

        if ((scores.cloudCover ?? 0) >= 5) factors.push({ key: 'cloud', severity: scores.cloudCover, ko: '구름', en: 'cloud cover' });
        if ((scores.jetStream ?? 0) >= 5) factors.push({ key: 'jet', severity: scores.jetStream, ko: '제트기류', en: 'jet stream' });
        if ((scores.seeing ?? 0) >= 4) factors.push({ key: 'seeing', severity: scores.seeing, ko: '시잉 불안정', en: 'poor seeing' });
        if ((scores.transparency ?? 0) >= 5) factors.push({ key: 'transparency', severity: scores.transparency, ko: '투명도 저하', en: 'low transparency' });
        if ((scores.wind ?? 0) >= 4) factors.push({ key: 'wind', severity: scores.wind, ko: '강풍', en: 'strong winds' });
        if ((data.rh2m ?? 0) >= 85) factors.push({ key: 'humidity', severity: 7, ko: '높은 습도', en: 'high humidity' });
        if ((raw.jetStreamSpeed ?? 0) >= 120) factors.push({ key: 'jetSpeed', severity: 8, ko: '극심한 제트기류', en: 'extreme jet stream' });
        if ((scores.convection ?? 0) >= 5) factors.push({ key: 'convection', severity: scores.convection, ko: '대류 불안정', en: 'convective instability' });

        factors.sort((a, b) => b.severity - a.severity);
        return factors;
    },

    /**
     * Equipment/target recommendation based on seeing + score + cloud.
     * Cloud-aware: blocks deep-sky/imaging recommendations when clouds are heavy.
     */
    _getEquipment(data) {
        const seeing = data.usp?.seeing ?? 2.0;
        const score = data.score ?? 50;
        const cloudScore = data.scores?.cloudCover ?? 0;

        // ═══ Layer 1: 구름 → 별이 보이는가? ═══
        if (cloudScore >= 7) return { ko: '관측 불가. 구름이 하늘을 가림', en: 'observation blocked by cloud cover' };
        if (cloudScore >= 5) return { ko: '구름 사이로 간헐적 관측만 가능', en: 'intermittent observation only through cloud gaps' };

        // ═══ Layer 2: 하늘 열림 → Seeing + Score 장비 추천 ═══
        if (seeing < 1.0 && score >= 85) return { ko: '고해상도 행성·딥스카이 촬영에 이상적', en: 'ideal for high-res planetary & deep-sky imaging' };
        if (seeing < 1.2 && score >= 70) return { ko: '고배율 행성 관측·촬영에 최적', en: 'excellent for high-mag planetary imaging' };
        if (seeing < 1.5 && score >= 55) return { ko: '행성 촬영 가능. 일반 관측 적합', en: 'suitable for planetary imaging' };
        if (seeing < 2.0 && score >= 45) return { ko: '광시야 촬영 가능. 저배율 관측 적합', en: 'wide-field imaging possible' };
        if (score >= 35) return { ko: '안시 관측 가능. 저배율 위주', en: 'visual observation only' };
        return { ko: '관측 비추천. 대기 불량', en: 'observation not recommended' };
    },

    /**
     * Format hour as Korean-friendly time string.
     */
    _formatHourKo(date) {
        const h = date.getHours();
        if (h === 0) return '자정';
        if (h < 6) return `새벽 ${h}시`;
        if (h < 12) return `오전 ${h}시`;
        if (h === 12) return '정오';
        if (h < 18) return `오후 ${h - 12}시`;
        if (h < 21) return `저녁 ${h - 12}시`;
        return `밤 ${h - 12}시`;
    },

    _formatHourEn(date) {
        const h = date.getHours();
        const suffix = h >= 12 ? 'PM' : 'AM';
        const h12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
        return `${h12}${suffix}`;
    },

    /**
     * Analyze 24h forecast trend — find optimal window & detect improvements.
     */
    _analyzeTrend(currentData, forecastList) {
        if (!forecastList || forecastList.length < 2) return null;

        const now = new Date(currentData.time);
        const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // Filter to 24h window
        const upcoming = forecastList.filter(f => {
            const t = new Date(f.time);
            return t >= now && t <= cutoff;
        });

        if (upcoming.length < 2) return null;

        // Find best block in 24h
        let bestBlock = upcoming[0];
        for (const block of upcoming) {
            if (block.score > bestBlock.score) bestBlock = block;
        }

        // Find worst block in 24h
        let worstBlock = upcoming[0];
        for (const block of upcoming) {
            if (block.score < worstBlock.score) worstBlock = block;
        }

        // Current block index
        const currentIdx = upcoming.findIndex(f => f.time === currentData.time);

        // Next block (3h later)
        const nextBlock = currentIdx >= 0 && currentIdx + 1 < upcoming.length
            ? upcoming[currentIdx + 1] : null;

        // Detect improving or worsening trend (current → next 2 blocks)
        let trend = 'stable';
        if (currentIdx >= 0) {
            const futureBlocks = upcoming.slice(currentIdx + 1, currentIdx + 3);
            if (futureBlocks.length > 0) {
                const avgFutureScore = futureBlocks.reduce((s, b) => s + b.score, 0) / futureBlocks.length;
                const diff = avgFutureScore - currentData.score;
                if (diff >= 10) trend = 'improving';
                else if (diff <= -10) trend = 'worsening';
            }
        }

        // Score range across 24h
        const scoreRange = bestBlock.score - worstBlock.score;

        return {
            bestBlock,
            worstBlock,
            bestTime: new Date(bestBlock.time),
            nextBlock,
            trend,
            scoreRange,
            blockCount: upcoming.length,
            isBestNow: bestBlock.time === currentData.time
        };
    },

    /**
     * Main insight generator — enhanced with 24h trend.
     * @param {object} data - Current best forecast block
     * @param {array} forecastList - Full forecast array
     * @param {string} targetLang - 'ko' or 'en'
     * @returns {string} Insight text (1-2 sentences)
     */
    getActiveInsight(data, forecastList = [], targetLang = 'ko') {
        if (!data || data.score == null) return null;

        try {
            const isKo = targetLang === 'ko';
            const score = data.score;
            const grade = data.grade;
            const seeing = data.usp?.seeing ?? 'N/A';
            const equipment = this._getEquipment(data);
            const factors = this._getLimitingFactors(data);
            const trend = this._analyzeTrend(data, forecastList);

            // Part 1: Current status summary (score 정수 표시)
            const roundedScore = Math.round(score);
            let status;
            if (isKo) {
                status = `${grade}등급(${roundedScore}점), 시잉 ${seeing}". ${equipment.ko}.`;
            } else {
                status = `Grade ${grade}(${roundedScore}), seeing ${seeing}". ${equipment.en}.`;
            }

            // Part 2: Dynamic context (trend OR limiting factors)
            let context = '';

            if (trend) {
                // Case A: Conditions are great now and it's the best time
                if (score >= 70 && trend.isBestNow) {
                    context = isKo
                        ? ' 지금이 24시간 내 최적 관측 시간입니다!'
                        : ' Now is the best observation window in 24h!';
                }
                // Case B: Conditions will improve
                else if (trend.trend === 'improving' && score < 70) {
                    const betterTime = trend.nextBlock ? new Date(trend.nextBlock.time) : null;
                    if (betterTime) {
                        context = isKo
                            ? ` ${this._formatHourKo(betterTime)} 이후 조건 개선 예상.`
                            : ` Conditions improving after ${this._formatHourEn(betterTime)}.`;
                    }
                }
                // Case C: Better time available later
                else if (!trend.isBestNow && trend.bestBlock.score >= score + 8) {
                    const bestTime = trend.bestTime;
                    const bestGrade = trend.bestBlock.grade;
                    context = isKo
                        ? ` ${this._formatHourKo(bestTime)}경 ${bestGrade}등급(${trend.bestBlock.score}점) 예상.`
                        : ` ${bestGrade}-grade(${trend.bestBlock.score}) expected around ${this._formatHourEn(bestTime)}.`;
                }
                // Case D: Conditions worsening
                else if (trend.trend === 'worsening' && score >= 50) {
                    context = isKo
                        ? ' 조건 악화 예상, 빠른 관측을 권장합니다.'
                        : ' Conditions worsening, observe soon.';
                }
            }

            // If no trend context, fall back to limiting factors (수치 포함)
            if (!context && factors.length > 0) {
                const fmt = (f) => isKo ? `${f.ko}(${f.severity}/8)` : `${f.en}(${f.severity}/8)`;
                if (score >= 70) {
                    context = isKo
                        ? ` 제한요인: ${fmt(factors[0])}.`
                        : ` Limiting: ${fmt(factors[0])}.`;
                } else if (score >= 40) {
                    const topTwo = factors.slice(0, 2);
                    context = isKo
                        ? ` 주의: ${topTwo.map(fmt).join(', ')}.`
                        : ` Watch: ${topTwo.map(fmt).join(', ')}.`;
                } else {
                    const topTwo = factors.slice(0, 2);
                    context = isKo
                        ? ` 주요 원인: ${topTwo.map(fmt).join(', ')}.`
                        : ` Main cause: ${topTwo.map(fmt).join(', ')}.`;
                }
            }

            return status + context;
        } catch (error) {
            console.error("[Analysis] Engine error:", error.message);
            return null;
        }
    }
};

AnalysisService.init();

module.exports = AnalysisService;
