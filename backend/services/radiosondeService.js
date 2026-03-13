/**
 * RadiosondeService — KMA 고층관측(라디오존데) 실측 수직 프로파일
 * API: apihub.kma.go.kr/api/typ01/url/upp_temp.php
 * 관측: 일 2회 정기(00Z=09KST, 12Z=21KST) + 특별관측(06Z, 18Z)
 * 데이터: 지상~30km 기압·기온·이슬점·풍향·풍속 (표준등압면 + 유의고도)
 */
const axios = require('axios');

// ═══ 한국 라디오존데 관측소 (9개소) ═══
// WMO ID, 이름, 위경도
const STATIONS = [
    { id: '47102', name: '백령도',   lat: 37.97, lon: 124.63 },
    { id: '47104', name: '북강릉',   lat: 37.75, lon: 128.89 },
    { id: '47135', name: '흥해',     lat: 36.17, lon: 129.37 },
    { id: '47138', name: '포항',     lat: 36.03, lon: 129.38 },
    { id: '47155', name: '창원',     lat: 35.17, lon: 128.57 },
    { id: '47169', name: '흑산도',   lat: 34.69, lon: 125.45 },
    { id: '47186', name: '고산',     lat: 33.29, lon: 126.16 },
    { id: '47230', name: '국가태풍센터', lat: 33.25, lon: 126.57 },
    { id: '47269', name: '덕적도',   lat: 37.24, lon: 126.02 },
];

// ═══ In-memory cache (라디오존데 데이터는 6~12시간 유효) ═══
let _cache = { data: null, ts: 0, obsTime: null };
const CACHE_TTL = 30 * 60 * 1000; // 30분 — 같은 관측 시각 데이터 재요청 방지

const RadiosondeService = {
    /**
     * 한국 좌표인지 확인
     */
    isKorea(lat, lon) {
        return lat >= 33 && lat <= 39 && lon >= 124 && lon <= 132;
    },

    /**
     * 가장 가까운 관측소 찾기
     */
    findNearestStation(lat, lon) {
        let best = null;
        let minDist = Infinity;
        for (const stn of STATIONS) {
            const d = Math.pow(lat - stn.lat, 2) + Math.pow(lon - stn.lon, 2);
            if (d < minDist) { minDist = d; best = stn; }
        }
        return { station: best, distDeg: Math.sqrt(minDist) };
    },

    /**
     * 최신 관측 시각 (UTC) 계산
     * 정기관측: 00Z(09KST), 12Z(21KST)
     * 현재 시각에서 가장 가까운 과거 관측 시각 반환
     */
    _getLatestObsTime() {
        const now = new Date();
        const utcH = now.getUTCHours();
        const y = now.getUTCFullYear();
        const m = String(now.getUTCMonth() + 1).padStart(2, '0');
        const d = String(now.getUTCDate()).padStart(2, '0');

        // 관측 시각: 00Z, 12Z (데이터 가용: 관측 후 ~1.5시간)
        // 00Z 데이터 → 약 01:30Z부터 가용, 12Z 데이터 → 약 13:30Z부터 가용
        if (utcH >= 14) return `${y}${m}${d}1200`;
        if (utcH >= 2)  return `${y}${m}${d}0000`;
        // 자정~02Z → 전날 12Z
        const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
        const yy = yesterday.getUTCFullYear();
        const ym = String(yesterday.getUTCMonth() + 1).padStart(2, '0');
        const yd = String(yesterday.getUTCDate()).padStart(2, '0');
        return `${yy}${ym}${yd}1200`;
    },

    /**
     * API 호출 — 전체 관측소 전체 고도
     */
    async _fetchRaw(obsTime) {
        const apiKey = process.env.KMA_UPP_API_KEY;
        if (!apiKey) return null;

        const url = `https://apihub.kma.go.kr/api/typ01/url/upp_temp.php?tm=${obsTime}&stn=0&pa=0&authKey=${apiKey}`;
        const response = await axios.get(url, { timeout: 10000 });
        return response.data;
    },

    /**
     * 텍스트 응답 파싱
     * 형식: YYMMDDHHMI STN PA GH TA TD WD WS FLAG
     */
    _parse(text) {
        if (!text || typeof text !== 'string') return {};

        const stations = {};
        const lines = text.split('\n');

        for (const line of lines) {
            // 데이터 행: 숫자로 시작 (코멘트/빈줄 스킵)
            if (!/^\d{12}\s/.test(line.trim())) continue;

            const parts = line.trim().split(/\s+/);
            if (parts.length < 9) continue;

            const [tm, stn, pa, gh, ta, td, wd, ws, flag] = parts;
            const paVal  = parseFloat(pa);
            const ghVal  = parseFloat(gh);
            const taVal  = parseFloat(ta);
            const tdVal  = parseFloat(td);
            const wdVal  = parseFloat(wd);
            const wsVal  = parseFloat(ws);

            // -999.0 = 결측
            if (!stations[stn]) stations[stn] = [];
            stations[stn].push({
                pa:   paVal > -900 ? paVal : null,
                gh:   ghVal > -900 ? ghVal : null,
                ta:   taVal > -900 ? taVal : null,
                td:   tdVal > -900 ? tdVal : null,
                wd:   wdVal > -900 ? wdVal : null,
                ws:   wsVal > -900 ? wsVal : null,
                flag: flag || '',
                isStandard: flag && flag[1] === '1',  // 표준등압면 (FLAG 2번째 자리)
            });
        }

        return stations;
    },

    /**
     * 표준등압면 데이터로 USP 모델용 레이어 생성
     * 각 인접 레이어 간 wind shear, Richardson number, TKE 계산
     */
    _buildLayers(records) {
        // 표준등압면 + TA, WS 모두 있는 레코드만 (GH도 필요)
        // 대류권만 사용 (≥100hPa, ~16km) — 성층권은 seeing에 영향 미미
        const valid = records.filter(r =>
            r.isStandard && r.gh != null && r.ta != null && r.ws != null && r.pa >= 100
        ).sort((a, b) => b.pa - a.pa); // 고기압(저고도) → 저기압(고고도)

        if (valid.length < 2) return [];

        const layers = [];
        for (let i = 0; i < valid.length - 1; i++) {
            const lower = valid[i];
            const upper = valid[i + 1];

            const dz = upper.gh - lower.gh;
            if (dz <= 0) continue;

            const windShear = (upper.ws - lower.ws) / dz;
            const dT = upper.ta - lower.ta;
            const avgT = (lower.ta + upper.ta) / 2 + 273.15;
            const ri = (9.8 / avgT) * (dT / dz) / Math.pow(windShear || 0.001, 2);

            // TKE from shear + stability
            const shearTKE = Math.pow(Math.abs(windShear) * dz, 2) * 0.1;
            let stabilityFactor;
            if (ri > 0.25) stabilityFactor = 0.3;       // stable
            else if (ri > 0) stabilityFactor = 0.7;      // neutral
            else stabilityFactor = 1.5;                   // unstable
            const tke = Math.max(0.05, Math.min(3.0, shearTKE * stabilityFactor));

            layers.push({
                tke, windShear, ri, dz,
                paLower: lower.pa, paUpper: upper.pa,
                ghLower: lower.gh, ghUpper: upper.gh,
                source: 'radiosonde'
            });
        }
        return layers;
    },

    /**
     * 메인 함수 — 실측 수직 프로파일 가져오기
     * @param {number} lat
     * @param {number} lon
     * @returns {object|null} { layers, station, obsTime, jetStreamSpeed, maxWindSpeed, tropopause }
     */
    async fetchProfile(lat, lon) {
        if (!this.isKorea(lat, lon)) return null;
        if (!process.env.KMA_UPP_API_KEY) return null;

        const obsTime = this._getLatestObsTime();

        // 캐시 확인
        if (_cache.data && _cache.obsTime === obsTime && Date.now() - _cache.ts < CACHE_TTL) {
            return this._extractForLocation(_cache.data, lat, lon, obsTime);
        }

        try {
            const raw = await this._fetchRaw(obsTime);
            if (!raw) return null;

            const parsed = this._parse(raw);
            if (Object.keys(parsed).length === 0) return null;

            _cache = { data: parsed, ts: Date.now(), obsTime };
            console.log(`[Radiosonde] Fetched ${Object.keys(parsed).length} stations, obs=${obsTime}`);

            return this._extractForLocation(parsed, lat, lon, obsTime);
        } catch (err) {
            console.warn(`[Radiosonde] Fetch failed: ${err.message}`);
            return null;
        }
    },

    /**
     * 파싱된 데이터에서 가장 가까운 관측소의 프로파일 추출
     */
    _extractForLocation(parsed, lat, lon, obsTime) {
        const { station, distDeg } = this.findNearestStation(lat, lon);
        if (!station) return null;

        // 관측소에서 3도(~330km) 이상 떨어지면 신뢰도 낮음
        if (distDeg > 3.0) return null;

        const records = parsed[station.id];
        if (!records || records.length === 0) return null;

        const layers = this._buildLayers(records);
        if (layers.length === 0) return null;

        // 추가 정보 추출
        // 제트기류: 250hPa 풍속 (표준등압면)
        const jet250 = records.find(r => r.isStandard && r.pa != null && Math.abs(r.pa - 250) < 5 && r.ws != null);
        // 최대풍 (FLAG[5] = '1')
        const maxWind = records.find(r => r.flag && r.flag[5] === '1' && r.ws != null);
        // 권계면 (FLAG[4] = '1')
        const tropopause = records.find(r => r.flag && r.flag[4] === '1');

        const result = {
            layers,
            station: { id: station.id, name: station.name, distKm: Math.round(distDeg * 111) },
            obsTime,
            layerCount: layers.length,
            // 250hPa 제트기류 (m/s → kt for USP model)
            jetStreamSpeed: jet250 ? Math.round(jet250.ws * 1.94384) : null,
            // 최대풍
            maxWind: maxWind ? { speed: maxWind.ws, height: maxWind.gh, pa: maxWind.pa } : null,
            // 권계면
            tropopause: tropopause ? { ta: tropopause.ta, gh: tropopause.gh, pa: tropopause.pa } : null,
        };

        console.log(`[Radiosonde] ${station.name}(${station.id}), ${layers.length} layers, jet=${result.jetStreamSpeed}kt, dist=${result.station.distKm}km`);
        return result;
    }
};

module.exports = RadiosondeService;
