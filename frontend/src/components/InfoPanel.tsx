import React, { useState, useEffect, useRef } from 'react';
import {
    X, Sparkles, BookOpen, Star, Heart, ChevronRight,
    Zap, Target, Sun, Rocket, Globe, ExternalLink, Mail, Radio,
} from 'lucide-react';

interface InfoPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

type Tab = 'about' | 'news' | 'guide';

/* ───────── tiny decorative helpers ───────── */

const StarDivider = () => (
    <div className="flex items-center justify-center gap-3 py-4">
        <div
            className="h-px flex-1 max-w-[72px]"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.22))' }}
        />
        <span
            className="text-[6px] tracking-[0.4em] select-none"
            style={{ color: 'var(--warp-purple)', opacity: 0.45 }}
        >
            ✦&ensp;✦&ensp;✦
        </span>
        <div
            className="h-px flex-1 max-w-[72px]"
            style={{ background: 'linear-gradient(90deg, rgba(167,139,250,0.22), transparent)' }}
        />
    </div>
);

/* ───────── animated starfield bg ───────── */

const starSeed = Array.from({ length: 32 }, (_, i) => ({
    size: i % 7 === 0 ? 3 : i % 3 === 0 ? 2 : 1,
    color:
        i % 9 === 0
            ? 'rgba(167,139,250,0.7)'
            : i % 11 === 0
                ? 'rgba(103,232,249,0.5)'
                : `rgba(255,255,255,${0.1 + (i % 5) * 0.12})`,
    top: `${(i * 31 + 11) % 100}%`,
    left: `${(i * 37 + 5) % 100}%`,
    dur: `${3 + (i % 5) * 1.4}s`,
    delay: `${i * 0.22}s`,
}));

const Starfield = React.memo(() => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {starSeed.map((s, i) => (
            <div
                key={i}
                className="absolute rounded-full"
                style={{
                    width: s.size,
                    height: s.size,
                    background: s.color,
                    top: s.top,
                    left: s.left,
                    animation: `twinkle ${s.dur} ease-in-out ${s.delay} infinite`,
                }}
            />
        ))}
        {/* nebula glow */}
        <div
            className="absolute w-[280px] h-[280px] rounded-full"
            style={{
                top: '-60px',
                right: '-90px',
                background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)',
                animation: 'nebula-pulse 9s ease-in-out infinite',
            }}
        />
        <div
            className="absolute w-[200px] h-[200px] rounded-full"
            style={{
                bottom: '15%',
                left: '-50px',
                background: 'radial-gradient(circle, rgba(167,139,250,0.05) 0%, transparent 70%)',
                animation: 'nebula-pulse 11s ease-in-out 4s infinite',
            }}
        />
    </div>
));

/* ═══════════════════════════════════════════════════
   InfoPanel  ·  centered modal · 3 tabs
   ═══════════════════════════════════════════════════ */

const InfoPanel: React.FC<InfoPanelProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<Tab>('about');
    const [visible, setVisible] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => setVisible(true));
            setActiveTab('about');
        } else {
            setVisible(false);
        }
    }, [isOpen]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, [activeTab]);

    // ESC to close
    useEffect(() => {
        if (!isOpen) return;
        const h = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [isOpen, onClose]);

    if (!isOpen && !visible) return null;

    /* ── data ── */

    const updates = [
        {
            version: 'v3.2',
            date: '2026.03.01',
            tag: 'NEW',
            tagColor: 'var(--seeing-exceptional)',
            icon: Sun,
            title: '낮/밤 자동 구분',
            items: [
                'GPS 기반 실제 일출·일몰 시각 적용',
                '낮 시간대 예보 카드 자동 dimming',
                'Warp AI 첫 선택 → 첫 번째 밤 슬롯',
                '일몰 시각 관측 품질 카드 내 표시',
            ],
        },
        {
            version: 'v3.1',
            date: '2026.03.01',
            tag: 'FIX',
            tagColor: 'var(--seeing-fair)',
            icon: Rocket,
            title: 'Warp AI 점수 정합',
            items: [
                '관측 품질 원형과 동일한 종합 점수 기준 통일',
                '대기 안정도(USP)는 서브 지표로 별도 표시',
                '구름·투명도 무시하던 구조적 불일치 해결',
            ],
        },
        {
            version: 'v3.0',
            date: '2026.02.28',
            tag: 'MAJOR',
            tagColor: 'var(--warp-purple)',
            icon: Target,
            title: '대상별 관측 적합도 예측',
            items: [
                '행성 🪐 · 은하수 🌌 · 성운 ✨ · 성단 🔭 · 은하 🌀',
                '0–100점 실시간 산출 + S/A/B/C/D 등급',
                '제한 원인 표시 (시잉/제트기류/달빛 등)',
                'ESO Paranal · Damian Peach 기준 v4.0 재보정',
                '250hPa 제트기류 · CAPE 대류불안정 반영',
            ],
        },
    ];

    const guides = [
        {
            icon: '🎯',
            title: '관측 품질 원형',
            desc: '현재 시간 기준 종합 대기 점수 (0–100). 시잉·구름·제트기류·투명도 등 6개 지표를 가중 평균으로 산출합니다.',
            badge: '85+',
            badgeLabel: 'S등급 = 최상',
            color: 'var(--seeing-exceptional)',
        },
        {
            icon: '🪐',
            title: '대상별 적합도',
            desc: '5가지 천체 대상별로 현재 대기 조건의 적합도를 독립 모델로 계산합니다. 각 대상의 광학적 특성에 맞는 가중치가 적용됩니다.',
            badge: '점수',
            badgeLabel: '낮을수록 제한 원인 표시',
            color: 'var(--warp-purple)',
        },
        {
            icon: '🚀',
            title: 'Warp AI 스캔',
            desc: '최대 24시간 타임슬라이더로 미래 시점을 선택하고 스캔하면 해당 시각의 관측 가능성을 분석합니다. 밤 슬롯(🔵)을 선택하세요.',
            badge: 'GFS',
            badgeLabel: '+ ECMWF + 7Timer',
            color: 'var(--accent)',
        },
        {
            icon: '🌙',
            title: '달 위상 예보',
            desc: '3일간 월출·월몰·달 조명률을 확인하세요. 딥스카이 관측은 달 조명률 20% 이하인 날이 이상적입니다.',
            badge: '<20%',
            badgeLabel: '딥스카이 최적',
            color: 'var(--cyan)',
        },
        {
            icon: '📍',
            title: 'GPS 위치 인식',
            desc: 'GPS를 허용하면 현재 위치 기준 정밀 예보가 제공됩니다. 거부 시 서울 기본값으로 표시됩니다.',
            badge: 'AUTO',
            badgeLabel: '또는 도시 선택',
            color: 'var(--seeing-good)',
        },
    ];

    const tabs: { id: Tab; icon: typeof Star; label: string }[] = [
        { id: 'about', icon: Heart, label: '소개' },
        { id: 'news', icon: Sparkles, label: '새 소식' },
        { id: 'guide', icon: BookOpen, label: '앱 안내' },
    ];

    const v3Features = [
        { emoji: '🎯', label: '대상별 관측 적합도', sub: '행성·은하수·성운·성단·은하' },
        { emoji: '🌍', label: '물리 모델 v4.0', sub: 'ESO·Peach·IDA 기준 재보정' },
        { emoji: '☀️', label: '일출·일몰 자동 구분', sub: 'GPS 위치 기반 천문 일몰' },
        { emoji: '🚀', label: 'Warp AI 점수 정합', sub: 'USP + 종합 점수 통합' },
    ];

    const hashtags = [
        '천문관측', '천체사진', '시잉예보', '행성관측',
        '딥스카이', 'ClearSkies', 'Astrophotography',
    ];

    /* stagger helper */
    const stagger = (idx: number, base = 0.12, step = 0.055) => ({
        opacity: 0 as number,
        animation: `fade-in-up 0.55s ease ${base + idx * step}s forwards`,
    });

    return (
        <>
            {/* ── Backdrop ── */}
            <div
                className="fixed inset-0 z-40 transition-all duration-500"
                style={{
                    background: visible ? 'rgba(4, 6, 14, 0.88)' : 'transparent',
                    backdropFilter: visible ? 'blur(16px)' : 'none',
                    pointerEvents: visible ? 'auto' : 'none',
                }}
                onClick={onClose}
            />

            {/* ── Modal ── */}
            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
                style={{ pointerEvents: visible ? 'auto' : 'none' }}
            >
                <div
                    className="relative w-full max-w-[640px] flex flex-col overflow-hidden"
                    style={{
                        maxHeight: 'min(92vh, 920px)',
                        borderRadius: '20px',
                        background: 'linear-gradient(170deg, rgba(16,20,40,0.98) 0%, rgba(8,10,22,0.99) 100%)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        boxShadow: visible
                            ? '0 0 0 1px rgba(99,102,241,0.05), 0 40px 120px rgba(0,0,0,0.6), 0 0 80px rgba(99,102,241,0.03)'
                            : 'none',
                        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(14px)',
                        opacity: visible ? 1 : 0,
                        transition:
                            'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <Starfield />

                    {/* ── Header ── */}
                    <div className="relative z-10 flex items-center justify-between px-5 sm:px-6 pt-5 pb-3">
                        <div className="flex items-center gap-3">
                            <img
                                src="/logo.jpg"
                                alt="Clear Skies"
                                className="w-9 h-9 rounded-xl object-cover"
                                style={{ boxShadow: '0 0 20px rgba(99,102,241,0.12)' }}
                            />
                            <div>
                                <h2
                                    className="text-base font-bold tracking-tight"
                                    style={{ color: 'var(--text-bright)' }}
                                >
                                    Clear Skies{' '}
                                    <span style={{ color: 'var(--accent)' }}>!</span>
                                </h2>
                                <p
                                    className="text-[10px] font-data uppercase tracking-[0.2em]"
                                    style={{ color: 'var(--text-tertiary)' }}
                                >
                                    Precision Seeing Forecast
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                            style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                color: 'var(--text-tertiary)',
                            }}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* ── Tabs ── */}
                    <div className="relative z-10 flex px-5 sm:px-6 pb-3 gap-1">
                        {tabs.map((tab) => {
                            const active = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-data uppercase tracking-wider transition-all"
                                    style={{
                                        background: active
                                            ? 'rgba(129,140,248,0.1)'
                                            : 'transparent',
                                        color: active
                                            ? 'var(--accent)'
                                            : 'var(--text-tertiary)',
                                        border: active
                                            ? '1px solid rgba(129,140,248,0.2)'
                                            : '1px solid transparent',
                                        fontWeight: active ? 700 : 400,
                                    }}
                                >
                                    <tab.icon className="w-3 h-3" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* ── Divider ── */}
                    <div
                        className="h-px mx-5 sm:mx-6"
                        style={{ background: 'var(--glass-border)' }}
                    />

                    {/* ══════════ Scrollable Content ══════════ */}
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto relative z-10"
                        style={{
                            scrollbarWidth: 'thin',
                            scrollbarColor: 'rgba(255,255,255,0.06) transparent',
                        }}
                    >
                        {/* ════════════════════════════════════
                            TAB : 소개 (About)
                           ════════════════════════════════════ */}
                        {activeTab === 'about' && (
                            <div className="px-5 sm:px-8 py-6">
                                {/* Hero */}
                                <div
                                    className="text-center mb-6 py-8 px-5 rounded-2xl relative overflow-hidden"
                                    style={{
                                        ...stagger(0, 0.08),
                                        background:
                                            'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(167,139,250,0.04) 50%, rgba(103,232,249,0.025) 100%)',
                                        border: '1px solid rgba(129,140,248,0.1)',
                                    }}
                                >
                                    <p
                                        className="text-[10px] font-data uppercase tracking-[0.3em] mb-3"
                                        style={{ color: 'var(--warp-purple)' }}
                                    >
                                        Forme Observatory · 강화도
                                    </p>
                                    <h3 className="text-2xl sm:text-[28px] font-bold tracking-tight mb-2 text-gradient-brand leading-tight">
                                        함께 바라보는 밤하늘
                                    </h3>
                                    <p
                                        className="text-xs"
                                        style={{ color: 'var(--text-tertiary)' }}
                                    >
                                        천체사진가와 천문 관측자를 위한 정밀 시잉 예보
                                    </p>
                                </div>

                                {/* ── Prose ── */}
                                <div style={stagger(1)}>
                                    <p
                                        className="text-sm leading-[2] font-light"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        우리가 함께 바라보는 밤하늘이 조금 더 선명해지길
                                        바라고, 우리 마음도 항상{' '}
                                        <span
                                            className="font-medium"
                                            style={{ color: 'var(--text-bright)' }}
                                        >
                                            행복하고 평화롭기를
                                        </span>{' '}
                                        바랍니다.
                                    </p>
                                </div>

                                <div style={stagger(2)}>
                                    <StarDivider />
                                </div>

                                <div style={stagger(3)}>
                                    <p
                                        className="text-sm leading-[2] font-light"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        고개를 들면 언제든 맑은 하늘과 광활한 우주를 마주하는
                                        것, 그것은 우리{' '}
                                        <span
                                            className="font-medium"
                                            style={{ color: 'var(--cyan)' }}
                                        >
                                            꿈별의 공통된 꿈
                                        </span>
                                        일 것입니다. 별을 바라보는 일은 단순한 관측을 넘어,{' '}
                                        <span
                                            className="font-medium"
                                            style={{ color: 'var(--text-bright)' }}
                                        >
                                            시공간을 건너 마음을 쉬게 하는 우리만의 작은 여행
                                        </span>
                                        이라 믿기 때문입니다.
                                    </p>
                                </div>

                                <div style={stagger(4)}>
                                    <StarDivider />
                                </div>

                                <div style={stagger(5)}>
                                    <p
                                        className="text-sm leading-[2] font-light"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        하지만 흐린 시야와 불안정한{' '}
                                        <span
                                            className="font-data text-xs px-1.5 py-0.5 rounded"
                                            style={{
                                                background: 'rgba(167,139,250,0.1)',
                                                color: 'var(--warp-purple)',
                                            }}
                                        >
                                            Seeing
                                        </span>
                                        은 소중한 찰나의 순간을 종종 가로막곤 했습니다.
                                        조금이라도 더 선명한 밤하늘을 선후배님들과 함께 나누고
                                        싶어, 천체 관측에 꼭 필요한 시잉 정보를 담은 웹을
                                        만들어 보았습니다.
                                    </p>
                                </div>

                                <div style={stagger(6)}>
                                    <StarDivider />
                                </div>

                                <div style={stagger(7)}>
                                    <p
                                        className="text-sm leading-[2] font-light"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        이 도구가 망원경을 설치하기 전의{' '}
                                        <span
                                            className="font-medium"
                                            style={{ color: 'var(--text-bright)' }}
                                        >
                                            망설임을 덜어주고
                                        </span>
                                        , 긴 기다림의 밤에{' '}
                                        <span
                                            className="font-medium"
                                            style={{ color: 'var(--text-bright)' }}
                                        >
                                            든든한 이정표
                                        </span>
                                        가 되어주기를 바랍니다.
                                    </p>
                                </div>

                                <div style={stagger(8)}>
                                    <StarDivider />
                                </div>

                                <div style={stagger(9)}>
                                    <p
                                        className="text-sm leading-[2] font-light"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        v1.0에서 시작해 v3.0에 닿았지만, 여전히 보완할 점이
                                        많은 미숙한 결과물일지도 모릅니다. 하지만 완벽한 하늘이
                                        아니더라도 별을 향한 우리의 마음만큼은 언제나 맑기를
                                        바라는{' '}
                                        <span
                                            className="font-medium"
                                            style={{ color: 'var(--accent)' }}
                                        >
                                            진심
                                        </span>
                                        을 담아 다듬어 가고 있습니다.
                                    </p>
                                </div>

                                <div style={stagger(10)}>
                                    <StarDivider />
                                </div>

                                <div style={stagger(11)}>
                                    <p
                                        className="text-sm leading-[2] font-light"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        이 공간이 여러분과 우주를 잇는{' '}
                                        <span
                                            className="font-medium"
                                            style={{ color: 'var(--cyan)' }}
                                        >
                                            따뜻한 다리
                                        </span>
                                        가 되길 소망합니다.
                                    </p>
                                    <p
                                        className="text-sm leading-[2] font-light mt-1"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        맑은 하늘 아래, 여러분의 모든 관측이{' '}
                                        <span
                                            className="font-medium"
                                            style={{ color: 'var(--text-bright)' }}
                                        >
                                            생애 가장 찬란한 기억
                                        </span>
                                        으로 남기를 기원합니다.
                                    </p>
                                </div>

                                {/* ── Sign-off ── */}
                                <div className="text-center py-8" style={stagger(12)}>
                                    <p className="text-xl font-bold tracking-tight mb-3 text-gradient-brand">
                                        Clear Skies!
                                    </p>
                                    <div
                                        className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full"
                                        style={{
                                            background:
                                                'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(129,140,248,0.05))',
                                            border: '1px solid rgba(167,139,250,0.18)',
                                            boxShadow:
                                                '0 0 30px rgba(167,139,250,0.05)',
                                        }}
                                    >
                                        <Radio
                                            className="w-4 h-4"
                                            style={{ color: 'var(--warp-purple)' }}
                                        />
                                        <span
                                            className="font-data text-sm font-bold tracking-wider"
                                            style={{ color: 'var(--warp-purple)' }}
                                        >
                                            DS1QZZ
                                        </span>
                                        <span
                                            className="w-px h-4"
                                            style={{
                                                background: 'rgba(167,139,250,0.25)',
                                            }}
                                        />
                                        <span
                                            className="font-data text-sm"
                                            style={{ color: 'var(--text-tertiary)' }}
                                        >
                                            73
                                        </span>
                                    </div>
                                </div>

                                {/* ── v3 Feature Highlights ── */}
                                <div className="mb-6" style={stagger(13)}>
                                    <p
                                        className="text-[10px] font-data uppercase tracking-[0.2em] mb-3"
                                        style={{ color: 'var(--text-tertiary)' }}
                                    >
                                        v3.0 주요 업데이트
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {v3Features.map((f, i) => (
                                            <div
                                                key={i}
                                                className="rounded-xl px-3 py-3 transition-all hover:scale-[1.02]"
                                                style={{
                                                    background: 'rgba(255,255,255,0.025)',
                                                    border: '1px solid rgba(255,255,255,0.06)',
                                                }}
                                            >
                                                <span className="text-lg leading-none">
                                                    {f.emoji}
                                                </span>
                                                <p
                                                    className="text-xs font-semibold mt-1.5 mb-0.5"
                                                    style={{
                                                        color: 'var(--text-bright)',
                                                    }}
                                                >
                                                    {f.label}
                                                </p>
                                                <p
                                                    className="text-[10px] leading-snug"
                                                    style={{
                                                        color: 'var(--text-tertiary)',
                                                    }}
                                                >
                                                    {f.sub}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* ── URL + Hashtags ── */}
                                <div className="text-center pt-2 pb-2" style={stagger(14)}>
                                    <a
                                        href="https://www.clearsky.kr"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs font-data transition-colors hover:underline"
                                        style={{ color: 'var(--accent)' }}
                                    >
                                        <Globe className="w-3 h-3" />
                                        www.clearsky.kr
                                        <ExternalLink className="w-3 h-3 opacity-50" />
                                    </a>
                                    <p
                                        className="text-[10px] mt-1.5"
                                        style={{
                                            color: 'var(--text-tertiary)',
                                            opacity: 0.6,
                                        }}
                                    >
                                        무료 · PC/모바일 · 광고 없음 · GPS 자동 위치
                                    </p>

                                    <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                                        {hashtags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="text-[10px] font-data px-2 py-0.5 rounded-full"
                                                style={{
                                                    color: 'var(--text-tertiary)',
                                                    background:
                                                        'rgba(255,255,255,0.025)',
                                                    border: '1px solid rgba(255,255,255,0.045)',
                                                }}
                                            >
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* ── Contact ── */}
                                <div
                                    className="mt-4 pt-4 text-center"
                                    style={{
                                        borderTop: '1px solid var(--glass-border)',
                                    }}
                                >
                                    <a
                                        href="mailto:mickeys67@gmail.com"
                                        className="inline-flex items-center gap-1.5 text-[11px] font-data transition-colors hover:underline"
                                        style={{ color: 'var(--text-tertiary)' }}
                                    >
                                        <Mail className="w-3 h-3" />
                                        mickeys67@gmail.com
                                    </a>
                                </div>
                            </div>
                        )}

                        {/* ════════════════════════════════════
                            TAB : 새 소식 (News)
                           ════════════════════════════════════ */}
                        {activeTab === 'news' && (
                            <div className="px-5 sm:px-6 py-5 space-y-3">
                                {updates.map((update, idx) => {
                                    const Icon = update.icon;
                                    return (
                                        <div
                                            key={idx}
                                            className="rounded-xl p-4"
                                            style={{
                                                background: 'rgba(255,255,255,0.025)',
                                                border: '1px solid var(--glass-border)',
                                                ...stagger(idx),
                                            }}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                                        style={{
                                                            background: `color-mix(in srgb, ${update.tagColor} 12%, transparent)`,
                                                            border: `1px solid color-mix(in srgb, ${update.tagColor} 25%, transparent)`,
                                                        }}
                                                    >
                                                        <Icon
                                                            className="w-3.5 h-3.5"
                                                            style={{
                                                                color: update.tagColor,
                                                            }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className="text-xs font-bold"
                                                                style={{
                                                                    color: 'var(--text-bright)',
                                                                }}
                                                            >
                                                                {update.title}
                                                            </span>
                                                            <span
                                                                className="text-[9px] font-data font-bold px-1.5 py-0.5 rounded"
                                                                style={{
                                                                    color: update.tagColor,
                                                                    background: `color-mix(in srgb, ${update.tagColor} 10%, transparent)`,
                                                                }}
                                                            >
                                                                {update.tag}
                                                            </span>
                                                        </div>
                                                        <p
                                                            className="text-[10px] font-data mt-0.5"
                                                            style={{
                                                                color: 'var(--text-tertiary)',
                                                            }}
                                                        >
                                                            {update.version} ·{' '}
                                                            {update.date}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <ul className="space-y-1.5 ml-[38px]">
                                                {update.items.map((item, i) => (
                                                    <li
                                                        key={i}
                                                        className="flex items-start gap-2"
                                                    >
                                                        <ChevronRight
                                                            className="w-3 h-3 mt-0.5 flex-shrink-0"
                                                            style={{
                                                                color: update.tagColor,
                                                                opacity: 0.6,
                                                            }}
                                                        />
                                                        <span
                                                            className="text-xs leading-relaxed"
                                                            style={{
                                                                color: 'var(--text-secondary)',
                                                            }}
                                                        >
                                                            {item}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    );
                                })}

                                {/* Data source note */}
                                <div
                                    className="rounded-xl p-4 text-center"
                                    style={{
                                        background: 'rgba(99,102,241,0.04)',
                                        border: '1px solid rgba(99,102,241,0.1)',
                                        ...stagger(updates.length),
                                    }}
                                >
                                    <Zap
                                        className="w-4 h-4 mx-auto mb-2"
                                        style={{ color: 'var(--accent)' }}
                                    />
                                    <p
                                        className="text-[11px] leading-relaxed"
                                        style={{ color: 'var(--text-tertiary)' }}
                                    >
                                        GFS · ECMWF · 7Timer · Open-Meteo · Met.no 기반
                                        <br />
                                        <span style={{ color: 'var(--accent)' }}>
                                            무료 · 광고 없음 · $0 AI 비용
                                        </span>
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ════════════════════════════════════
                            TAB : 앱 안내 (Guide)
                           ════════════════════════════════════ */}
                        {activeTab === 'guide' && (
                            <div className="px-5 sm:px-6 py-5 space-y-3">
                                {/* Intro */}
                                <div
                                    className="rounded-xl p-4"
                                    style={{
                                        background:
                                            'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(167,139,250,0.04))',
                                        border: '1px solid rgba(99,102,241,0.12)',
                                        ...stagger(0),
                                    }}
                                >
                                    <p
                                        className="text-xs leading-relaxed"
                                        style={{
                                            color: 'var(--text-secondary)',
                                        }}
                                    >
                                        Clear Skies는 천체사진가와 아마추어 천문가를
                                        위한{' '}
                                        <span
                                            className="font-semibold"
                                            style={{
                                                color: 'var(--text-bright)',
                                            }}
                                        >
                                            정밀 시잉 예보
                                        </span>{' '}
                                        앱입니다. 대기 조건을 다층 분석해 오늘 밤 관측
                                        가능성을 알려드립니다.
                                    </p>
                                </div>

                                {/* Grade scale */}
                                <div
                                    className="rounded-xl p-4"
                                    style={{
                                        background: 'rgba(255,255,255,0.025)',
                                        border: '1px solid var(--glass-border)',
                                        ...stagger(1),
                                    }}
                                >
                                    <p
                                        className="text-[10px] font-data uppercase tracking-[0.15em] mb-3"
                                        style={{
                                            color: 'var(--text-tertiary)',
                                        }}
                                    >
                                        등급 기준표
                                    </p>
                                    <div className="grid grid-cols-5 gap-1.5">
                                        {[
                                            {
                                                grade: 'S',
                                                range: '85+',
                                                color: 'var(--seeing-exceptional)',
                                            },
                                            {
                                                grade: 'A',
                                                range: '70+',
                                                color: 'var(--seeing-excellent)',
                                            },
                                            {
                                                grade: 'B',
                                                range: '55+',
                                                color: 'var(--seeing-good)',
                                            },
                                            {
                                                grade: 'C',
                                                range: '40+',
                                                color: 'var(--seeing-fair)',
                                            },
                                            {
                                                grade: 'D',
                                                range: '~40',
                                                color: 'var(--seeing-very-poor)',
                                            },
                                        ].map((g) => (
                                            <div
                                                key={g.grade}
                                                className="flex flex-col items-center gap-1 py-2 rounded-lg"
                                                style={{
                                                    background: `color-mix(in srgb, ${g.color} 6%, transparent)`,
                                                }}
                                            >
                                                <span
                                                    className="text-base font-data font-bold"
                                                    style={{ color: g.color }}
                                                >
                                                    {g.grade}
                                                </span>
                                                <span
                                                    className="text-[10px] font-data"
                                                    style={{
                                                        color: 'var(--text-tertiary)',
                                                    }}
                                                >
                                                    {g.range}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Feature cards */}
                                {guides.map((guide, idx) => (
                                    <div
                                        key={idx}
                                        className="rounded-xl p-4"
                                        style={{
                                            background: 'rgba(255,255,255,0.025)',
                                            border: '1px solid var(--glass-border)',
                                            ...stagger(idx + 2),
                                        }}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="text-xl leading-none flex-shrink-0 mt-0.5">
                                                {guide.icon}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span
                                                        className="text-sm font-semibold"
                                                        style={{
                                                            color: 'var(--text-bright)',
                                                        }}
                                                    >
                                                        {guide.title}
                                                    </span>
                                                    <div className="flex flex-col items-end flex-shrink-0 ml-2">
                                                        <span
                                                            className="text-sm font-data font-bold"
                                                            style={{
                                                                color: guide.color,
                                                            }}
                                                        >
                                                            {guide.badge}
                                                        </span>
                                                        <span
                                                            className="text-[9px] font-data"
                                                            style={{
                                                                color: 'var(--text-tertiary)',
                                                            }}
                                                        >
                                                            {guide.badgeLabel}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p
                                                    className="text-xs leading-relaxed"
                                                    style={{
                                                        color: 'var(--text-secondary)',
                                                    }}
                                                >
                                                    {guide.desc}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Contact */}
                                <div
                                    className="rounded-xl p-4 text-center"
                                    style={{
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid var(--glass-border)',
                                        ...stagger(guides.length + 2),
                                    }}
                                >
                                    <p
                                        className="text-[11px]"
                                        style={{
                                            color: 'var(--text-tertiary)',
                                        }}
                                    >
                                        Forme Observatory · 강화도
                                        <br />
                                        <a
                                            href="mailto:mickeys67@gmail.com"
                                            className="transition-colors hover:underline"
                                            style={{ color: 'var(--accent)' }}
                                        >
                                            mickeys67@gmail.com
                                        </a>
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Bottom glow ── */}
                    <div
                        className="h-px w-full flex-shrink-0 relative z-10"
                        style={{
                            background:
                                'linear-gradient(90deg, transparent 5%, var(--warp-purple), var(--accent), var(--cyan), transparent 95%)',
                            opacity: 0.25,
                        }}
                    />
                </div>
            </div>
        </>
    );
};

export default InfoPanel;
