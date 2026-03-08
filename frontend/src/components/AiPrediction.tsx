import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, Rocket, Info, Zap } from 'lucide-react';
import ModelInfoModal from './ModelInfoModal';
import type { ForecastItem, AstronomyDay } from '../types/weather';
import TimeSlider from './TimeSlider';
import PredictionCard from './PredictionCard';
import LiveClock from './LiveClock';
import useI18n from '../hooks/useI18n';

interface Props {
    forecastList: ForecastItem[];
    timezone?: string;
    aiSummary?: string | null;
    astronomy?: AstronomyDay[];
}

// 슬롯 시간이 밤인지 판별 (실제 sunrise/sunset 기반)
function isNightSlot(isoString: string, astronomy: AstronomyDay[] | undefined, tz: string): boolean {
    const slotTime = new Date(isoString);
    if (astronomy?.length) {
        const localDateStr = slotTime.toLocaleDateString('en-CA', { timeZone: tz });
        const matchDay = astronomy.find(d => d.date === localDateStr);
        if (matchDay?.sun?.sunrise && matchDay?.sun?.sunset) {
            return slotTime < new Date(matchDay.sun.sunrise as string) || slotTime > new Date(matchDay.sun.sunset as string);
        }
    }
    // fallback
    const hour = parseInt(slotTime.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }), 10);
    return hour < 6 || hour > 18;
}

const AiPrediction: React.FC<Props> = ({ forecastList, timezone, aiSummary, astronomy }) => {
    const t = useI18n();
    const resolvedTz = (timezone && timezone !== 'UTC' && timezone !== 'GMT')
        ? timezone
        : Intl.DateTimeFormat().resolvedOptions().timeZone;

    const availableForecasts = forecastList.slice(0, 24);

    // 슬롯별 밤/낮 플래그
    const nightFlags = availableForecasts.map(f => isNightSlot(f.time, astronomy, resolvedTz));

    // 초기 선택: 첫 번째 밤 슬롯 (없으면 0)
    const [selectedIndex, setSelectedIndex] = useState(() => {
        const firstNight = nightFlags.findIndex(n => n);
        return firstNight >= 0 ? firstNight : 0;
    });

    const [prediction, setPrediction] = useState<{ probability: number; comment: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState(t.aiPrediction.warpMessages[0]);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const selectedForecast = availableForecasts[selectedIndex] || availableForecasts[0];
    const isCurrentDaytime = !nightFlags[selectedIndex];

    // ──── 날짜/시간 포맷 유틸 ────
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: resolvedTz });

    const getDayLabel = (isoString: string): string => {
        const date = new Date(isoString);
        const localDate = date.toLocaleDateString('en-CA', { timeZone: resolvedTz });
        const diff = Math.round((new Date(localDate + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000);
        if (diff === 0) return t.forecastList.today;
        if (diff === 1) return t.forecastList.tomorrow;
        if (diff === 2) return t.forecastList.dayAfter;
        return date.toLocaleDateString(undefined, { timeZone: resolvedTz, month: 'short', day: 'numeric' });
    };

    const getTimeLabel = (isoString: string): string => {
        return new Date(isoString).toLocaleTimeString([], {
            timeZone: resolvedTz,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    const getSlotLabel = (isoString: string): string => {
        return `${getDayLabel(isoString)} ${getTimeLabel(isoString)}`;
    };

    // TimeSlider에 전달할 포맷된 라벨들
    const startSlotLabel = availableForecasts.length > 0 ? getSlotLabel(availableForecasts[0].time) : '';
    const endSlotLabel = availableForecasts.length > 0 ? getSlotLabel(availableForecasts[availableForecasts.length - 1].time) : '';
    const selectedDayLabel = selectedForecast ? getDayLabel(selectedForecast.time) : '';
    const selectedTimeLabel = selectedForecast ? getTimeLabel(selectedForecast.time) : '';
    const selectedFullLabel = selectedForecast ? `${selectedDayLabel} ${selectedTimeLabel}` : '';

    // 날짜별 도트 그룹
    const dotGroups = useMemo(() => {
        const groups: { label: string; indices: number[] }[] = [];
        let currentDate = '';
        for (let i = 0; i < availableForecasts.length; i++) {
            const dateStr = new Date(availableForecasts[i].time).toLocaleDateString('en-CA', { timeZone: resolvedTz });
            if (dateStr !== currentDate) {
                currentDate = dateStr;
                groups.push({ label: getDayLabel(availableForecasts[i].time), indices: [] });
            }
            groups[groups.length - 1].indices.push(i);
        }
        return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [availableForecasts, resolvedTz, todayStr]);

    const handlePredict = () => {
        if (!selectedForecast) return;

        setLoading(true);
        setPrediction(null);
        setLoadingMsg(t.aiPrediction.warpMessages[Math.floor(Math.random() * t.aiPrediction.warpMessages.length)]);

        // Clear any existing timer
        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(() => {
            const score = selectedForecast.score;
            const seeingVal = selectedForecast.usp?.seeing?.toFixed(1) ?? '-';
            const seeingNum = selectedForecast.usp?.seeing ?? null;
            const r0Val = selectedForecast.usp?.details?.r0 ?? null;
            const cloudVal = selectedForecast.scores.cloudCover;

            // 제한요인 분석 (구름 제외 — Layer 1에서 별도 처리)
            const metricEntries = [
                { name: t.targets.factors.seeing, val: selectedForecast.scores.seeing },
                { name: t.targets.factors.transparency, val: selectedForecast.scores.transparency },
                { name: t.targets.factors.wind, val: selectedForecast.scores.wind },
                { name: t.targets.factors.jetStream, val: selectedForecast.scores.jetStream },
                { name: t.targets.factors.convection, val: selectedForecast.scores.convection },
            ];
            const severeFactors = metricEntries.filter(m => m.val >= 5).sort((a, b) => b.val - a.val);
            const limitedStr = severeFactors.length > 0
                ? ` ${t.targets.limitedBy}: ${severeFactors.slice(0, 2).map(f => `${f.name}(${f.val}/8)`).join(', ')}`
                : '';

            const seeingStr = `Seeing ${seeingVal}"`;
            let comment: string;

            // ═══ Layer 1: 구름 → 별이 보이는가? ═══
            if (cloudVal >= 7) {
                comment = `${seeingStr} — ${t.aiPrediction.uspComments.blocked}`;
            } else if (cloudVal >= 5) {
                comment = `${seeingStr} — ${t.aiPrediction.uspComments.intermittent}`;
            }
            // ═══ Layer 2: 하늘 열림 → Seeing + Score 장비 추천 ═══
            else if (seeingNum !== null && seeingNum < 1.0 && score >= 85) {
                const r0Str = r0Val ? ` · r₀ ${r0Val}cm` : '';
                comment = `${seeingStr}${r0Str} — ${t.aiPrediction.uspComments.highRes}`;
            } else if (seeingNum !== null && seeingNum < 1.2 && score >= 70) {
                comment = `${seeingStr} — ${t.aiPrediction.uspComments.highMag}`;
            } else if (seeingNum !== null && seeingNum < 1.5 && score >= 55) {
                comment = `${seeingStr} — ${t.aiPrediction.uspComments.planetary}${limitedStr}`;
            } else if (seeingNum !== null && seeingNum < 2.0 && score >= 45) {
                comment = `${seeingStr} — ${t.aiPrediction.uspComments.wideField}${limitedStr}`;
            } else if (score >= 35) {
                comment = `${seeingStr} — ${t.aiPrediction.uspComments.visualOnly}${limitedStr}`;
            } else {
                comment = `${seeingStr} — ${t.aiPrediction.uspComments.notRecommended}${limitedStr}`;
            }

            setPrediction({ probability: score, comment });
            setLoading(false);

            try {
                const audio = new Audio('/magic-chime.mp3');
                audio.volume = 0.4;
                audio.play().catch(() => { /* autoplay blocked by browser policy */ });
            } catch (e) { console.warn('[Warp] Audio init failed:', e); }
        }, 1200);
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedIndex(parseInt(e.target.value));
        setPrediction(null);
    };

    const predictionDetails = selectedForecast ? {
        seeing: selectedForecast.scores.seeing,
        transparency: selectedForecast.scores.transparency,
        cloudCover: selectedForecast.scores.cloudCover,
        windSpeed: selectedForecast.wind10m.speed,
        usp: selectedForecast.usp
    } : undefined;

    if (!selectedForecast) return null;

    return (
        <div className="glass-card w-full p-6 sm:p-8 mt-6 animate-fade-in-up delay-3 relative overflow-hidden" style={{ animationFillMode: 'backwards' }}>
            {/* Warp glow effects */}
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none opacity-30"
                style={{ background: 'radial-gradient(circle, var(--warp-purple), transparent)' }} />
            <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full blur-3xl -ml-12 -mb-12 pointer-events-none opacity-20"
                style={{ background: 'radial-gradient(circle, var(--warp-pink), transparent)' }} />

            {/* Speed lines decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(3)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute h-[1px] opacity-0"
                        style={{
                            top: `${20 + i * 30}%`,
                            left: 0,
                            right: 0,
                            background: `linear-gradient(90deg, transparent, var(--warp-purple), transparent)`,
                            animation: `warpSpeedLines ${3 + i}s ease-in-out ${i * 2}s infinite`,
                        }}
                    />
                ))}
            </div>

            {/* AI Summary */}
            {aiSummary && (
                <div className="mb-4 relative z-10">
                    <div className="glass-card-inner p-5 flex gap-3 items-start border-l-2 border-[var(--warp-purple)]">
                        <Zap className="w-5 h-5 text-[var(--warp-purple)] shrink-0 mt-0.5" />
                        <div>
                            <span className="text-sm font-data uppercase tracking-[0.15em] text-[var(--warp-purple)] block mb-1.5 font-bold">{t.aiPrediction.warpInsight}</span>
                            <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed">
                                {aiSummary}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col items-center mb-6 relative z-10">
                <button
                    onClick={() => setShowInfo(true)}
                    className="flex items-center gap-3 mb-3 group px-5 py-2.5 rounded-2xl hover:bg-[var(--bg-surface)] transition-colors"
                    title="Model details"
                >
                    <div className="p-2.5 rounded-xl border border-[var(--glass-border)] group-hover:border-[var(--warp-purple)] transition-all animate-warp-pulse"
                        style={{ background: 'color-mix(in srgb, var(--warp-purple) 12%, transparent)' }}>
                        <Rocket className="w-6 h-6 text-[var(--warp-purple)]" />
                    </div>
                    <div className="flex flex-col items-start">
                        <div className="flex items-center gap-1.5">
                            <h3 className="text-xl font-bold text-gradient-warp">
                                WARP AI
                            </h3>
                            <Info className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--warp-purple)] transition-colors" />
                        </div>
                        <span className="text-xs font-data text-[var(--text-tertiary)] uppercase tracking-[0.15em]">
                            {t.aiPrediction.ensembleVersion}
                        </span>
                    </div>
                </button>

            </div>

            {/* ──── Time Context: NOW → SCAN TARGET ──── */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 relative z-10 flex-wrap">
                {/* NOW side — compact, secondary */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-surface)]/50 border border-[var(--glass-border)]">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <div className="flex flex-col leading-tight">
                        <span className="text-[9px] font-data text-emerald-400/70 uppercase tracking-widest font-semibold">
                            {t.forecastList.now}
                        </span>
                        <LiveClock timezone={resolvedTz} compact />
                    </div>
                </div>

                {/* Connecting arrow */}
                <div className="flex items-center gap-0.5 select-none">
                    <div className="w-3 h-px bg-gradient-to-r from-emerald-400/20 to-[var(--warp-purple)]/20" />
                    <span className="text-xs text-[var(--text-tertiary)]">&rarr;</span>
                    <div className="w-3 h-px bg-gradient-to-r from-[var(--warp-purple)]/20 to-[var(--warp-purple)]/40" />
                </div>

                {/* SCAN TARGET side — prominent, primary */}
                <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--warp-purple)]/25"
                    style={{ boxShadow: '0 0 16px color-mix(in srgb, var(--warp-purple) 8%, transparent)' }}>
                    <span className="text-lg">{nightFlags[selectedIndex] ? '🌙' : '☀️'}</span>
                    <div className="flex flex-col leading-tight">
                        <span className="text-[9px] font-data text-[var(--warp-purple)] uppercase tracking-widest font-bold">
                            {t.aiPrediction.scanTarget}
                        </span>
                        <span
                            className="text-lg font-data font-bold text-[var(--accent)] tracking-tight"
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                            {selectedDayLabel} {selectedTimeLabel}
                        </span>
                    </div>
                </div>
            </div>

            {/* Confidence */}
            {selectedForecast.usp && (
                <div className="flex items-center justify-center gap-1.5 text-xs font-data text-[var(--text-tertiary)] mb-3 relative z-10">
                    <span>{t.common.confidence}:</span>
                    <span className="font-bold" style={{ color: selectedForecast.usp.confidence > 80 ? 'var(--seeing-exceptional)' : 'var(--seeing-fair)' }}>
                        {selectedForecast.usp.confidence}%
                    </span>
                </div>
            )}

            {/* Time Slider */}
            <TimeSlider
                selectedIndex={selectedIndex}
                maxIndex={availableForecasts.length - 1}
                onChange={handleTimeChange}
                startLabel={startSlotLabel}
                endLabel={endSlotLabel}
            />

            {/* 날짜별 그룹 도트 인디케이터 — 고정 크기, ring으로 선택 표시 */}
            <div className="flex justify-center gap-4 -mt-2 mb-4 relative z-10 flex-wrap">
                {dotGroups.map(group => (
                    <div key={group.label} className="flex items-center gap-1">
                        <span className="text-[10px] font-data text-[var(--text-tertiary)] uppercase tracking-wider mr-0.5 shrink-0">
                            {group.label}
                        </span>
                        {group.indices.map(i => (
                            <button
                                key={i}
                                onClick={() => { setSelectedIndex(i); setPrediction(null); }}
                                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                                    i === selectedIndex
                                        ? 'ring-[2px] ring-offset-1 ring-offset-transparent ' + (nightFlags[i] ? 'bg-indigo-400 ring-indigo-400' : 'bg-amber-400 ring-amber-400')
                                        : (nightFlags[i] ? 'bg-indigo-400/40 hover:bg-indigo-400/70' : 'bg-amber-400/40 hover:bg-amber-400/70')
                                }`}
                                title={`${getTimeLabel(availableForecasts[i].time)} ${nightFlags[i] ? '🌙' : '☀️'}`}
                            />
                        ))}
                    </div>
                ))}
            </div>

            {/* 낮 시간 선택 경고 */}
            {isCurrentDaytime && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20 relative z-10">
                    <span className="text-base">☀️</span>
                    <p className="text-xs text-amber-400/80">
                        {t.common.daytime} — {t.common.daytimeDesc}
                    </p>
                </div>
            )}

            {/* Action area — 고정 min-height로 레이아웃 점프 방지 */}
            <div className="relative z-10 min-h-[120px]">
                {/* Warp Scan Button */}
                {!prediction && !loading && (
                    <div className="text-center py-3 animate-fade-in">
                        <button
                            onClick={handlePredict}
                            className="relative text-white px-8 py-3.5 rounded-full font-semibold text-sm flex items-center gap-2.5 mx-auto transition-all hover:scale-105 active:scale-95 overflow-hidden group"
                            style={{
                                background: 'linear-gradient(135deg, var(--warp-purple), var(--accent-dim), var(--warp-pink))',
                                boxShadow: '0 4px 24px var(--warp-glow), 0 0 0 1px rgba(167, 139, 250, 0.2)',
                            }}
                        >
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ background: 'linear-gradient(135deg, var(--warp-pink), var(--accent-dim), var(--warp-purple))' }} />
                            <Rocket className="w-5 h-5 relative z-10" />
                            <span className="relative z-10">{t.aiPrediction.warpScan}</span>
                            <Sparkles className="w-4 h-4 relative z-10 opacity-70" />
                        </button>
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="text-center py-8">
                        <div className="relative w-16 h-16 mx-auto mb-4">
                            <div className="absolute inset-0 rounded-full border-2 border-[var(--warp-purple)]/30 animate-spin"
                                style={{ animationDuration: '3s' }} />
                            <div className="absolute inset-1 rounded-full border-2 border-transparent border-t-[var(--warp-pink)] animate-spin"
                                style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Rocket className="w-6 h-6 text-[var(--warp-purple)] animate-pulse" />
                            </div>
                        </div>
                        <p className="text-sm text-[var(--warp-purple)] font-data animate-pulse font-medium">
                            {loadingMsg}
                        </p>
                    </div>
                )}

                {/* Prediction Result */}
                {!loading && prediction && (
                    <PredictionCard
                        prediction={prediction}
                        loading={false}
                        onClose={() => setPrediction(null)}
                        details={predictionDetails}
                        hasPrev={selectedIndex > 0}
                        hasNext={selectedIndex < availableForecasts.length - 1}
                        targetTime={selectedFullLabel}
                    />
                )}
            </div>

            <ModelInfoModal
                isOpen={showInfo}
                onClose={() => setShowInfo(false)}
            />
        </div>
    );
};

export default AiPrediction;
