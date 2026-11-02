/**
 * 스코어링 파이프라인 회귀 테스트 (Node 내장 node:test, 외부 의존성 0)
 *
 * 왜 이 테스트가 있나:
 *   2026-04-25 v5.4 "비용 0원" 커밋이 압력층을 8→5로 줄이자, 그 층 개수/두께(dz)에
 *   암묵적으로 묶여 있던 공식들(confidence 임계값, TKE)이 조용히 깨졌다. 테스트가
 *   없어서 몇 달에 걸쳐 프로덕션에서 하나씩 발견됐다(confidence −10%p, 시잉 전세계 과대).
 *   이 테스트는 그 "조용한 회귀"를 커밋 단계에서 잡는 안전망이다.
 *
 * 원칙:
 *   - 라이브 API 호출 금지. 고정 합성 입력만 사용 → 결정론적.
 *   - 스냅샷 값은 여유 범위로, 회귀 가드는 엄격한 부등식으로.
 *
 * 실행: cd backend && npm test   (또는  node --test)
 */
const { test } = require('node:test');
const assert = require('node:assert');

const USP = require('../services/USPModel');
const WS = require('../services/weatherService');
const SS = require('../services/scoringService');

// ── 합성 Open-Meteo 객체 (5 압력층, 1 시간 슬롯) ──
// windsKmh: [1000,850,700,500,250] hPa 풍속(km/h). prepareUSPData가 /3.6로 m/s 변환.
function makeOM(windsKmh) {
    const t = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
    return {
        elevation: 50,
        hourly: {
            time: [t],
            temperature_1000hPa: [15], temperature_850hPa: [8], temperature_700hPa: [0],
            temperature_500hPa: [-15], temperature_250hPa: [-50],
            wind_speed_1000hPa: [windsKmh[0]], wind_speed_850hPa: [windsKmh[1]],
            wind_speed_700hPa: [windsKmh[2]], wind_speed_500hPa: [windsKmh[3]],
            wind_speed_250hPa: [windsKmh[4]],
        },
    };
}
const TARGET = () => new Date(Date.now() + 3 * 3600 * 1000);
const CALM = () => WS.prepareUSPData(TARGET(), makeOM([10, 20, 30, 40, 60]));   // 약한 상층풍
const JET = () => WS.prepareUSPData(TARGET(), makeOM([10, 40, 90, 180, 360]));  // 강한 제트

// ─────────────────────────────────────────────────────────────
// 1. prepareUSPData: 층 개수는 "압력층 5개 → 4레이어"로 고정 (암묵적 결합을 명시화)
// ─────────────────────────────────────────────────────────────
test('prepareUSPData: 5 압력층 → 정확히 4 레이어', () => {
    assert.strictEqual(CALM().length, 4, '레이어 개수가 바뀌면 confidence/TKE 전제가 깨진다');
    assert.strictEqual(JET().length, 4);
});

// ─────────────────────────────────────────────────────────────
// 2. TKE 포화 회귀 가드 (오늘 고친 버그) — 강한 제트에도 상한 3.0에 붙으면 안 됨
// ─────────────────────────────────────────────────────────────
test('TKE 회귀 가드: 강한 제트에도 tke가 상한 3.0에 포화되지 않는다', () => {
    const tkes = JET().map(l => l.tke);
    const maxTke = Math.max(...tkes);
    assert.ok(maxTke < 3.0, `제트 층 tke 최대=${maxTke} — 3.0 포화면 (windShear·dz)² 버그 재발`);
    assert.ok(maxTke > 0.4, `제트인데 tke가 너무 낮음(${maxTke}) — 입력에 반응하는지 확인`);
});

test('TKE: 약한 상층풍은 낮은 난류', () => {
    const maxTke = Math.max(...CALM().map(l => l.tke));
    assert.ok(maxTke < 0.3, `잔잔한 대기 tke 최대=${maxTke} (0.3 미만 기대)`);
});

// ─────────────────────────────────────────────────────────────
// 3. USPModel.calculate: 지점을 "구분"해야 한다 (시잉 변별력)
// ─────────────────────────────────────────────────────────────
test('시잉 변별력: 잔잔<제트, 잔잔은 sub-arcsec, 제트도 cap(5)에 포화되지 않음', () => {
    const calm = USP.calculate({ layers: CALM(), surfaceWind: 3, jetStreamSpeed: 32, targetAltitude: 90, elevation: 50 });
    const jet = USP.calculate({ layers: JET(), surfaceWind: 3, jetStreamSpeed: 194, targetAltitude: 90, elevation: 50 });
    assert.ok(calm.seeing < 1.0, `잔잔 시잉=${calm.seeing}" (1.0 미만 기대)`);
    assert.ok(jet.seeing > calm.seeing, '제트가 잔잔보다 나빠야 함');
    assert.ok(jet.seeing < 4.5, `제트 시잉=${jet.seeing}" — 4.5 넘으면 포화 의심(옛 버그는 전역 4~5)`);
});

test('fallback(층 없음)도 합리적 시잉', () => {
    const fb = USP.calculate({ layers: [], surfaceWind: 5, jetStreamSpeed: 40, targetAltitude: 90, elevation: 50 });
    assert.ok(fb.seeing > 0.3 && fb.seeing < 2.0, `fallback 시잉=${fb.seeing}"`);
});

// ─────────────────────────────────────────────────────────────
// 4. confidence 회귀 가드 (6월에 고친 버그) — 전체 프로파일이면 높고, 층 없으면 ~50
// ─────────────────────────────────────────────────────────────
test('confidence 회귀 가드: 4레이어+공기질이면 >=90, 층 없으면 ~50', () => {
    const full = USP.calculate({ layers: CALM(), surfaceWind: 3, jetStreamSpeed: 32, targetAltitude: 90, elevation: 50, aod: 0.1, pm25: 10, humidity: 50 });
    const none = USP.calculate({ layers: [], surfaceWind: 3, jetStreamSpeed: 32, targetAltitude: 90, elevation: 50 });
    assert.ok(full.confidence >= 90, `전체 프로파일 confidence=${full.confidence} — 90 미만이면 layers>=N 임계값 회귀`);
    assert.ok(none.confidence >= 45 && none.confidence <= 60, `층 없음 confidence=${none.confidence} (약 50 기대)`);
    assert.ok(full.confidence > none.confidence, 'confidence가 데이터 양에 반응해야 함');
});

// ─────────────────────────────────────────────────────────────
// 5. seeingScore: 좋을수록(작을수록) 높은 점수, 단조 감소
// ─────────────────────────────────────────────────────────────
test('seeingScore: 단조 감소 + 경계', () => {
    assert.strictEqual(USP.seeingScore(0.4), 10);
    assert.strictEqual(USP.seeingScore(5.0), 0);
    const vals = [0.4, 0.8, 1.2, 1.8, 2.5, 4.0, 5.0].map(USP.seeingScore);
    for (let i = 1; i < vals.length; i++) {
        assert.ok(vals[i] <= vals[i - 1], `seeingScore 단조성 위반: ${vals}`);
    }
});

// ─────────────────────────────────────────────────────────────
// 6. scoringService.calculateJetStreamScore: CLAUDE.md 스펙(<60/100/130/160 kt)
// ─────────────────────────────────────────────────────────────
test('jetStreamScore: null=4(중립), 임계값 스펙', () => {
    assert.strictEqual(SS.calculateJetStreamScore(null), 4);
    assert.strictEqual(SS.calculateJetStreamScore(25), 0);    // 48.6kt <60 → 0
    assert.strictEqual(SS.calculateJetStreamScore(60), 4);    // 116.6kt <130 → 4
    assert.strictEqual(SS.calculateJetStreamScore(90), 8);    // 175kt ≥160 → 8
});

// ─────────────────────────────────────────────────────────────
// 7. calculateObservationScore: 맑으면 높고, 구름 하드게이트(>=7)면 캡
// ─────────────────────────────────────────────────────────────
test('관측점수: 맑은 좋은 조건은 높음', () => {
    const r = SS.calculateObservationScore({ seeing: 1, transparency: 1, cloud: 0, wind: 1, convection: 0 });
    assert.ok(r.score >= 75 && r.score <= 95, `맑은 조건 점수=${r.score}`);
    assert.ok(['S', 'A'].includes(r.grade), `등급=${r.grade}`);
});

test('관측점수: 완전 흐림(cloud>=7)은 10 이하로 캡', () => {
    const r = SS.calculateObservationScore({ seeing: 2, transparency: 2, cloud: 8, wind: 2, convection: 1 });
    assert.ok(r.score <= 10, `흐림 점수=${r.score} — 하드게이트 깨짐`);
    assert.strictEqual(r.grade, 'D');
});
