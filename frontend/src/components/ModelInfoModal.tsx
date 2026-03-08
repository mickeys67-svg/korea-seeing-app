import React, { useState } from 'react';
import { X, Cpu, Thermometer, Wind, Activity, Brain, Globe } from 'lucide-react';

interface ModelInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Language = 'en' | 'kr' | 'ja' | 'zh';

/* 브라우저 언어 감지 → 한/일/중은 각각, 나머지 EN */
const detectLang = (): Language => {
    const browserLang = (navigator.language || 'en').toLowerCase();
    if (browserLang.startsWith('ko')) return 'kr';
    if (browserLang.startsWith('ja')) return 'ja';
    if (browserLang.startsWith('zh')) return 'zh';
    return 'en';
};

const ModelInfoModal: React.FC<ModelInfoModalProps> = ({ isOpen, onClose }) => {
    const [lang, setLang] = useState<Language>(detectLang);

    if (!isOpen) return null;

    const content = {
        en: {
            title: "WARP AI Engine",
            subtitle: "Atmospheric Analysis Engine",
            intro_title: "Overview",
            intro_text: "WARP AI is a physics-based engine that simulates atmospheric turbulence for astronomical observation. It analyzes real-time meteorological data across multiple altitude layers to predict seeing conditions for astrophotography.",
            feature1_title: "Multi-Layer Analysis",
            feature1_text: "Analyzes atmospheric turbulence across multiple altitude layers by calculating refractive index variations in the atmosphere.",
            feature2_title: "Atmospheric Profiling",
            feature2_text: "Tracks wind speed and temperature gradients across multiple atmospheric layers from ground level to the upper atmosphere.",
            feature3_title: "Atmospheric Coherence",
            feature3_text: "Calculates the coherence length that determines the effective resolution limit of your telescope under current atmospheric conditions.",
            feature4_title: "Ensemble Analysis",
            feature4_text: "Cross-references multiple global weather data sources for higher confidence predictions.",
            guide_title: "Observation Guide",
            guide_high: "Golden Hour: Extremely stable atmosphere. Perfect for high-resolution planetary imaging.",
            guide_mid: "Good Conditions: Sharp views overall. High magnification recommended.",
            guide_low: "Unstable: Blurry images. Better for wide-field targets.",
            confirm: "Got it"
        },
        kr: {
            title: "WARP AI 엔진",
            subtitle: "대기 분석 엔진",
            intro_title: "개요",
            intro_text: "WARP AI는 천문 관측을 위해 대기 난류를 물리적으로 시뮬레이션하는 엔진입니다. 실시간 기상 데이터를 다층 분석하여 관측지의 시잉 상태를 예측합니다.",
            feature1_title: "다층 대기 분석",
            feature1_text: "대기 굴절률 변화를 계산하여 여러 고도층에 걸친 난류 발생량을 분석합니다.",
            feature2_title: "대기 프로파일링",
            feature2_text: "지상부터 상층 대기까지 여러 대기층의 풍속과 온도 기울기를 정밀 추적합니다.",
            feature3_title: "대기 코히런스",
            feature3_text: "현재 대기 조건에서 망원경의 유효 해상도 한계를 결정하는 대기 코히런스 길이를 산출합니다.",
            feature4_title: "앙상블 분석",
            feature4_text: "여러 글로벌 기상 데이터를 교차 검증하여 높은 신뢰도의 예측을 제공합니다.",
            guide_title: "관측 가이드",
            guide_high: "최적 조건: 극도로 안정된 대기. 고해상도 행성 촬영에 최적.",
            guide_mid: "양호한 조건: 전반적으로 선명. 고배율 관측 권장.",
            guide_low: "불안정: 상이 흐릿함. 광시야 관측 권장.",
            confirm: "확인"
        },
        ja: {
            title: "WARP AI エンジン",
            subtitle: "大気分析エンジン",
            intro_title: "概要",
            intro_text: "WARP AIは天文観測のために大気乱流を物理的にシミュレーションするエンジンです。リアルタイム気象データを多層分析し、観測地のシーイング状態を予測します。",
            feature1_title: "多層大気分析",
            feature1_text: "大気屈折率の変化を計算し、複数の高度層にわたる乱流を分析します。",
            feature2_title: "大気プロファイリング",
            feature2_text: "地上から上層大気まで、複数の大気層の風速と温度勾配を精密に追跡します。",
            feature3_title: "大気コヒーレンス",
            feature3_text: "現在の大気条件における望遠鏡の有効解像度限界を決定するコヒーレンス長を算出します。",
            feature4_title: "アンサンブル分析",
            feature4_text: "複数のグローバル気象データを交差検証し、高信頼度の予測を提供します。",
            guide_title: "観測ガイド",
            guide_high: "最適条件：極めて安定した大気。高解像度惑星撮影に最適。",
            guide_mid: "良好な条件：全体的に鮮明。高倍率観測推奨。",
            guide_low: "不安定：像がぼやける。広視野対象向き。",
            confirm: "確認"
        },
        zh: {
            title: "WARP AI 引擎",
            subtitle: "大气分析引擎",
            intro_title: "概述",
            intro_text: "WARP AI是一个物理模拟大气湍流的天文观测引擎。通过多层分析实时气象数据，预测观测地点的视宁度状态。",
            feature1_title: "多层大气分析",
            feature1_text: "通过计算大气折射率变化，分析多个高度层的湍流发生量。",
            feature2_title: "大气剖面",
            feature2_text: "从地面到高层大气，精密追踪多个大气层的风速和温度梯度。",
            feature3_title: "大气相干性",
            feature3_text: "计算当前大气条件下决定望远镜有效分辨率极限的相干长度。",
            feature4_title: "集成分析",
            feature4_text: "交叉验证多个全球气象数据源，提供高置信度预测。",
            guide_title: "观测指南",
            guide_high: "最佳条件：极其稳定的大气。适合高分辨率行星成像。",
            guide_mid: "良好条件：整体清晰。推荐高倍率观测。",
            guide_low: "不稳定：图像模糊。建议广视野目标。",
            confirm: "确认"
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
                            {(['en', 'kr', 'ja', 'zh'] as Language[]).map((l) => (
                                <button
                                    key={l}
                                    onClick={() => setLang(l)}
                                    className={`px-2 py-1 text-[10px] font-bold rounded-full transition-all ${lang === l ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
                                >
                                    {l.toUpperCase()}
                                </button>
                            ))}
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
