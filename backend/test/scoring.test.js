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
test('confidence 회귀 가드: 앙상블 불일치에 따라 변한다 (95 고정 방지) + 데이터 양에 반응', () => {
    const base = { layers: CALM(), surfaceWind: 3, jetStreamSpeed: 32, targetAltitude: 90, elevation: 50, aod: 0.1, pm25: 10, humidity: 50 };
    const agree = USP.calculate({ ...base, ensembleSpread: 5 });    // 모델 일치 → 신뢰도 높음
    const disagree = USP.calculate({ ...base, ensembleSpread: 45 }); // 모델 엇갈림 → 낮음
    const none = USP.calculate({ layers: [], surfaceWind: 3, jetStreamSpeed: 32, targetAltitude: 90, elevation: 50 });
    assert.ok(agree.confidence > disagree.confidence + 10,
        `일치(${agree.confidence}) vs 불일치(${disagree.confidence}) — 변별 없으면 95 고정 회귀`);
    assert.notStrictEqual(agree.confidence, disagree.confidence); // 고정값이면 안 됨
    assert.ok(agree.confidence >= 85, `모델 일치 시 신뢰도=${agree.confidence} (높아야)`);
    assert.ok(disagree.confidence < 80, `모델 불일치 신뢰도=${disagree.confidence} (과신 아님)`);
    assert.ok(none.confidence < agree.confidence, 'confidence가 데이터 양에 반응해야 함');
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

// ─────────────────────────────────────────────────────────────
// 8. findClosestItem 타임존 회귀 가드 (2026-11-03 고친 버그)
//    OM timezone=auto는 오프셋 없는 현지 벽시계 문자열을 준다. 서버(UTC)에서 그걸
//    그대로 UTC로 파싱하면 한국은 9시간 어긋난 슬롯을 집었다(기온·구름·압력층 전부).
//    utc_offset_seconds로 진짜 instant를 복원해 비교해야 한다.
// ─────────────────────────────────────────────────────────────
test('findClosestItem: 한국 naive 로컬 문자열 + offset으로 진짜 instant 매칭', () => {
    const KR_OFFSET = 9 * 3600; // Asia/Seoul utc_offset_seconds
    // OM가 timezone=auto로 돌려준 현지 벽시계(오프셋 없음) — 00:00~23:00 KST
    const localTimes = [];
    for (let h = 0; h < 24; h++) localTimes.push(`2026-11-03T${String(h).padStart(2, '0')}:00`);

    // 원하는 진짜 순간: 2026-11-03T02:00:00Z = 한국 11:00 (= localTimes[11])
    const target = new Date('2026-11-03T02:00:00Z');
    const idx = WS.findClosestItem(localTimes, target, KR_OFFSET);
    assert.strictEqual(localTimes[idx], '2026-11-03T11:00',
        `offset 적용 시 11:00(KST)=02:00Z를 집어야 함 — 집은 값=${localTimes[idx]}`);

    // 회귀 증명: offset을 무시하면(옛 동작) 02:00을 집어 9시간 어긋난다
    const buggy = WS.findClosestItem(localTimes, target, 0);
    assert.strictEqual(localTimes[buggy], '2026-11-03T02:00',
        'offset=0(옛 동작)은 02:00을 집어 9h 어긋났음을 확인');
    assert.notStrictEqual(localTimes[idx], localTimes[buggy],
        'offset 적용/미적용 결과가 달라야 함 — 같으면 수정이 안 먹은 것');
});

test('findClosestItem: Z 접미사가 붙은 문자열은 offset 무관하게 그대로 파싱', () => {
    // Met.no·내부 toISOString()은 이미 진짜 UTC. offset을 넘겨도 영향 없어야 한다.
    const utcTimes = ['2026-11-03T01:00:00Z', '2026-11-03T02:00:00Z', '2026-11-03T03:00:00Z'];
    const target = new Date('2026-11-03T02:10:00Z');
    assert.strictEqual(WS.findClosestItem(utcTimes, target, 9 * 3600), 1);
    assert.strictEqual(WS.findClosestItem(utcTimes, target, 0), 1);
});

// ─────────────────────────────────────────────────────────────
// 9. buildPhotoIndex 키 불일치 회귀 가드 (2026-11-03 고친 버그)
//    과거: Map 키=OM 현지문자열("…T13:00"), 조회=ws.time(진짜 UTC "…Z") → 영원히 불일치
//    → photo 변수 전부 null → isDay 늘 오판, 야간/장노출 추천 미작동.
//    수정: 진짜 instant로 변환해 최근접 매칭.
// ─────────────────────────────────────────────────────────────
const { buildPhotoIndex } = require('../services/photo/fetchOpenMeteoForPhoto');

function makePhotoRaw() {
    const time = [];
    const is_day = [];
    const visibility = [];
    for (let h = 0; h < 24; h++) {
        time.push(`2026-11-03T${String(h).padStart(2, '0')}:00`); // KST 현지 벽시계
        is_day.push(h >= 7 && h <= 18 ? 1 : 0);                   // 낮: 07~18 KST
        visibility.push(h * 1000);                                // 시각마다 다른 값(변별 확인용)
    }
    return { utc_offset_seconds: 9 * 3600, hourly: { time, is_day, visibility } };
}

test('buildPhotoIndex: ws.time(진짜 UTC)로 조회 시 올바른 현지 슬롯 반환(null 아님)', () => {
    const idx = buildPhotoIndex(makePhotoRaw());
    assert.ok(idx.size === 24, `인덱스 크기=${idx.size}`);

    // 한국 낮 13:00 = 04:00Z. ws.time은 toISOString() 형식.
    const dayWs = new Date('2026-11-03T04:00:00.000Z').toISOString();
    const day = idx.get(dayWs);
    assert.ok(day !== null, '진짜 UTC 조회가 null이면 키 불일치 버그 재발');
    assert.strictEqual(day.isDay, 1, `한국 13:00는 낮이어야 함 isDay=${day && day.isDay}`);
    assert.strictEqual(day.visibility, 13000, `13:00 KST 슬롯 visibility=${day && day.visibility}`);

    // 한국 02:00 = 전날 17:00Z → 밤
    const nightWs = new Date('2026-11-02T17:00:00.000Z').toISOString();
    const night = idx.get(nightWs);
    assert.ok(night !== null);
    assert.strictEqual(night.isDay, 0, `한국 02:00은 밤이어야 함 isDay=${night && night.isDay}`);

    // 입력(조회 시각)이 바뀌면 결과도 바뀐다 — 고정 폴백이 아님을 증명
    assert.notStrictEqual(day.visibility, night.visibility);
});

test('buildPhotoIndex: 2시간 넘게 벌어진 조회는 데이터 없음(null)', () => {
    const idx = buildPhotoIndex(makePhotoRaw());
    // 범위 밖(며칠 뒤) → null
    assert.strictEqual(idx.get('2026-11-10T00:00:00.000Z'), null);
});

test('buildPhotoIndex: 빈/깨진 입력도 안전', () => {
    assert.strictEqual(buildPhotoIndex(null).get('x'), null);
    assert.strictEqual(buildPhotoIndex({}).size, 0);
    assert.strictEqual(buildPhotoIndex({ hourly: { time: [] } }).get('x'), null);
});

// ─────────────────────────────────────────────────────────────
// 10. twilight 날짜 키 하루 어긋남 회귀 가드 (2026-11-03 고친 버그)
//    date 키를 midnightUTC의 UTC 날짜로 쓰면 양수 오프셋(한국 +9h)에서 현지 날짜보다
//    하루 빨라, photoService(현지 날짜로 조회)가 엉뚱한 날 twilight를 집어 한낮도 night로
//    판정됐다. 날짜 키는 현지 날짜여야 한다.
// ─────────────────────────────────────────────────────────────
const TW = require('../services/photo/twilightService');

test('getTwilightForecast: date 키가 한국 현지 날짜와 일치', () => {
    const start = new Date('2026-11-03T12:00:00Z'); // KST 21:00 → 현지 2026-11-03
    const days = TW.getTwilightForecast(start, 3, 37.5, 127, 9 * 3600);
    assert.strictEqual(days[0].date, '2026-11-03', `day0 키=${days[0].date}`);
    assert.strictEqual(days[1].date, '2026-11-04', `day1 키=${days[1].date}`);
    assert.strictEqual(days[2].date, '2026-11-05', `day2 키=${days[2].date}`);
});

test('classifyTimePhase: 한국 한낮=day, 한밤=night (off-by-one 회귀 가드)', () => {
    const days = TW.getTwilightForecast(new Date('2026-11-03T12:00:00Z'), 3, 37.5, 127, 9 * 3600);
    const byDate = new Map(days.map(d => [d.date, d]));
    const day0404 = byDate.get('2026-11-04');
    assert.ok(day0404, '2026-11-04 현지 날짜 키로 조회돼야 함(어긋나면 undefined)');

    // KST 2026-11-04 12:00 = UTC 2026-11-04T03:00Z → 한낮
    assert.strictEqual(
        TW.classifyTimePhase('2026-11-04T03:00:00Z', day0404), 'day',
        '한국 정오가 day가 아니면 twilight 날짜 하루 어긋남 재발');
    // KST 2026-11-04 03:00 = UTC 2026-11-03T18:00Z → 깊은 밤
    assert.strictEqual(
        TW.classifyTimePhase('2026-11-03T18:00:00Z', day0404), 'night',
        '한국 새벽 3시는 night');
});
