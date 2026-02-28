import React, { useState } from 'react';
import { X, Cpu, Thermometer, Wind, Activity, Brain, Globe } from 'lucide-react';

interface ModelInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Language = 'en' | 'kr';

const ModelInfoModal: React.FC<ModelInfoModalProps> = ({ isOpen, onClose }) => {
    const [lang, setLang] = useState<Language>('en');

    if (!isOpen) return null;

    const content = {
        en: {
            title: "USP-Model v1.0",
            subtitle: "Ultimate Seeing Prediction Engine",
            intro_title: "Overview",
            intro_text: "USP-Model v1.0 is a physics-based engine that simulates atmospheric turbulence beyond traditional weather forecasting. It analyzes real-time high-altitude meteorological data to quantify seeing conditions on a 10-point scale tailored for astrophotography.",
            feature1_title: "Physics-Based Turbulence",
            feature1_text: "Calculates turbulence by generating a Cn2 profile, representing refractive index variations across atmospheric layers.",
            feature2_title: "8-Layer Profiling",
            feature2_text: "Tracks wind speed and temperature gradients across 8 atmospheric layers from 1000hPa to 200hPa.",
            feature3_title: "Fried Parameter (r0)",
            feature3_text: "Real-time calculation of r0, determining the effective aperture limit of your telescope for maximum resolution.",
            feature4_title: "Ensemble Analysis",
            feature4_text: "Cross-references GFS, ECMWF, and 7Timer data streams for higher confidence predictions.",
            guide_title: "Observation Guide",
            guide_high: "Golden Hour: Extremely stable atmosphere. Perfect for high-resolution planetary imaging.",
            guide_mid: "Good Access: Sharp views overall. High magnification recommended.",
            guide_low: "High Turbulence: Blurry images. Better for wide-field targets.",
            confirm: "Got it"
        },
        kr: {
            title: "USP-Model v1.0",
            subtitle: "궁극의 시잉 예측 엔진",
            intro_title: "개요",
            intro_text: "USP-Model v1.0은 단순 기상 예보를 넘어 대기 난류(Turbulence)를 물리적으로 시뮬레이션하는 엔진입니다. 전 세계 고층 기상 데이터를 분석하여 관측지의 시잉 상태를 10점 만점으로 수치화합니다.",
            feature1_title: "물리 기반 난류 계산",
            feature1_text: "대기 굴절률 변화를 나타내는 Cn2 프로파일을 생성하여 실제 난류 발생량을 계산합니다.",
            feature2_title: "8단계 층별 분석",
            feature2_text: "1,000hPa부터 200hPa까지 8개 대기층의 풍속과 온도 기울기를 정밀 추적합니다.",
            feature3_title: "Fried Parameter (r0)",
            feature3_text: "망원경의 유효 구경 한계를 결정하는 r0 값을 산출하여 최대 도달 해상도를 예측합니다.",
            feature4_title: "앙상블 분석",
            feature4_text: "GFS, ECMWF, 7Timer 데이터 스트림을 교차 검증하여 높은 신뢰도의 예측을 제공합니다.",
            guide_title: "관측 가이드",
            guide_high: "Golden Hour: 극도로 안정된 상태. 행성 관측 최적.",
            guide_mid: "Good Access: 전반적으로 선명함. 고배율 권장.",
            guide_low: "High Turbulence: 상이 흐릿함. 광시야 관측 권장.",
            confirm: "확인"
        }
    };

    const t = content[lang];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-black/60 animate-fade-in" onClick={onClose}>
            <div
                className="glass-card w-full max-w-2xl overflow-hidden animate-scale-in"
                style={{ borderColor: 'rgba(129, 140, 248, 0.15)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 flex justify-between items-center border-b border-[var(--glass-border)]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-[var(--accent-glow)] border border-[var(--accent)]/20">
                            <Cpu className="w-5 h-5 text-[var(--accent)]" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-[var(--text-bright)]">{t.title}</h2>
                            <p className="text-xs font-data text-[var(--text-tertiary)] uppercase tracking-wider">{t.subtitle}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex bg-[var(--bg-surface)] rounded-full p-0.5 border border-[var(--glass-border)]">
                            <button
                                onClick={() => setLang('en')}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-full transition-all ${lang === 'en' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
                            >
                                EN
                            </button>
                            <button
                                onClick={() => setLang('kr')}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-full transition-all ${lang === 'kr' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
                            >
                                KR
                            </button>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-surface)] transition-colors">
                            <X className="w-5 h-5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto max-h-[70vh] space-y-6 custom-scrollbar">
                    <section>
                        <h3 className="text-xs font-semibold text-[var(--accent)] mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                            <Globe className="w-3.5 h-3.5" /> {t.intro_title}
                        </h3>
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{t.intro_text}</p>
                    </section>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                            { icon: <Wind className="w-4 h-4 text-blue-400" />, title: t.feature1_title, text: t.feature1_text },
                            { icon: <Thermometer className="w-4 h-4 text-red-400" />, title: t.feature2_title, text: t.feature2_text },
                            { icon: <Activity className="w-4 h-4 text-emerald-400" />, title: t.feature3_title, text: t.feature3_text },
                            { icon: <Brain className="w-4 h-4 text-[var(--accent)]" />, title: t.feature4_title, text: t.feature4_text },
                        ].map((feat, idx) => (
                            <div key={idx} className="glass-card-inner p-4">
                                <h4 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-bright)] mb-1.5">
                                    {feat.icon} {feat.title}
                                </h4>
                                <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">{feat.text}</p>
                            </div>
                        ))}
                    </div>

                    <div className="glass-card-inner p-4 border-l-2 border-[var(--accent)]">
                        <h4 className="text-sm font-semibold text-[var(--text-bright)] mb-2">{t.guide_title}</h4>
                        <ul className="space-y-1.5 text-sm text-[var(--text-tertiary)]">
                            <li className="flex gap-2">
                                <span className="font-data font-bold text-emerald-400 shrink-0">8.5+</span>
                                <span>{t.guide_high}</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="font-data font-bold text-amber-400 shrink-0">7.0+</span>
                                <span>{t.guide_mid}</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="font-data font-bold text-red-400 shrink-0">&lt;4.0</span>
                                <span>{t.guide_low}</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-[var(--glass-border)] text-center">
                    <button
                        onClick={onClose}
                        className="bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-white px-8 py-2 rounded-full font-medium text-sm transition-all hover:scale-105 active:scale-95"
                    >
                        {t.confirm}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModelInfoModal;
