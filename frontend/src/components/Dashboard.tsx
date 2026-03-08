import React from 'react';
import SeeingDetails from './SeeingDetails';
import MoonPhase from './MoonPhase';
// NotificationSetup removed — no actual notification logic implemented
import AiPrediction from './AiPrediction';
import ForecastList from './ForecastList';
import InfoPanel from './InfoPanel';
import { Loader2, MapPin, X, Info, Cloud } from 'lucide-react';
import useGeolocation from '../hooks/useGeolocation';
import useWeatherData from '../hooks/useWeatherData';
import useI18n from '../hooks/useI18n';

const Dashboard: React.FC = () => {
    const location = useGeolocation();
    const t = useI18n();
    const [gpsBannerDismissed, setGpsBannerDismissed] = React.useState(false);
    const [infoPanelOpen, setInfoPanelOpen] = React.useState(false);
    const [updatePopupVisible, setUpdatePopupVisible] = React.useState(() => {
        try { return !localStorage.getItem('clearsky-update-v3.4-seen'); } catch { return true; }
    });
    const defaultLat = 37.5665;
    const defaultLon = 126.9780;

    const lat = location.loaded
        ? (location.val ? location.val.lat : defaultLat)
        : null;
    const lon = location.loaded
        ? (location.val ? location.val.lon : defaultLon)
        : null;

    const { data, loading, error } = useWeatherData(lat, lon);

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

    if (error) {
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
        <div className={`flex flex-col items-center w-full max-w-5xl mx-auto px-4 py-6 sm:px-6 bg-dot-pattern min-h-screen ${currentForecast ? getGradeBgClass(currentForecast.grade) : ''}`}>

            {/* ===== Header ===== */}
            <header className="w-full flex justify-between items-center mb-8 animate-fade-in-up">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <img src="/logo.jpg" alt="Clear Skies" className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl object-cover shadow-lg shadow-indigo-500/20" />
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[var(--bg-void)]" />
                    </div>
                    <div>
                        <h1 className="text-xl lg:text-2xl font-bold text-[var(--text-bright)] tracking-tight">
                            Clear Skies <span className="text-[var(--accent)]">!</span>
                        </h1>
                        <div className="flex items-center gap-1.5 text-[var(--text-secondary)] text-xs lg:text-sm">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate max-w-[200px]">
                                {location.name || (location.val ? t.common.gpsLocation : t.common.defaultCity)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {data?.apiHealth && (() => {
                        const vals = Object.values(data.apiHealth);
                        const healthy = vals.length > 0 && vals.every(Boolean);
                        return (
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{
                                    background: healthy ? '#10b981' : '#f59e0b',
                                    boxShadow: healthy ? '0 0 6px #10b981' : '0 0 6px #f59e0b',
                                }} />
                                <span className="text-[10px] font-medium" style={{
                                    color: healthy ? '#10b981' : '#f59e0b',
                                }}>
                                    {healthy ? t.apiHealth.ok : t.apiHealth.recovering}
                                </span>
                            </div>
                        );
                    })()}
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

            {/* ===== GPS Permission Denied Banner ===== */}
            {location.error && !location.val && !gpsBannerDismissed && (
                <div className="w-full mb-4 animate-fade-in-up">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                        <MapPin className="w-4 h-4 text-amber-400/80 shrink-0" />
                        <p className="text-xs lg:text-sm text-[var(--text-secondary)] flex-1">
                            <span className="text-amber-400/90 font-semibold">{t.gpsBanner.title}</span>
                            {' '}{t.gpsBanner.message}
                        </p>
                        <button
                            onClick={() => setGpsBannerDismissed(true)}
                            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors shrink-0"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* ===== Hero: Observation Score ===== */}
            {currentForecast && (
                <SeeingDetails
                    data={currentForecast}
                    moonFraction={data.astronomy?.[0]?.moon.fraction ?? 0.5}
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

            {/* ===== Update Popup (v3.3 Cloud Model) ===== */}
            {updatePopupVisible && (
                <div
                    className="fixed left-1/2 z-50 w-[calc(100%-2rem)] max-w-xs animate-fade-in-up"
                    style={{ transform: 'translateX(-50%)', bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
                >
                    <div
                        className="relative rounded-2xl px-4 py-3.5 backdrop-blur-xl text-center"
                        style={{
                            background: 'linear-gradient(170deg, rgba(14,18,38,0.96) 0%, rgba(10,14,30,0.98) 100%)',
                            border: '1px solid rgba(34,211,238,0.2)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(34,211,238,0.08)',
                        }}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => {
                                setUpdatePopupVisible(false);
                                try { localStorage.setItem('clearsky-update-v3.4-seen', '1'); } catch {}
                            }}
                            className="absolute top-2.5 right-2.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                        {/* Top accent line */}
                        <div
                            className="absolute top-0 left-6 right-6 h-px"
                            style={{ background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.4), transparent)' }}
                        />
                        {/* Icon + Badge */}
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{
                                    background: 'rgba(34,211,238,0.1)',
                                    border: '1px solid rgba(34,211,238,0.2)',
                                }}
                            >
                                <Cloud className="w-3.5 h-3.5" style={{ color: 'var(--cyan)' }} />
                            </div>
                            <span
                                className="text-[9px] font-bold font-data px-1.5 py-0.5 rounded"
                                style={{ color: 'var(--cyan)', background: 'rgba(34,211,238,0.1)' }}
                            >
                                {t.updatePopup.badge}
                            </span>
                        </div>
                        {/* Title */}
                        <p className="text-sm font-bold mb-1.5" style={{ color: 'var(--text-bright)' }}>
                            {t.updatePopup.title}
                        </p>
                        {/* Description */}
                        <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                            {t.updatePopup.desc}
                        </p>
                        {/* Dismiss button */}
                        <button
                            onClick={() => {
                                setUpdatePopupVisible(false);
                                try { localStorage.setItem('clearsky-update-v3.4-seen', '1'); } catch {}
                            }}
                            className="px-5 py-1.5 rounded-lg text-xs font-bold transition-all hover:brightness-110 active:scale-95"
                            style={{
                                background: 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(99,102,241,0.15))',
                                border: '1px solid rgba(34,211,238,0.25)',
                                color: 'var(--cyan)',
                            }}
                        >
                            {t.updatePopup.dismiss}
                        </button>
                    </div>
                </div>
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
                    <li>GPS auto-location with astronomical twilight detection</li>
                    <li>Multi-source data: GFS, ECMWF, 7Timer, Open-Meteo, Met.no</li>
                    <li>Atmospheric scintillation and boundary layer turbulence analysis</li>
                </ul>
            </div>

            {/* Footer */}
            <footer className="mt-12 mb-8 text-center animate-fade-in">
                <p className="text-xs lg:text-sm font-mono text-[var(--text-tertiary)] tracking-widest uppercase">
                    Clear Skies v3.4 &middot; Forme Observatory &middot; Ganghwado Island, Republic of Korea
                </p>
                <p className="text-xs lg:text-sm text-[var(--text-tertiary)] mt-2">
                    {t.footer.feedback}{' '}
                    <a href="mailto:mickeys67@gmail.com" className="text-[var(--accent)] hover:underline">mickeys67@gmail.com</a>
                </p>
            </footer>
        </div>
    );
};

export default Dashboard;
