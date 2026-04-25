/**
 * v5.0 Photo Guide — Shared utilities
 *
 * 순수함수 전용. 외부 상태 0. 기존 services/* 무변경.
 * 모든 category/*.js, photoService.js에서 공용 사용.
 */

// ─── 숫자 안전처리 ──────────────────────────────────────────
function safeNum(v, fallback = null) {
    return (typeof v === 'number' && Number.isFinite(v)) ? v : fallback;
}

function clamp(v, lo, hi) {
    if (v == null || !Number.isFinite(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
}

// ─── 통계적 커브 ─────────────────────────────────────────────
/**
 * Gaussian bell curve — peak에서 1, sigma만큼 떨어질 때 ~0.6
 * Sky Color의 cloudHigh/cloudMid/humidity sweet spot에 사용.
 */
function gaussian(x, peak, sigma) {
    if (x == null || !Number.isFinite(x)) return 0;
    const diff = x - peak;
    return Math.exp(-(diff * diff) / (2 * sigma * sigma));
}

/**
 * Linear clamp-ramp — x가 lo→hi 사이에서 0→1로 증가
 */
function linRamp(x, lo, hi) {
    if (x == null || !Number.isFinite(x)) return 0;
    if (x <= lo) return 0;
    if (x >= hi) return 1;
    return (x - lo) / (hi - lo);
}

/**
 * Inverted linear ramp — x가 lo→hi 사이에서 1→0으로 감소
 */
function invLinRamp(x, lo, hi) {
    if (x == null || !Number.isFinite(x)) return 1;
    if (x <= lo) return 1;
    if (x >= hi) return 0;
    return 1 - (x - lo) / (hi - lo);
}

// ─── 점수 → 등급 변환 ─────────────────────────────────────────
function scoreToGrade(score) {
    if (score >= 85) return 'S';
    if (score >= 70) return 'A';
    if (score >= 55) return 'B';
    if (score >= 40) return 'C';
    return 'D';
}

// ─── 시간대 유틸 ──────────────────────────────────────────────
function getLocalHour(isoTime, utcOffsetSeconds = 0) {
    const d = new Date(isoTime);
    if (isNaN(d)) return null;
    const localMs = d.getTime() + utcOffsetSeconds * 1000;
    return new Date(localMs).getUTCHours();
}

function isWithinWindow(isoTime, windowStartIso, windowEndIso) {
    if (!windowStartIso || !windowEndIso) return false;
    const t = new Date(isoTime).getTime();
    const s = new Date(windowStartIso).getTime();
    const e = new Date(windowEndIso).getTime();
    if (isNaN(t) || isNaN(s) || isNaN(e)) return false;
    return t >= s && t <= e;
}

// ─── 지리 판단 ────────────────────────────────────────────────
/**
 * 한국 영역 판정 — mudflat tide API(KHOA)는 한국 해역만 지원
 */
function isKoreaRegion(lat, lon) {
    return (lat >= 33 && lat <= 39.5) && (lon >= 124 && lon <= 132);
}

/**
 * 해안 근접 판정 — 간이: 한국 서/남해 격자 부분 중심
 * 단순한 bounding box — 정확한 해안선 필요 시 향후 지오코딩 통합
 */
function isCoastalKorea(lat, lon) {
    if (!isKoreaRegion(lat, lon)) return false;
    // 서해안(125.5-127) + 남해안(127-130, lat<35.3) + 동해안(129-130)
    if (lon <= 127) return true; // 서해/황해
    if (lat <= 35.5 && lon <= 129) return true; // 남해
    if (lon >= 129 && lat >= 35 && lat <= 39) return true; // 동해
    return false;
}

function getElevationCategory(elevationM) {
    if (elevationM == null) return 'unknown';
    if (elevationM >= 1000) return 'mountain'; // alpenglow 후보
    if (elevationM >= 300) return 'hill';
    if (elevationM >= 50) return 'plain';
    return 'lowland';
}

// ─── 장르별 점수 → 0-100 정규화 ───────────────────────────────
function rawToScore100(raw) {
    // raw는 0-1 범위 원점수. 100점 만점 정수로 변환.
    const clamped = clamp(raw, 0, 1);
    return Math.round(clamped * 1000) / 10; // 소수 첫째 자리
}

// ─── 가중 평균 ────────────────────────────────────────────────
function weightedAvg(parts) {
    // parts = [{ value, weight }, ...]
    let sum = 0, wSum = 0;
    for (const p of parts) {
        if (p.value == null || !Number.isFinite(p.value)) continue;
        const w = p.weight ?? 1;
        sum += p.value * w;
        wSum += w;
    }
    return wSum > 0 ? sum / wSum : 0;
}

module.exports = {
    safeNum,
    clamp,
    gaussian,
    linRamp,
    invLinRamp,
    scoreToGrade,
    getLocalHour,
    isWithinWindow,
    isKoreaRegion,
    isCoastalKorea,
    getElevationCategory,
    rawToScore100,
    weightedAvg,
};
