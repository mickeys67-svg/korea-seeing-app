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
     * Get local hour from UTC date + offset (server-timezone-agnostic).
     */
    _localHour(date, utcOffsetSeconds = 0) {
        // Properly handle half-hour timezones (India +5:30, Nepal +5:45)
        const totalMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + utcOffsetSeconds / 60;
        return Math.floor(((totalMinutes / 60) % 24 + 24) % 24);
    },

    /**
     * Format hour as Korean-friendly time string.
     */
    _formatHourKo(date, utcOffsetSeconds = 0) {
        const h = this._localHour(date, utcOffsetSeconds);
        if (h === 0) return '자정';
        if (h < 6) return `새벽 ${h}시`;
        if (h < 12) return `오전 ${h}시`;
        if (h === 12) return '정오';
        if (h < 18) return `오후 ${h - 12}시`;
        if (h < 21) return `저녁 ${h - 12}시`;
        return `밤 ${h - 12}시`;
    },

    _formatHourEn(date, utcOffsetSeconds = 0) {
        const h = this._localHour(date, utcOffsetSeconds);
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
    getActiveInsight(data, forecastList = [], targetLang = 'ko', utcOffsetSeconds = 0) {
        if (!data || data.score == null) return null;

        try {
            const isKo = targetLang === 'ko';
            const score = data.score;
            const grade = data.grade;
            const seeing = data.usp?.seeing ?? 'N/A';
            const equipment = this._getEquipment(data);
            const factors = this._getLimitingFactors(data);
            const trend = this._analyzeTrend(data, forecastList);
            const cloudScore = data.scores?.cloudCover ?? 0;

            // ═══ Cloud gate: 구름 ≥7 → 등급/점수 표시 생략, 구름 메시지만 ═══
            if (cloudScore >= 7) {
                let cloudMsg = isKo ? '관측 불가. 구름이 하늘을 가리고 있습니다.' : 'Observation impossible. Sky fully blocked by clouds.';
                // 트렌드에서 개선 예상이 있으면 추가
                if (trend && !trend.isBestNow && trend.bestBlock.score >= score + 15) {
                    const bestTime = trend.bestTime;
                    cloudMsg += isKo
                        ? ` ${this._formatHourKo(bestTime, utcOffsetSeconds)}경 개선 가능성.`
                        : ` May improve around ${this._formatHourEn(bestTime, utcOffsetSeconds)}.`;
                }
                return cloudMsg;
            }

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
                            ? ` ${this._formatHourKo(betterTime, utcOffsetSeconds)} 이후 조건 개선 예상.`
                            : ` Conditions improving after ${this._formatHourEn(betterTime, utcOffsetSeconds)}.`;
                    }
                }
                // Case C: Better time available later
                else if (!trend.isBestNow && trend.bestBlock.score >= score + 8) {
                    const bestTime = trend.bestTime;
                    const bestGrade = trend.bestBlock.grade;
                    context = isKo
                        ? ` ${this._formatHourKo(bestTime, utcOffsetSeconds)}경 ${bestGrade}등급(${Math.round(trend.bestBlock.score)}점) 예상.`
                        : ` ${bestGrade}-grade(${Math.round(trend.bestBlock.score)}) expected around ${this._formatHourEn(bestTime, utcOffsetSeconds)}.`;
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

            // v3.1: Dew point warning (Tier 1) — condensation risk on optics
            let dewWarning = '';
            if (data.dewPointSpread != null && data.dewPointSpread < 3) {
                dewWarning = isKo
                    ? ` ⚠️ 이슬점 경고(T-Td=${data.dewPointSpread.toFixed(1)}°C) — 결로 위험, 히터 필수.`
                    : ` ⚠️ Dew risk(T-Td=${data.dewPointSpread.toFixed(1)}°C) — use dew heater.`;
            }

            // v3.1: τ₀ coherence time guidance (Tier 1) — planetary imaging exposure
            let tau0Info = '';
            const tau0 = data.usp?.details?.tau0;
            if (tau0 != null && score >= 40) {
                if (tau0 > 10) {
                    tau0Info = isKo
                        ? ` 🪐 τ₀=${Math.round(tau0)}ms, 행성 촬영 탁월.`
                        : ` 🪐 τ₀=${Math.round(tau0)}ms, great for planets.`;
                } else if (tau0 < 5) {
                    tau0Info = isKo
                        ? ` 📷 τ₀=${Math.round(tau0)}ms, 짧은 노출(1-5ms) 권장.`
                        : ` 📷 τ₀=${Math.round(tau0)}ms, use short exposures.`;
                }
            }

            return status + context + dewWarning + tau0Info;
        } catch (error) {
            console.error("[Analysis] Engine error:", error.message);
            return null;
        }
    }
};

AnalysisService.init();

module.exports = AnalysisService;
