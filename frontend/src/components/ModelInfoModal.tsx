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
            title: "Warp AI: USP-Model v1.0",
            subtitle: "Ultimate Seeing Prediction Engine",
            intro_title: "Overview",
            intro_text: "At the heart of Warp AI, **USP-Model v1.0** is a next-generation engine that physically simulates atmospheric turbulence beyond traditional weather forecasting. It analyzes real-time high-altitude meteorological data globally to quantify seeing conditions on a 10-point scale tailored for astrophotography.",
            feature1_title: "Physics-Based Turbulence",
            feature1_text: "Calculates the actual amount of turbulence by generating a Cn2 profile, representing refractive index variations.",
            feature2_title: "8-Layer Profiling",
            feature2_text: "Precisely tracks wind speed and temperature gradients across 8 major atmospheric layers from 1000hPa to 200hPa.",
            feature3_title: "Fried Parameter (r₀)",
            feature3_text: "Real-time calculation of r₀, determining the effective aperture limit of your telescope for maximum resolution.",
            feature4_title: "Deep Learning Foundation",
            feature4_text: "Our neural network correlates physical metrics with real-world observation feedback to continuously refine prediction accuracy.",
            guide_title: "Observation Guide",
            guide_high: "Golden Hour: Extremely stable atmosphere. Perfect for planets.",
            guide_mid: "Good Access: Sharp views overall. High magnification recommended.",
            guide_low: "High Turbulence: Blurry images. Better for wide-field targets.",
            confirm: "Got it"
        },
        kr: {
            title: "Warp AI: USP-Model v1.0",
            subtitle: "궁극의 시잉 예측 엔진",
            intro_title: "개요",
            intro_text: "Warp AI의 심장인 **USP-Model v1.0**은 단순 기상 예보를 넘어 대기 난류(Turbulence)를 물리적으로 시뮬레이션하는 차세대 엔진입니다. 전 세계 고층 기상 데이터를 분석하여 관측지의 시잉 상태를 10점 만점으로 수치화합니다.",
            feature1_title: "물리 기반 난류 계산",
            feature1_text: "대기 굴절률 변화를 나타내는 Cn2 프로파일을 생성하여 실제 난류 발생량을 계산합니다.",
            feature2_title: "8단계 층별 분석",
            feature2_text: "1,000hPa부터 200hPa까지 8개 대기층의 풍속과 온도 기울기를 정밀 추적합니다.",
            feature3_title: "Fried Parameter (r₀)",
            feature3_text: "망원경의 유효 구경 한계를 결정하는 r₀ 값을 산출하여 최대 도달 해상도를 예측합니다.",
            feature4_title: "딥러닝 알고리즘 (AI)",
            feature4_text: "수집된 물리 지표와 관측 피드백을 신경망으로 학습하여 예측 정확도를 스스로 높여갑니다.",
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
                className="bg-slate-900 border border-purple-500/30 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-6 flex justify-between items-center border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <Cpu className="w-6 h-6 text-cyan-400" />
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight">{t.title}</h2>
                            <p className="text-xs text-purple-300 font-medium">{t.subtitle}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Language Toggle */}
                        <div className="flex bg-black/40 rounded-full p-1 border border-white/10">
                            <button
                                onClick={() => setLang('en')}
                                className={`px-2 py-1 text-[10px] font-black rounded-full transition-all ${lang === 'en' ? 'bg-cyan-500 text-white' : 'text-white/40 hover:text-white'}`}
                            >
                                EN
                            </button>
                            <button
                                onClick={() => setLang('kr')}
                                className={`px-2 py-1 text-[10px] font-black rounded-full transition-all ${lang === 'kr' ? 'bg-cyan-500 text-white' : 'text-white/40 hover:text-white'}`}
                            >
                                KR
                            </button>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors group"
                        >
                            <X className="w-6 h-6 text-white/50 group-hover:text-white" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[70vh] space-y-8 custom-scrollbar">
                    {/* Intro */}
                    <section>
                        <h3 className="text-cyan-400 text-sm font-bold mb-2 flex items-center gap-2">
                            <Globe className="w-4 h-4" /> {t.intro_title}
                        </h3>
                        <p className="text-slate-300 text-sm leading-relaxed">
                            {t.intro_text}
                        </p>
                    </section>

                    {/* Features Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                            <h4 className="flex items-center gap-2 text-white font-bold text-sm mb-2">
                                <Wind className="w-4 h-4 text-blue-400" /> {t.feature1_title}
                            </h4>
                            <p className="text-slate-400 text-xs leading-relaxed">
                                {t.feature1_text}
                            </p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                            <h4 className="flex items-center gap-2 text-white font-bold text-sm mb-2">
                                <Thermometer className="w-4 h-4 text-red-400" /> {t.feature2_title}
                            </h4>
                            <p className="text-slate-400 text-xs leading-relaxed">
                                {t.feature2_text}
                            </p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                            <h4 className="flex items-center gap-2 text-white font-bold text-sm mb-2">
                                <Activity className="w-4 h-4 text-green-400" /> {t.feature3_title}
                            </h4>
                            <p className="text-slate-400 text-xs leading-relaxed">
                                {t.feature3_text}
                            </p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 group/ai">
                            <h4 className="flex items-center gap-2 text-white font-bold text-sm mb-2">
                                <Brain className="w-4 h-4 text-purple-400 group-hover/ai:animate-pulse" /> {t.feature4_title}
                            </h4>
                            <p className="text-slate-400 text-xs leading-relaxed">
                                {t.feature4_text}
                            </p>
                        </div>
                    </div>

                    {/* Technical Info */}
                    <div className="bg-purple-900/20 p-5 rounded-2xl border border-purple-500/20">
                        <h4 className="text-white font-bold text-sm mb-3">{t.guide_title}</h4>
                        <ul className="space-y-2 text-xs text-slate-400">
                            <li className="flex gap-2">
                                <span className="text-cyan-400 font-bold whitespace-nowrap">8.5+</span>
                                <span>{t.guide_high}</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-yellow-400 font-bold whitespace-nowrap">7.0+</span>
                                <span>{t.guide_mid}</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-red-400 font-bold whitespace-nowrap">{"<"} 4.0</span>
                                <span>{t.guide_low}</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-900/50 text-center">
                    <button
                        onClick={onClose}
                        className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-10 py-2.5 rounded-full font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-cyan-500/20"
                    >
                        {t.confirm}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModelInfoModal;
