// native fetch (Node 18+)

// ═══ Open-Meteo Ensemble API ═══
// 다중 NWP 모델 멤버 조회 → 비관적(max) 구름 값 산출
// 엔드포인트: https://ensemble-api.open-meteo.com/v1/ensemble
// 무료, API키 불필요, 전세계 커버리지

const ENSEMBLE_BASE = 'https://ensemble-api.open-meteo.com/v1/ensemble';

// 전세계 커버 가능한 글로벌 모델만 사용
// ECMWF IFS(51멤버) + GFS(31멤버) + ICON(40멤버) = 122개 독립 예측
const MODELS = 'ecmwf_ifs025,gfs025,icon_seamless';

/**
 * Ensemble API에서 다중 모델 구름 데이터 조회
 * @param {number} lat
 * @param {number} lon
 * @returns {{ hourlyTimes: string[], maxCloud: number[], meanCloud: number[], spread: number[] } | null}
 */
async function fetchEnsembleCloud(lat, lon) {
    // timezone=GMT → 시간을 항상 UTC로 반환 (Cloud Run 서버 위치와 무관)
    const url = `${ENSEMBLE_BASE}?latitude=${lat}&longitude=${lon}`
        + `&hourly=cloud_cover&models=${MODELS}&forecast_days=3&timezone=GMT`;

    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
    const data = await response.json();

    if (!data || !data.hourly || !data.hourly.time) {
        console.warn('[Ensemble] No hourly data in response');
        return null;
    }

    const times = data.hourly.time;
    const len = times.length;

    // 모든 멤버 키 추출 (cloud_cover_member01, cloud_cover_member02, ...)
    const memberKeys = Object.keys(data.hourly).filter(k =>
        k.startsWith('cloud_cover') && k !== 'cloud_cover' && k.includes('member')
    );

    // cloud_cover (멤버 아닌) 모델별 평균도 포함
    const modelAvgKeys = Object.keys(data.hourly).filter(k =>
        k === 'cloud_cover' || (k.startsWith('cloud_cover') && !k.includes('member') && k !== 'cloud_cover')
    );

    // 멤버가 있으면 멤버 사용, 없으면 모델 평균 사용
    const allKeys = memberKeys.length > 0 ? memberKeys : modelAvgKeys;

    if (allKeys.length === 0) {
        console.warn('[Ensemble] No cloud_cover member/model data found');
        return null;
    }

    // 시간별 max, mean, spread, p75 계산
    const maxCloud = new Array(len).fill(0);
    const meanCloud = new Array(len).fill(0);
    const spread = new Array(len).fill(0);
    const p75Cloud = new Array(len).fill(0);

    for (let i = 0; i < len; i++) {
        const vals = [];
        for (const key of allKeys) {
            const v = data.hourly[key]?.[i];
            if (v != null && !isNaN(v)) vals.push(v);
        }
        if (vals.length === 0) {
            maxCloud[i] = null;
            meanCloud[i] = null;
            spread[i] = null;
            p75Cloud[i] = null;
            continue;
        }
        maxCloud[i] = Math.max(...vals);
        meanCloud[i] = vals.reduce((a, b) => a + b, 0) / vals.length;
        spread[i] = maxCloud[i] - Math.min(...vals);
        // p75: 75th percentile — less pessimistic than max, more conservative than mean
        vals.sort((a, b) => a - b);
        if (vals.length >= 10) {
            p75Cloud[i] = vals[Math.floor(vals.length * 0.75)];
        } else {
            p75Cloud[i] = meanCloud[i]; // 멤버 적으면 평균 사용 (안전)
        }
    }

    console.log(`[Ensemble] Parsed ${allKeys.length} members/models, ${len} time slots`);

    return {
        hourlyTimes: times,
        maxCloud,    // 비관적 (천문관측용)
        meanCloud,   // 평균
        spread,      // 불확실성 (max - min)
        p75Cloud,    // 75th percentile (v3.1 — balanced conservatism)
        utc_offset_seconds: data.utc_offset_seconds || 0
    };
}

/**
 * Ensemble 데이터에서 targetDate에 가장 가까운 슬롯의 구름 값 찾기
 * @param {object} ensembleData - fetchEnsembleCloud 반환값
 * @param {Date} targetDate
 * @returns {{ maxCloud: number, meanCloud: number, spread: number } | null}
 */
function findClosestSlot(ensembleData, targetDate) {
    if (!ensembleData || !ensembleData.hourlyTimes) return null;

    const targetTime = targetDate.getTime();
    let minDiff = Infinity;
    let bestIdx = -1;

    for (let i = 0; i < ensembleData.hourlyTimes.length; i++) {
        // timezone=GMT이므로 Z 접미사가 없을 수 있음 → 강제 UTC 파싱
        let timeStr = ensembleData.hourlyTimes[i];
        if (!timeStr.endsWith('Z') && !timeStr.includes('+') && !timeStr.includes('-', 10)) {
            timeStr += 'Z';
        }
        const t = new Date(timeStr).getTime();
        if (isNaN(t)) continue; // 파싱 실패 방어
        const diff = Math.abs(t - targetTime);
        if (diff < minDiff) {
            minDiff = diff;
            bestIdx = i;
        }
    }

    // 3시간 이내만 매칭
    if (bestIdx === -1 || minDiff > 3 * 60 * 60 * 1000) return null;

    const mc = ensembleData.maxCloud[bestIdx];
    if (mc == null) return null;

    return {
        maxCloud: ensembleData.maxCloud[bestIdx],
        meanCloud: ensembleData.meanCloud[bestIdx],
        spread: ensembleData.spread[bestIdx],
        p75Cloud: ensembleData.p75Cloud ? ensembleData.p75Cloud[bestIdx] : null
    };
}

module.exports = {
    fetchEnsembleCloud,
    findClosestSlot
};
