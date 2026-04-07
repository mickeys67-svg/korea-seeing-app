/**
 * Auto-Validation Service v1.0
 * 과거 예측(3~6시간 전)을 현재 실측(KMA/METAR/Open-Meteo)과 자동 비교
 * actual 필드를 채워 ML 학습 데이터 자동 생성
 */

// 마지막 검증 시간 (동일 검증 반복 방지)
let _lastValidationTime = 0;
const VALIDATION_INTERVAL = 30 * 60 * 1000; // 30분마다 최대 1회

/**
 * 현재 실측 데이터와 과거 예측을 비교하여 actual 필드 업데이트
 * @param {Firestore} db - Firestore instance
 * @param {number} lat
 * @param {number} lon
 * @param {object} currentActual - 현재 실측 데이터 { cloud, humidity, wind, temp }
 */
async function validatePastPredictions(db, lat, lon, currentActual) {
    if (!db || !currentActual) return;

    // 검증 간격 제한 (30분)
    const now = Date.now();
    if (now - _lastValidationTime < VALIDATION_INTERVAL) return;
    _lastValidationTime = now;

    try {
        const col = db.collection('trainingData');

        // 3~6시간 전 예측 중 이 좌표(±0.2°)의 데이터 검색
        const targetTime = new Date(now);
        const windowStart = new Date(now - 6 * 60 * 60 * 1000); // 6시간 전
        const windowEnd = new Date(now - 2 * 60 * 60 * 1000);   // 2시간 전

        const snapshot = await col
            .where('timestamp', '>=', windowStart)
            .where('timestamp', '<=', windowEnd)
            .where('actual', '==', null)
            .orderBy('timestamp', 'desc')
            .limit(30)
            .get();

        if (snapshot.empty) return;

        // 좌표 필터 + actual 업데이트
        const batch = db.batch();
        let updateCount = 0;

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (Math.abs(data.lat - lat) > 0.2 || Math.abs(data.lon - lon) > 0.2) return;

            // 예측 vs 실측 비교 점수 계산
            const predicted = data.predicted || {};
            const inputs = data.inputs || {};

            // 구름: 예측 cloudScore(0-8) vs 실측 cloudScore(0-8)
            const cloudError = (inputs.cloudScore != null && currentActual.cloudScore != null)
                ? Math.abs(inputs.cloudScore - currentActual.cloudScore)
                : null;

            // 풍속: 예측 vs 실측 (m/s)
            const windError = (inputs.wind != null && currentActual.wind != null)
                ? Math.abs(inputs.wind - currentActual.wind)
                : null;

            // 습도: 예측 vs 실측 (%)
            const humidityError = (inputs.humidity != null && currentActual.humidity != null)
                ? Math.abs(inputs.humidity - currentActual.humidity)
                : null;

            // 온도: 예측 vs 실측 (°C)
            const tempError = (inputs.temp != null && currentActual.temp != null)
                ? Math.abs(inputs.temp - currentActual.temp)
                : null;

            // 자동 등급 산출 (1~5, 5=정확)
            // 구름 오차 기반 (가장 중요한 지표)
            let autoRating = 3; // 기본 보통
            if (cloudError != null) {
                if (cloudError <= 1.0) autoRating = 5;       // 구름 1단계 이내 → 정확
                else if (cloudError <= 2.0) autoRating = 4;  // 2단계 이내 → 좋음
                else if (cloudError <= 3.0) autoRating = 3;  // 3단계 → 보통
                else if (cloudError <= 5.0) autoRating = 2;  // 5단계 → 나쁨
                else autoRating = 1;                          // 완전 틀림
            }

            batch.update(doc.ref, {
                actual: {
                    autoValidated: true,
                    rating: autoRating,
                    validatedAt: new Date(),
                    measured: {
                        cloudScore: currentActual.cloudScore ?? null,
                        wind: currentActual.wind ?? null,
                        humidity: currentActual.humidity ?? null,
                        temp: currentActual.temp ?? null,
                    },
                    errors: {
                        cloud: cloudError != null ? parseFloat(cloudError.toFixed(2)) : null,
                        wind: windError != null ? parseFloat(windError.toFixed(2)) : null,
                        humidity: humidityError != null ? parseFloat(humidityError.toFixed(2)) : null,
                        temp: tempError != null ? parseFloat(tempError.toFixed(2)) : null,
                    }
                }
            });
            updateCount++;
        });

        if (updateCount > 0) {
            await batch.commit();
            console.log(`[AutoValidation] Updated ${updateCount} predictions with actual data (${lat.toFixed(1)}, ${lon.toFixed(1)})`);
        }
    } catch (err) {
        // Silent — validation is optional, never block main flow
        console.warn('[AutoValidation] Error:', err.message);
    }
}

module.exports = { validatePastPredictions };
