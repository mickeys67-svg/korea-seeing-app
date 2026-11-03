const express = require('express');
const router = express.Router();

// ═══ 주소 → 좌표 지오코딩 프록시 (하이브리드) ═══
// KAKAO_API_KEY가 있으면 Kakao 로컬(한국 상세주소 정확), 없으면 Nominatim(키 불필요).
// 키를 서버에서만 다뤄 브라우저 노출을 막고, 결과를 캐시해 Nominatim 정책(초당 1회)·비용을 지킨다.
// 위치는 사용자가 직접 입력한 주소라 '단말 위치 수집'이 아님(위치정보법 GPS 이슈 회피).

const _cache = new Map();
const CACHE_MAX = 300;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 주소→좌표는 거의 안 변하므로 24시간

function cacheGet(k) {
    const e = _cache.get(k);
    if (!e) return null;
    if (Date.now() - e.ts > CACHE_TTL) { _cache.delete(k); return null; }
    return e.v;
}
function cacheSet(k, v) {
    if (_cache.size >= CACHE_MAX && !_cache.has(k)) _cache.delete(_cache.keys().next().value);
    _cache.set(k, { v, ts: Date.now() });
}

// Kakao: 주소 검색 → 결과 없으면 키워드(장소명) 검색으로 폴백
async function geocodeKakao(q, key) {
    const opt = { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(6000) };
    let r = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(q)}&size=5`, opt);
    if (r.ok) {
        const d = await r.json();
        const docs = d.documents || [];
        if (docs.length) return docs.map(doc => ({ name: doc.address_name, lat: parseFloat(doc.y), lng: parseFloat(doc.x) }));
    }
    // 주소로 안 잡히면 장소명(키워드)으로
    r = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&size=5`, opt);
    if (!r.ok) throw Object.assign(new Error(`Kakao HTTP ${r.status}`), { status: r.status });
    const d = await r.json();
    return (d.documents || []).map(doc => ({
        name: doc.place_name + (doc.address_name ? ` (${doc.address_name})` : ''),
        lat: parseFloat(doc.y), lng: parseFloat(doc.x),
    }));
}

// Nominatim(OSM): 키 불필요. 정책상 식별 가능한 User-Agent 필수.
async function geocodeNominatim(q) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=5&accept-language=ko`;
    const r = await fetch(url, {
        headers: { 'User-Agent': `ClearSky-App/5.5 (${process.env.CONTACT_EMAIL || 'support@clearsky.kr'})` },
        signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) throw Object.assign(new Error(`Nominatim HTTP ${r.status}`), { status: r.status });
    const d = await r.json();
    return (Array.isArray(d) ? d : []).map(x => ({ name: x.display_name, lat: parseFloat(x.lat), lng: parseFloat(x.lon) }));
}

/**
 * GET /api/geocode?q=주소
 * → [{ name, lat, lng }] (최대 5개). 입력 주소는 저장하지 않음(캐시 키는 질의어 자체).
 */
router.get('/', async (req, res) => {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json([]);

    const key = process.env.KAKAO_API_KEY;
    const cacheKey = `${key ? 'k' : 'n'}:${q.toLowerCase()}`;
    const cached = cacheGet(cacheKey);
    if (cached) { res.set('Cache-Control', 'public, max-age=86400'); return res.json(cached); }

    try {
        let results;
        if (key) {
            try { results = await geocodeKakao(q, key); }
            catch (e) { console.warn('[Geocode] Kakao 실패 → Nominatim 폴백:', e.message); results = await geocodeNominatim(q); }
        } else {
            results = await geocodeNominatim(q);
        }
        results = (results || []).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng)).slice(0, 5);
        cacheSet(cacheKey, results);
        res.set('Cache-Control', 'public, max-age=86400');
        res.json(results);
    } catch (e) {
        console.error('[Geocode] 실패:', e.message);
        res.status(502).json({ error: 'geocode failed' });
    }
});

module.exports = router;
