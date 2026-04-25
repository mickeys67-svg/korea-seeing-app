/**
 * v5.0 Photo Guide — Natural Phenomena Service
 *
 * 자연현상 30일 캘린더 생성.
 * - Lunar eclipse (partial/total = Blood Moon)
 * - Global solar eclipse
 * - Supermoon (perigee + full moon 합치)
 * - Meteor shower (정적 캘린더 기반)
 *
 * 기존 astronomyService.js 무변경. 독립 모듈.
 */
const Astronomy = require('astronomy-engine');
const meteorCalendar = require('../../data/meteorShowers.json');

// ─── Helpers ──────────────────────────────────────────────────
function addDays(date, days) {
    return new Date(date.getTime() + days * 86400000);
}

function daysBetween(a, b) {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

/**
 * 관측 가능 판정: 달이 지평선 위에 있는지 (peak 시각 기준)
 */
function isMoonVisibleAt(peakDate, lat, lon) {
    try {
        const observer = new Astronomy.Observer(lat, lon, 0);
        const equ = Astronomy.Equator(Astronomy.Body.Moon, peakDate, observer, true, true);
        const hor = Astronomy.Horizon(peakDate, observer, equ.ra, equ.dec, 'normal');
        return {
            visible: hor.altitude > 0,
            altitude: hor.altitude,
            azimuth: hor.azimuth,
        };
    } catch (e) {
        return { visible: false, altitude: null, azimuth: null };
    }
}

function azimuthToDirection(az) {
    if (az == null) return null;
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(((az % 360) + 360) % 360 / 45) % 8;
    return dirs[idx];
}

// ─── Lunar Eclipses (30일 이내) ────────────────────────────────
function findLunarEclipses(startDate, lookaheadDays, lat, lon) {
    const out = [];
    try {
        let ev = Astronomy.SearchLunarEclipse(startDate);
        const endDate = addDays(startDate, lookaheadDays);
        let safety = 0;
        while (ev && ev.peak.date < endDate && safety < 10) {
            const peakDate = ev.peak.date;
            const vis = isMoonVisibleAt(peakDate, lat, lon);
            const isBloodMoon = ev.kind === 'total';
            out.push({
                type: isBloodMoon ? 'blood-moon' : `lunar-eclipse-${ev.kind}`,
                kind: ev.kind,
                obscuration: ev.obscuration,
                peakTime: peakDate.toISOString(),
                date: formatDate(peakDate),
                visible: vis.visible,
                altitude: vis.altitude,
                azimuth: vis.azimuth,
                direction: azimuthToDirection(vis.azimuth),
                durationPartialMin: ev.sd_partial * 2,
                durationTotalMin:   ev.sd_total * 2,
                dDay: daysBetween(startDate, peakDate),
            });
            ev = Astronomy.NextLunarEclipse(peakDate);
            safety++;
        }
    } catch (e) {
        // silent — phenomena data is non-critical
    }
    return out;
}

// ─── Solar Eclipses (90일 이내) ────────────────────────────────
function findSolarEclipses(startDate, lookaheadDays, lat, lon) {
    const out = [];
    try {
        let ev = Astronomy.SearchGlobalSolarEclipse(startDate);
        const endDate = addDays(startDate, lookaheadDays);
        let safety = 0;
        while (ev && ev.peak.date < endDate && safety < 5) {
            const peakDate = ev.peak.date;
            // 전지구 eclipse — lat/lon 근처에서 관측 가능한지는 간이 판정
            // (정확히는 LocalSolarEclipse 필요하지만 MVP에선 거리 기반 근사)
            let visibleHint = false;
            if (ev.latitude != null && ev.longitude != null) {
                const dLat = Math.abs(lat - ev.latitude);
                const dLon = Math.abs(lon - ev.longitude);
                visibleHint = (dLat < 30 && dLon < 60); // 대략적 관측 가능 지역
            }
            out.push({
                type: `solar-eclipse-${ev.kind}`,
                kind: ev.kind,
                obscuration: ev.obscuration,
                peakTime: peakDate.toISOString(),
                date: formatDate(peakDate),
                centralLat: ev.latitude,
                centralLon: ev.longitude,
                visibleHint,
                dDay: daysBetween(startDate, peakDate),
            });
            ev = Astronomy.NextGlobalSolarEclipse(peakDate);
            safety++;
        }
    } catch (e) {
        // silent
    }
    return out;
}

// ─── Supermoon (근지점 + 보름달) ───────────────────────────────
/**
 * 30일 이내 full moon이 apsis perigee 근처 (±24h) 인지 검사.
 * 슈퍼문 정의: Richard Nolle 관례 — 달-지구 거리가 근지점 90% 이내 full moon
 */
function findSupermoons(startDate, lookaheadDays, lat, lon) {
    const out = [];
    const endDate = addDays(startDate, lookaheadDays);

    try {
        // 1. Find upcoming full moons (phase 180°)
        let fullMoonTime = Astronomy.SearchMoonPhase(180, startDate, lookaheadDays);
        let safety = 0;
        while (fullMoonTime && fullMoonTime.date < endDate && safety < 6) {
            // 2. 해당 full moon 시각에 대한 달-지구 거리
            const illum = Astronomy.Illumination(Astronomy.Body.Moon, fullMoonTime.date);
            // 3. perigee 근처 판정: 가장 가까운 perigee 검색
            let apsis = Astronomy.SearchLunarApsis(addDays(fullMoonTime.date, -7));
            let closestPerigee = null;
            let apsisSafety = 0;
            while (apsis && apsisSafety < 8) {
                if (apsis.kind === Astronomy.ApsisKind.Pericenter) {
                    const delta = Math.abs(apsis.time.date.getTime() - fullMoonTime.date.getTime());
                    if (delta < 3 * 86400000) { // ±3일 이내
                        closestPerigee = apsis;
                        break;
                    }
                }
                if (apsis.time.date > addDays(fullMoonTime.date, 7)) break;
                apsis = Astronomy.NextLunarApsis(apsis);
                apsisSafety++;
            }

            if (closestPerigee) {
                // Nolle 기준: distance < 360,000 km
                const isSupermoon = closestPerigee.dist_km < 361000;
                if (isSupermoon) {
                    const vis = isMoonVisibleAt(fullMoonTime.date, lat, lon);
                    out.push({
                        type: 'supermoon',
                        peakTime: fullMoonTime.date.toISOString(),
                        date: formatDate(fullMoonTime.date),
                        distanceKm: Math.round(closestPerigee.dist_km),
                        illumination: illum.phase_fraction,
                        visible: vis.visible,
                        altitude: vis.altitude,
                        azimuth: vis.azimuth,
                        direction: azimuthToDirection(vis.azimuth),
                        dDay: daysBetween(startDate, fullMoonTime.date),
                    });
                }
            }

            // Next full moon (~29.5 days later)
            fullMoonTime = Astronomy.SearchMoonPhase(180, addDays(fullMoonTime.date, 20), 40);
            safety++;
        }
    } catch (e) {
        // silent
    }

    return out;
}

// ─── Meteor Showers (정적 캘린더 + 동적 moon 간섭) ──────────────
function findMeteorShowers(startDate, lookaheadDays, lat, lon) {
    const out = [];
    const endDate = addDays(startDate, lookaheadDays);
    const startYear = startDate.getUTCFullYear();

    for (const shower of meteorCalendar.showers) {
        // 올해/내년 peak 날짜 후보
        for (const year of [startYear, startYear + 1]) {
            const peakDate = new Date(Date.UTC(year, shower.peakMonth - 1, shower.peakDay, 0, 0, 0));
            if (peakDate < startDate || peakDate > endDate) continue;

            // Moon illumination at peak
            let moonFraction = null;
            try {
                const illum = Astronomy.Illumination(Astronomy.Body.Moon, peakDate);
                moonFraction = illum.phase_fraction;
            } catch (e) { /* ignore */ }

            // Observable quality: moonFraction < 0.3 + peak in lookahead = good
            const moonOk = moonFraction != null && moonFraction < 0.3;
            const observability = moonOk ? 'excellent' : moonFraction < 0.6 ? 'moderate' : 'poor';

            out.push({
                type: 'meteor-shower',
                showerId: shower.id,
                name: shower.name,
                peakTime: peakDate.toISOString(),
                date: formatDate(peakDate),
                zhr: shower.zhr,
                radiant: shower.radiant,
                velocityKms: shower.velocityKms,
                parentBody: shower.parentBody,
                moonFraction,
                observability,
                activeWindow: {
                    start: `${shower.activeStart.month}-${shower.activeStart.day}`,
                    end:   `${shower.activeEnd.month}-${shower.activeEnd.day}`,
                },
                dDay: daysBetween(startDate, peakDate),
            });
        }
    }
    return out;
}

// ─── 통합 API ─────────────────────────────────────────────────
/**
 * 다음 N일간 모든 자연현상 이벤트 수집.
 *
 * @param {Date} startDate
 * @param {number} lat
 * @param {number} lon
 * @param {number} lookaheadDays default 30
 * @returns {Array<object>}
 */
function getPhenomenaForecast(startDate, lat, lon, lookaheadDays = 30) {
    const events = [];
    try {
        events.push(...findLunarEclipses(startDate, lookaheadDays, lat, lon));
    } catch (e) { console.warn('[phenomena] lunar eclipse failed:', e.message); }
    try {
        // 일식은 드물기 때문에 90일 lookahead
        events.push(...findSolarEclipses(startDate, 90, lat, lon));
    } catch (e) { console.warn('[phenomena] solar eclipse failed:', e.message); }
    try {
        events.push(...findSupermoons(startDate, lookaheadDays, lat, lon));
    } catch (e) { console.warn('[phenomena] supermoon failed:', e.message); }
    try {
        events.push(...findMeteorShowers(startDate, lookaheadDays, lat, lon));
    } catch (e) { console.warn('[phenomena] meteor shower failed:', e.message); }

    // dDay ascending 정렬
    events.sort((a, b) => (a.dDay ?? 999) - (b.dDay ?? 999));
    return events;
}

module.exports = {
    getPhenomenaForecast,
    findLunarEclipses,
    findSolarEclipses,
    findSupermoons,
    findMeteorShowers,
};
