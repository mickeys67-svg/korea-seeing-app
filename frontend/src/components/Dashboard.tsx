import React, { lazy, Suspense } from 'react';
import SeeingDetails from './SeeingDetails';
import MoonPhase from './MoonPhase';
// NotificationSetup removed — no actual notification logic implemented
import AiPrediction from './AiPrediction';
import ForecastList from './ForecastList';
import InfoPanel from './InfoPanel';
import { Loader2, MapPin, Info, Camera } from 'lucide-react';
import useGeolocation from '../hooks/useGeolocation';
import useWeatherData from '../hooks/useWeatherData';
import useI18n from '../hooks/useI18n';

// v5.0 Photo Guide — lazy (code-split) so bundle stays unchanged until user opens modal
const PhotoGuideModal = lazy(() => import('../features/photo-guide/PhotoGuideModal'));

const Dashboard: React.FC = () => {
    const location = useGeolocation();
    const t = useI18n();
    const [infoPanelOpen, setInfoPanelOpen] = React.useState(false);
    const [photoGuideOpen, setPhotoGuideOpen] = React.useState(false);
    const defaultLat = 37.5665;
    const defaultLon = 126.9780;

    const lat = location.loaded
        ? (location.val ? location.val.lat : defaultLat)
        : null;
    const lon = location.loaded
        ? (location.val ? location.val.lon : defaultLon)
        : null;

    const { data, loading, error, stale } = useWeatherData(lat, lon);

    if (loading || !location.loaded) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full border-2 border-indigo-500/20 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                    </div>
                    <div className="absolute inset-0 rounded-full animate-pulse-ring" />
                </div>
                <p className="text-sm text-[var(--text-secondary)] font-mono tracking-wider">{t.common.loading}</p>
            </div>
        );
    }

    if (error && !loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                    <span className="text-red-400 text-xl">!</span>
                </div>
                <p className="text-red-400/80 text-sm text-center max-w-sm">{error}</p>
            </div>
        );
    }

    if (!data) return null;

    const currentForecast = data.forecast && data.forecast.length > 0 ? data.forecast[0] : null;

    // 현재 시간이 낮(일출~일몰)인지 판단 — location timezone 기반 비교
    const todayAstro = data.astronomy?.[0];
    const locationTz = data.location?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const isDaytime = (() => {
        if (!todayAstro?.sun?.sunrise || !todayAstro?.sun?.sunset) return false;
        if (todayAstro.sun.alwaysDown) return false;
        if (todayAstro.sun.alwaysUp) return true;
        // sunrise/sunset are ISO strings from backend (UTC), compare directly
        const now = new Date();
        const sunrise = new Date(todayAstro.sun.sunrise as string);
        const sunset = new Date(todayAstro.sun.sunset as string);
        return now >= sunrise && now <= sunset;
    })();

    const getGradeBgClass = (grade: string) => {
        switch (grade) {
            case 'S': return 'grade-bg-s';
            case 'A': return 'grade-bg-a';
            case 'B': return 'grade-bg-b';
            case 'C': return 'grade-bg-c';
            default: return 'grade-bg-d';
        }
    };

    return (
        <main className={`flex flex-col items-center w-full max-w-5xl mx-auto px-4 py-6 sm:px-6 bg-dot-pattern min-h-screen ${currentForecast ? getGradeBgClass(currentForecast.grade) : ''}`}>

            {/* ===== Header ===== */}
            <header className="w-full flex justify-between items-center mb-8 animate-fade-in-up">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <img src="/logo.webp" alt="Clear Skies — Astronomical Seeing Forecast" width="48" height="48" className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl object-cover shadow-lg shadow-indigo-500/20" />
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[var(--bg-void)]" />
                    </div>
                    <div>
                        <h1 className="text-xl lg:text-2xl font-bold text-[var(--text-bright)] tracking-tight">
                            Clear Skies <span className="text-[var(--accent)]">!</span>
                        </h1>
                        <div className="flex items-center gap-1.5 text-[var(--text-secondary)] text-xs lg:text-sm">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate max-w-[200px]">
                                {location.name || t.common.defaultCity}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {data?.apiHealth && (() => {
                        // 상태등은 '예보가 정상인가'를 뜻한다. 핵심 예보 소스(Open-Meteo/7Timer/
                        // Met.no) 중 하나라도 살아있으면 정상(OK). KMA·METAR·공기질·앙상블은
                        // 선택적 보강재라 없어도 '지연'으로 깎지 않는다(있으면 정확도만 올림).
                        // 이렇게 해야 핵심 예보가 멀쩡한데 보강재 하나 빠졌다고 가짜 경보가 안 뜬다.
                        const CORE = ['timer', 'openmeteo', 'metno'];
                        const srcNames = t.apiHealth.sources as Record<string, string>;
                        const core = Object.entries(data.apiHealth).filter(([k, v]) => CORE.includes(k) && v !== null);
                        const healthy = core.some(([, v]) => v === true);
                        const down = core.filter(([, v]) => v === false).map(([k]) => srcNames[k] ?? k);
                        const label = healthy ? t.apiHealth.ok : `${down.join('·')} ${t.apiHealth.delayed}`;
                        return (
                            <div className="flex items-center gap-1.5" title={healthy ? t.apiHealth.ok : `${down.join(', ')} ${t.apiHealth.delayed}`}>
                                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{
                                    background: healthy ? '#10b981' : '#f59e0b',
                                    boxShadow: healthy ? '0 0 6px #10b981' : '0 0 6px #f59e0b',
                                }} />
                                <span className="text-[10px] font-medium" style={{
                                    color: healthy ? '#10b981' : '#f59e0b',
                                }}>
                                    {label}
                                </span>
                            </div>
                        );
                    })()}
                    <button
                        onClick={() => setPhotoGuideOpen(true)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--glass-border)',
                            color: '#f59e0b',
                        }}
                        title="Photo Guide"
                        aria-label="Photo Guide"
                    >
                        <Camera className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setInfoPanelOpen(true)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--text-tertiary)',
                        }}
                        title="앱 소개 & 업데이트"
                    >
                        <Info className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {stale && (
                <div className="w-full mb-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs text-center">
                    서버 연결 불가 — 이전 데이터를 표시하고 있습니다. 새로고침하면 최신 데이터를 시도합니다.
                </div>
            )}

            {/* ===== Hero: Observation Score ===== */}
            {currentForecast && (
                <SeeingDetails
                    data={currentForecast}
                    moonFraction={data.astronomy?.[0]?.moon?.fraction ?? 0.5}
                    isDaytime={isDaytime}
                    sunsetTime={todayAstro?.sun?.sunset as string | null | undefined}
                    timezone={locationTz}
                    lat={lat ?? undefined}
                    lon={lon ?? undefined}
                />
            )}

            {/* ===== Forecast Timeline ===== */}
            {data.forecast && (
                <ForecastList
                    forecast={data.forecast.slice(0, 72)}
                    timezone={data.location.timezone}
                    astronomy={data.astronomy}
                />
            )}

            {/* ===== AI Prediction ===== */}
            {data.forecast && data.forecast.length > 0 && (
                <AiPrediction
                    forecastList={data.forecast}
                    timezone={data.location.timezone}
                    aiSummary={data.aiSummary}
                    astronomy={data.astronomy}
                />
            )}

            {/* ===== Astronomy ===== */}
            {data.astronomy && <MoonPhase data={data.astronomy} timezone={data.location.timezone} lat={lat ?? undefined} lon={lon ?? undefined} />}

            {/* NotificationSetup removed — will be re-added when actual push notification logic is implemented */}

            {/* Info Panel */}
            <InfoPanel isOpen={infoPanelOpen} onClose={() => setInfoPanelOpen(false)} />

            {/* v5.0 Photo Guide Modal — lazy mount, network request only when opened */}
            {photoGuideOpen && (
                <Suspense fallback={null}>
                    <PhotoGuideModal
                        lat={lat}
                        lon={lon}
                        onClose={() => setPhotoGuideOpen(false)}
                    />
                </Suspense>
            )}

            {/* SEO — hidden text for crawlers */}
            <div className="sr-only" aria-hidden="true">
                <h2>Clear Skies — Astronomical Seeing Forecast</h2>
                <p>Free precision seeing forecast for astrophotographers and amateur astronomers. Real-time observation quality scoring with target suitability analysis.</p>
                <ul>
                    <li>Astronomical seeing (FWHM) estimation and Pickering/Antoniadi scale</li>
                    <li>Target suitability: planets, Milky Way, nebulae, star clusters, galaxies</li>
                    <li>Jet stream (250hPa), CAPE convection, sky transparency, cloud cover</li>
                    <li>Moon phase forecast with optimal dark-sky observation windows</li>
                    <li>City-based location selection with astronomical twilight detection</li>
                    <li>Multi-source atmospheric data integration</li>
                    <li>Atmospheric scintillation and boundary layer turbulence analysis</li>
                </ul>
            </div>

            {/* Footer */}
            <footer className="mt-12 mb-8 text-center animate-fade-in">
                <p className="text-xs lg:text-sm font-mono text-[var(--text-tertiary)] tracking-widest uppercase">
                    Clear Skies v3.5 &middot; Forme Observatory &middot; Ganghwado Island, Republic of Korea
                </p>
                <p className="text-xs lg:text-sm text-[var(--text-tertiary)] mt-2">
                    {t.footer.feedback}{' '}
                    <a href="mailto:mickeys67@gmail.com" className="text-[var(--accent)] hover:underline">mickeys67@gmail.com</a>
                </p>
            </footer>
        </main>
    );
};

export default Dashboard;
