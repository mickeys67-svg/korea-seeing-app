/**
 * v5.2 Photo Guide — Modal shell (scenario-based layout)
 *
 * Dashboard 헤더의 카메라 버튼에서 lazy 로 로드됨. 기존 천체 트랙과
 * 완전히 격리되어 있으며, 모달이 열릴 때에만 /api/photo-forecast 를 호출한다.
 *
 * UI 구조 (v5.2):
 *   1. Verdict Hero — 종합 판정 ("지금은 _____ 찍기 좋은 시간")
 *   2. Scenario Cards — 촬영 시나리오 2-4개
 *   3. Condition Summary — 7개 오브제 컬러 바 요약 (접이식)
 *   4. Upcoming Opportunities — 다가오는 촬영 기회 타임라인
 *   5. Warnings — 시나리오에 연결 안 된 잔여 경고
 *   6. Phenomena — ≥8일 자연현상 (있을 때만)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { X, Camera } from 'lucide-react';
import { usePhotoForecast } from './hooks/usePhotoForecast';
import { usePhotoGuideI18n, detectPhotoGuideLang } from './i18n';
import HeroSection from './HeroSection';
import WarningStrip from './WarningStrip';
import ScenarioCard from './ScenarioCard';
import ConditionSummary from './ConditionSummary';
import UpcomingOpportunities from './UpcomingOpportunities';
import PhenomenaCalendar from './widgets/PhenomenaCalendar';
import {
    extractObjects,
    extractWarnings,
    farPhenomena,
    buildScenarios,
    getVerdictKey,
    getGoodReasonTags,
    getBadReasonTags,
} from './objectExtractor';
import { formatRelativeTime } from './momentExtractor';

interface PhotoGuideModalProps {
    lat: number | null;
    lon: number | null;
    onClose: () => void;
}

const PhotoGuideModal: React.FC<PhotoGuideModalProps> = ({ lat, lon, onClose }) => {
    const t = usePhotoGuideI18n();
    const lang = detectPhotoGuideLang();
    const { data, loading, error, stale } = usePhotoForecast(lat, lon, lang);

    // ESC to close
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    // Lock body scroll while open
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    // Mobile vs desktop sizing
    const [isDesktop, setIsDesktop] = useState<boolean>(() =>
        typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches
    );
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 640px)');
        const h = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
        mq.addEventListener('change', h);
        return () => mq.removeEventListener('change', h);
    }, []);

    // Derive all display data
    const derived = useMemo(() => {
        if (!data) {
            return {
                objects: [],
                scenarios: [],
                warnings: [],
                phenomenaFar: [],
                verdictKey: 'average' as string,
                goodTags: [],
                badTags: [],
                topHint: undefined as string | undefined,
                fallbackNextRel: undefined as string | undefined,
                remainingWarnings: [],
            };
        }
        const objs = extractObjects(data, t, lang);
        const allWarnings = extractWarnings(data, t);
        const scenarios = buildScenarios(objs, data, allWarnings);
        const pf = farPhenomena(data.phenomena || []);
        const verdictKey = getVerdictKey(scenarios, objs);
        const goodTags = getGoodReasonTags(objs);
        const badTags = getBadReasonTags(objs);

        // Top hint from best scenario
        const topScenario = scenarios[0];
        const topScenarioI18n = topScenario
            ? (t.scenario as Record<string, { tips: string[] }>)[topScenario.id]
            : null;
        const topHint = topScenarioI18n?.tips?.[0];

        // Warnings already used in scenarios
        const usedWarningIds = new Set(
            scenarios.flatMap((s) => s.warnings.map((w) => w.id))
        );
        const remainingWarnings = allWarnings.filter((w) => !usedWarningIds.has(w.id));

        // Fallback next rel for empty state
        let fallbackNextRel: string | undefined;
        if (verdictKey === 'average' || verdictKey === 'indoor') {
            const candidate = [...objs]
                .filter((o) => o.sortScore >= 50 && o.nextWhenLabel)
                .sort((a, b) => b.sortScore - a.sortScore)[0];
            fallbackNextRel = candidate?.nextWhenLabel;
            if (!fallbackNextRel) {
                const nearestPhen = (data.phenomena || [])
                    .filter((p) => p.dDay >= 0)
                    .sort((a, b) => a.dDay - b.dDay)[0];
                if (nearestPhen) {
                    fallbackNextRel = formatRelativeTime(
                        nearestPhen.peakTime || nearestPhen.date,
                        data.location?.timezone,
                        t,
                        lang,
                    );
                }
            }
        }

        return {
            objects: objs,
            scenarios,
            warnings: allWarnings,
            phenomenaFar: pf,
            verdictKey,
            goodTags,
            badTags,
            topHint,
            fallbackNextRel,
            remainingWarnings,
        };
    }, [data, t, lang]);

    const isLimited = data?.meta?.mode === 'limited';

    return (
        <div
            className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="photo-guide-title"
            style={{ height: '100dvh' }}
        >
            <div
                className="glass-card w-full sm:max-w-2xl shadow-2xl relative animate-scale-in flex flex-col rounded-none sm:rounded-[20px]"
                onClick={(e) => e.stopPropagation()}
                style={
                    isDesktop
                        ? { maxHeight: '90dvh', height: 'auto' }
                        : { height: '100dvh', maxHeight: '100dvh' }
                }
            >
                {/* Header (fixed) */}
                <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[var(--bg-surface)]/80 backdrop-blur-md">
                    <div className="flex items-center gap-2">
                        <Camera className="w-5 h-5 text-amber-400" />
                        <div>
                            <h2
                                id="photo-guide-title"
                                className="text-base font-semibold text-[var(--text-bright)] leading-tight"
                            >
                                {t.title}
                            </h2>
                            <p className="text-xs text-[var(--text-tertiary)]">{t.subtitle}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label={t.close}
                        className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body (scrollable) */}
                <div
                    className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-4"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                >
                    {loading && (
                        <div className="py-16 text-center text-sm text-[var(--text-secondary)]">
                            {t.loading}
                        </div>
                    )}

                    {!loading && error && !data && (
                        <div className="py-16 text-center text-sm text-red-400">
                            {t.errorGeneric}
                        </div>
                    )}

                    {!loading && data && (
                        <>
                            {stale && (
                                <div className="text-xs text-amber-400 text-center">
                                    {t.errorGeneric}
                                </div>
                            )}
                            {isLimited && (
                                <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                                    {t.limitedMode}
                                </div>
                            )}

                            {/* 1. VERDICT HERO */}
                            <HeroSection
                                verdictKey={derived.verdictKey}
                                goodTags={derived.goodTags}
                                badTags={derived.badTags}
                                topHint={derived.topHint}
                                fallbackNextRel={derived.fallbackNextRel}
                            />

                            {/* 2. SCENARIO CARDS */}
                            {derived.scenarios.length > 0 && derived.scenarios[0].id !== 'stayIndoor' && (
                                <div className="space-y-2">
                                    {derived.scenarios
                                        .filter((s) => s.id !== 'stayIndoor')
                                        .map((scenario) => (
                                            <ScenarioCard
                                                key={scenario.id}
                                                scenario={scenario}
                                                objects={derived.objects}
                                            />
                                        ))}
                                </div>
                            )}

                            {/* 3. CONDITION SUMMARY */}
                            <ConditionSummary objects={derived.objects} />

                            {/* 4. UPCOMING OPPORTUNITIES */}
                            <UpcomingOpportunities objects={derived.objects} />

                            {/* 5. REMAINING WARNINGS */}
                            <WarningStrip warnings={derived.remainingWarnings} />

                            {/* 6. FAR PHENOMENA (>=8일) */}
                            {derived.phenomenaFar.length > 0 && (
                                <div>
                                    <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-2 px-1">
                                        {t.phenomena.heading}
                                    </h3>
                                    <PhenomenaCalendar
                                        items={derived.phenomenaFar}
                                        timezone={data.location?.timezone}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PhotoGuideModal;
