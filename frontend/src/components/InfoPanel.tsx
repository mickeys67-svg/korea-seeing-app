import React, { useState, useEffect, useRef } from 'react';
import {
    X, Sparkles, BookOpen, Star, Heart, ChevronRight,
    Zap, Target, Sun, Rocket, Globe, ExternalLink, Mail, Radio, Cloud, Shield,
} from 'lucide-react';
import useI18n from '../hooks/useI18n';

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

/* ───────── shooting star (random spawn) ───────── */

interface ShootingStar { id: number; top: number; left: number; angle: number; }

const ShootingStars: React.FC = () => {
    const [star, setStar] = useState<ShootingStar | null>(null);

    useEffect(() => {
        const spawn = () => {
            setStar({
                id: Date.now(),
                top: Math.random() * 30,
                left: 40 + Math.random() * 55,
                angle: 135 + Math.random() * 20,
            });
            setTimeout(() => setStar(null), 1200);
        };

        // 첫 별똥별: 2~4초 후
        const first = setTimeout(spawn, 2000 + Math.random() * 2000);
        // 이후 4~7초 간격으로 반복
        const iv = setInterval(spawn, 4000 + Math.random() * 3000);
        return () => { clearTimeout(first); clearInterval(iv); };
    }, []);

    if (!star) return null;
    return (
        <div
            key={star.id}
            className="absolute"
            style={{
                top: `${star.top}%`,
                left: `${star.left}%`,
                height: '2px',
                borderRadius: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.5), rgba(255,255,255,0.9))',
                boxShadow: '0 0 6px 1px rgba(167,139,250,0.3)',
                transform: `rotate(${star.angle}deg)`,
                animation: 'shooting-star 1s ease-out forwards',
            }}
        />
    );
};

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

        <ShootingStars />

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

/* ───────── prose highlight config ───────── */

// Colors for highlighted segments in each prose paragraph (odd indices)
const proseHighlightStyles: Array<{ colors: string[]; inlineTag?: boolean }> = [
    { colors: ['var(--text-bright)'] },                           // p0: "peace"
    { colors: ['var(--cyan)', 'var(--text-bright)'] },            // p1: "quiet dream", "small journey"
    { colors: ['var(--warp-purple)'], inlineTag: true },          // p2: "seeing" inline tag
    { colors: ['var(--text-bright)', 'var(--text-bright)'] },     // p3: "ease hesitation", "trusted companion"
    { colors: ['var(--accent)'] },                                // p4: "sincerity"
    { colors: ['var(--cyan)'] },                                  // p5: "warm bridge"
    { colors: ['var(--text-bright)'] },                           // p6: "most brilliant memory"
];

/** Render alternating normal/highlighted segments */
const renderProse = (segments: string[], styleIdx: number) => {
    const style = proseHighlightStyles[styleIdx] || { colors: [] };
    return segments.map((seg, i) => {
        if (i % 2 === 0) return <React.Fragment key={i}>{seg}</React.Fragment>;
        const colorIdx = Math.floor(i / 2);
        const color = style.colors[colorIdx] || 'var(--text-bright)';
        if (style.inlineTag) {
            return (
                <span
                    key={i}
                    className="font-data text-xs px-1.5 py-0.5 rounded"
                    style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
                >
                    {seg}
                </span>
            );
        }
        return (
            <span key={i} className="font-medium" style={{ color }}>
                {seg}
            </span>
        );
    });
};

/* ═══════════════════════════════════════════════════
   InfoPanel  ·  centered modal · 3 tabs
   ═══════════════════════════════════════════════════ */

const InfoPanel: React.FC<InfoPanelProps> = ({ isOpen, onClose }) => {
    const t = useI18n();
    const ip = t.infoPanel;
    const [activeTab, setActiveTab] = useState<Tab>('about');
    const [visible, setVisible] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => setVisible(true));
            setActiveTab('about');
            // Lock body scroll
            const prevOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = prevOverflow; };
        } else {
            setVisible(false);
        }
    }, [isOpen]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, [activeTab]);

    // ESC to close + focus trap
    useEffect(() => {
        if (!isOpen) return;
        const h = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [isOpen, onClose]);

    if (!isOpen && !visible) return null;

    /* ── static data ── */

    const updatesMeta = [
        { version: 'v3.5', date: '2026.03.14', tag: 'FIX', tagColor: 'var(--seeing-good)', icon: Shield },
        { version: 'v3.4', date: '2026.03.04', tag: 'FIX', tagColor: 'var(--seeing-good)', icon: Shield },
        { version: 'v3.3', date: '2026.03.04', tag: 'NEW', tagColor: 'var(--cyan)', icon: Cloud },
        { version: 'v3.2', date: '2026.03.01', tag: 'NEW', tagColor: 'var(--seeing-exceptional)', icon: Sun },
        { version: 'v3.1', date: '2026.03.01', tag: 'FIX', tagColor: 'var(--seeing-fair)', icon: Rocket },
        { version: 'v3.0', date: '2026.02.28', tag: 'MAJOR', tagColor: 'var(--warp-purple)', icon: Target },
    ];

    const guideIcons = ['🎯', '🪐', '🚀', '🌙', '📍'];
    const guideColors = [
        'var(--seeing-exceptional)',
        'var(--warp-purple)',
        'var(--accent)',
        'var(--cyan)',
        'var(--seeing-good)',
    ];

    const v3Emojis = ['🛡️', '🎯', '🌍', '☀️', '🚀'];

    const tabs: { id: Tab; icon: typeof Star; label: string }[] = [
        { id: 'about', icon: Heart, label: ip.tabs.about },
        { id: 'news', icon: Sparkles, label: ip.tabs.news },
        { id: 'guide', icon: BookOpen, label: ip.tabs.guide },
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
                    <div className="relative z-10 flex items-center justify-between px-5 sm:px-6 pt-7 sm:pt-6 pb-3">
                        <div className="flex items-center gap-3">
                            <img
                                src="/logo.webp"
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
                            TAB : About
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
                                        {ip.about.observatory}
                                    </p>
                                    <h3 className="text-2xl sm:text-[28px] font-bold tracking-tight mb-2 text-gradient-brand leading-tight">
                                        {ip.about.heroTitle}
                                    </h3>
                                    <p
                                        className="text-xs"
                                        style={{ color: 'var(--text-tertiary)' }}
                                    >
                                        {ip.about.heroDesc}
                                    </p>
                                </div>

                                {/* ── Prose paragraphs with StarDividers ── */}
                                {ip.about.prose.slice(0, 5).map((segments, pIdx) => (
                                    <React.Fragment key={pIdx}>
                                        <div style={stagger(pIdx * 2 + 1)}>
                                            <p
                                                className="text-sm leading-[2] font-light"
                                                style={{ color: 'var(--text-secondary)' }}
                                            >
                                                {renderProse(segments, pIdx)}
                                            </p>
                                        </div>
                                        <div style={stagger(pIdx * 2 + 2)}>
                                            <StarDivider />
                                        </div>
                                    </React.Fragment>
                                ))}

                                {/* Last two prose paragraphs in one block */}
                                <div style={stagger(11)}>
                                    <p
                                        className="text-sm leading-[2] font-light"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        {renderProse(ip.about.prose[5], 5)}
                                    </p>
                                    <p
                                        className="text-sm leading-[2] font-light mt-1"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        {renderProse(ip.about.prose[6], 6)}
                                    </p>
                                </div>

                                {/* ── Pomi Memorial ── */}
                                <div className="mt-6 text-center" style={stagger(11)}>
                                    <p className="text-[11px] italic" style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>
                                        {`"${ip.news.pomiMemorial}"`}
                                    </p>
                                    <p className="text-[10px] mt-1 font-data" style={{ color: 'var(--text-tertiary)', opacity: 0.5 }}>
                                        🐾 2025.7.30
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
                                        {ip.about.v3Title}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {ip.about.v3Features.map((f, i) => (
                                            <div
                                                key={i}
                                                className="rounded-xl px-3 py-3 transition-all hover:scale-[1.02]"
                                                style={{
                                                    background: 'rgba(255,255,255,0.025)',
                                                    border: '1px solid rgba(255,255,255,0.06)',
                                                }}
                                            >
                                                <span className="text-lg leading-none">
                                                    {v3Emojis[i]}
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
                                        {ip.about.siteDesc}
                                    </p>

                                    <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                                        {ip.about.hashtags.map((tag) => (
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
                            TAB : News
                           ════════════════════════════════════ */}
                        {activeTab === 'news' && (
                            <div className="px-5 sm:px-6 py-5 space-y-3">
                                {ip.news.updates.map((update, idx) => {
                                    const meta = updatesMeta[idx];
                                    if (!meta) return null;
                                    const Icon = meta.icon;
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
                                                            background: `color-mix(in srgb, ${meta.tagColor} 12%, transparent)`,
                                                            border: `1px solid color-mix(in srgb, ${meta.tagColor} 25%, transparent)`,
                                                        }}
                                                    >
                                                        <Icon
                                                            className="w-3.5 h-3.5"
                                                            style={{
                                                                color: meta.tagColor,
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
                                                                    color: meta.tagColor,
                                                                    background: `color-mix(in srgb, ${meta.tagColor} 10%, transparent)`,
                                                                }}
                                                            >
                                                                {meta.tag}
                                                            </span>
                                                        </div>
                                                        <p
                                                            className="text-[10px] font-data mt-0.5"
                                                            style={{
                                                                color: 'var(--text-tertiary)',
                                                            }}
                                                        >
                                                            {meta.version} ·{' '}
                                                            {meta.date}
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
                                                                color: meta.tagColor,
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
                                        ...stagger(ip.news.updates.length),
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
                                        {ip.news.dataSourceNote}
                                        <br />
                                        <span style={{ color: 'var(--accent)' }}>
                                            {ip.news.dataSourceFree}
                                        </span>
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ════════════════════════════════════
                            TAB : Guide
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
                                        {ip.guide.intro[0]}
                                        <span
                                            className="font-semibold"
                                            style={{
                                                color: 'var(--text-bright)',
                                            }}
                                        >
                                            {ip.guide.intro[1]}
                                        </span>
                                        {ip.guide.intro[2]}
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
                                        {ip.guide.gradeScaleTitle}
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
                                {ip.guide.cards.map((card, idx) => (
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
                                                {guideIcons[idx]}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span
                                                        className="text-sm font-semibold"
                                                        style={{
                                                            color: 'var(--text-bright)',
                                                        }}
                                                    >
                                                        {card.title}
                                                    </span>
                                                    <div className="flex flex-col items-end flex-shrink-0 ml-2">
                                                        <span
                                                            className="text-sm font-data font-bold"
                                                            style={{
                                                                color: guideColors[idx],
                                                            }}
                                                        >
                                                            {card.badge}
                                                        </span>
                                                        <span
                                                            className="text-[9px] font-data"
                                                            style={{
                                                                color: 'var(--text-tertiary)',
                                                            }}
                                                        >
                                                            {card.badgeLabel}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p
                                                    className="text-xs leading-relaxed"
                                                    style={{
                                                        color: 'var(--text-secondary)',
                                                    }}
                                                >
                                                    {card.desc}
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
                                        ...stagger(ip.guide.cards.length + 2),
                                    }}
                                >
                                    <p
                                        className="text-[11px]"
                                        style={{
                                            color: 'var(--text-tertiary)',
                                        }}
                                    >
                                        {ip.guide.contactObservatory}
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
