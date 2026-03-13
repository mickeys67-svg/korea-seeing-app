const axios = require('axios');

// ═══ GK2A 천리안위성 2A호 기상산출물 서비스 ═══
// 한국 좌표 전용 — 위성 실측 구름/에어로졸 데이터
// API: https://apihub.kma.go.kr/api/typ05/api/GK2A/LE2/
// 갱신: 전구 10분, 한반도 2분
// 해상도: IR 2km, VIS 500m

const GK2A_BASE = 'https://apihub.kma.go.kr/api/typ05/api/GK2A';

// ═══ 관측 영역 ═══
// EA: 동아시아 (10분), ELA: 확장한반도 (10분), KO: 한반도 (2분)
const DEFAULT_AREA = 'EA';

// ═══ In-Memory Cache ═══
// 위성 데이터는 10분 갱신 → TTL 12분 (약간 여유)
const _cache = new Map();
const CACHE_TTL = 12 * 60 * 1000;
const CACHE_MAX = 20;

const CACHE_NODATA = Symbol('NODATA'); // NODATA 센티넬 — null과 구분

function _cacheGet(key) {
    const entry = _cache.get(key);
    if (!entry) return undefined; // 캐시 미스 = undefined
    if (Date.now() - entry.ts > CACHE_TTL) { _cache.delete(key); return undefined; }
    return entry.data; // null(NODATA) 또는 실제 데이터
}
function _cacheSet(key, data) {
    if (_cache.size >= CACHE_MAX && !_cache.has(key)) {
        const oldest = _cache.keys().next().value;
        _cache.delete(oldest);
    }
    _cache.set(key, { data, ts: Date.now() });
}

// ═══ GEOS 투영법 ← → lat/lon 좌표 변환 ═══
// GK2A는 동경 128.2° 정지궤도 위성, GEOS(Geostationary Satellite View) 투영 사용
// Reference: CGMS LRIT/HRIT Global Specification, NMSC ATBD

const GEOS = {
    subLon: 128.2,          // 부위성점 경도 (°)
    satHeight: 42164.0,     // 위성 고도 (지구 중심으로부터, km)
    earthA: 6378.137,       // 지구 적도 반지름 (km)
    earthB: 6356.7523,      // 지구 극 반지름 (km)
};

// EA (동아시아) 영역 격자 파라미터 — GK2A AMI 2km IR 기준
// 실제 파라미터는 NetCDF/Binary 헤더에서 추출하지만, fallback 용도
const GRID_PARAMS = {
    EA: {
        // 2km resolution, East Asia area
        cfac: 81057024, lfac: 81057024,  // column/line scaling factor
        coff: 1375,     loff: 1375,      // column/line offset
        ncols: 2750,    nlines: 2750,    // approximate
    },
    ELA: {
        cfac: 81057024, lfac: 81057024,
        coff: 900,      loff: 900,
        ncols: 1900,    nlines: 1200,
    }
};

/**
 * lat/lon → GEOS 격자 좌표 (column, line) 변환
 * Standard CGMS GEOS conversion used by GK2A/Himawari/GOES-R
 * @param {number} lat - 위도 (°)
 * @param {number} lon - 경도 (°)
 * @param {string} area - 영역 코드 (EA, ELA)
 * @returns {{ col: number, line: number } | null}
 */
function latLonToGeos(lat, lon, area = DEFAULT_AREA) {
    const DEG2RAD = Math.PI / 180;
    const { subLon, satHeight, earthA, earthB } = GEOS;
    const grid = GRID_PARAMS[area];
    if (!grid) return null;

    const e2 = 1 - (earthB * earthB) / (earthA * earthA);

    const latRad = lat * DEG2RAD;
    const lonDiff = (lon - subLon) * DEG2RAD;

    // Geocentric latitude (accounts for Earth's oblateness)
    const geocLat = Math.atan((earthB * earthB) / (earthA * earthA) * Math.tan(latRad));
    const cosGeoc = Math.cos(geocLat);
    const sinGeoc = Math.sin(geocLat);

    // Distance from Earth center to surface point
    const re = earthB / Math.sqrt(1 - e2 * cosGeoc * cosGeoc);

    // Satellite-relative cartesian coords
    const r1 = satHeight - re * cosGeoc * Math.cos(lonDiff);
    const r2 = -re * cosGeoc * Math.sin(lonDiff);
    const r3 = re * sinGeoc;

    // Check if point is visible from satellite
    const rn = Math.sqrt(r1 * r1 + r2 * r2 + r3 * r3);
    // Angular distance from sub-satellite point must be < ~81° (GEOS limb)
    const angDist = Math.acos(Math.cos(geocLat) * Math.cos(lonDiff));
    if (angDist > 81 * DEG2RAD || r1 < 0) return null;

    // Intermediate angles (radians)
    const xx = Math.atan2(-r2, r1);
    const yy = Math.asin(-r3 / rn);

    // Convert to column/line (CGMS standard: radians directly, no degree conversion)
    const col = grid.coff + Math.round(xx * grid.cfac / 65536);
    const line = grid.loff + Math.round(yy * grid.lfac / 65536);

    if (col < 0 || col >= grid.ncols || line < 0 || line >= grid.nlines) return null;
    return { col, line };
}

/**
 * 최신 관측 시각 계산
 * GK2A 데이터는 관측 후 ~15-20분 지연으로 API 제공
 * @param {number} intervalMin - 관측 간격 (10=EA/FD, 2=KO)
 * @returns {string} YYYYMMDDHHMM
 */
function getLatestObsTime(intervalMin = 10, offsetMin = 0) {
    const now = new Date();
    const delayMs = 20 * 60 * 1000; // 20분 보수적 지연
    const avail = new Date(now.getTime() - delayMs - offsetMin * 60 * 1000);

    const min = Math.floor(avail.getUTCMinutes() / intervalMin) * intervalMin;
    const y = avail.getUTCFullYear();
    const m = String(avail.getUTCMonth() + 1).padStart(2, '0');
    const d = String(avail.getUTCDate()).padStart(2, '0');
    const h = String(avail.getUTCHours()).padStart(2, '0');
    const mi = String(min).padStart(2, '0');
    return `${y}${m}${d}${h}${mi}`;
}

/**
 * 한국 좌표 판별 (GK2A 위성 한반도 커버리지)
 * EA 영역은 더 넓지만, 천문관측 앱은 한국 위주
 */
function isInCoverage(lat, lon) {
    // EA 커버리지: ~0-60N, 80-180E (광역)
    // 천문관측 앱은 한국+일본+동아시아 위주
    return lat >= 20 && lat <= 55 && lon >= 100 && lon <= 150;
}

// ═══ 바이너리 응답 파싱 ═══
// GK2A LE2 API는 바이너리(NetCDF4/HDF5 또는 raw binary)를 반환
// 형식 자동 감지 후 파싱

/**
 * 응답 형식 감지
 * @param {Buffer} buf
 * @returns {string} 'netcdf3' | 'hdf5' | 'text' | 'raw_binary'
 */
function detectFormat(buf) {
    if (!buf || buf.length < 8) return 'unknown';

    // NetCDF-3 classic: magic bytes 'CDF\x01' or 'CDF\x02'
    if (buf[0] === 0x43 && buf[1] === 0x44 && buf[2] === 0x46) return 'netcdf3';

    // HDF5 / NetCDF-4: magic bytes '\x89HDF\r\n\x1a\n'
    if (buf[0] === 0x89 && buf[1] === 0x48 && buf[2] === 0x44 && buf[3] === 0x46) return 'hdf5';

    // Text-based header (some KMA products)
    const firstByte = buf[0];
    if (firstByte >= 0x20 && firstByte <= 0x7E) {
        const header = buf.slice(0, Math.min(500, buf.length)).toString('utf8');
        if (header.includes('ncols') || header.includes('ROWS') || header.includes('nrows')
            || header.includes('xllcorner') || header.includes('NODATA')) {
            return 'text_grid';
        }
        // Comma/space-separated values
        if (header.includes(',') || header.match(/^\s*[-\d.]+\s+[-\d.]+/)) {
            return 'text_values';
        }
    }

    return 'raw_binary';
}

/**
 * Text Grid (ESRI ASCII Grid) 형식 파싱
 * Header: ncols, nrows, xllcorner, yllcorner, cellsize, NODATA_value
 * Data: row-major float/int values
 */
function parseTextGrid(buf, lat, lon) {
    const text = buf.toString('utf8');
    const lines = text.split(/\r?\n/);

    // Parse header
    const header = {};
    let dataStart = 0;
    for (let i = 0; i < Math.min(20, lines.length); i++) {
        const match = lines[i].match(/^(\w+)\s+([-\d.]+)/);
        if (match) {
            header[match[1].toLowerCase()] = parseFloat(match[2]);
            dataStart = i + 1;
        } else if (lines[i].trim().match(/^[-\d.]/)) {
            dataStart = i;
            break;
        }
    }

    const ncols = header.ncols || header.cols;
    const nrows = header.nrows || header.rows;
    const xll = header.xllcorner || header.xll;
    const yll = header.yllcorner || header.yll;
    const cellsize = header.cellsize || header.dx;
    const nodata = header.nodata_value ?? header.nodata ?? -9999;

    if (!ncols || !nrows || xll == null || yll == null || !cellsize) {
        console.warn('[GK2A] Text grid: missing header fields');
        return null;
    }

    // Find pixel for target lat/lon
    const col = Math.round((lon - xll) / cellsize);
    const row = Math.round((yll + (nrows - 1) * cellsize - lat) / cellsize);

    if (col < 0 || col >= ncols || row < 0 || row >= nrows) return null;

    // Parse data row
    const dataLine = lines[dataStart + row];
    if (!dataLine) return null;

    const vals = dataLine.trim().split(/\s+/);
    if (col >= vals.length) return null;

    const value = parseFloat(vals[col]);
    if (isNaN(value) || value === nodata) return null;

    return value;
}

/**
 * Raw binary 파싱 (단순 2D 배열 추정)
 * GK2A LE2 binary: 헤더 + float32/int16 2D array
 * 정확한 포맷은 API 응답 보고 조정
 */
function parseRawBinary(buf, lat, lon, area = DEFAULT_AREA) {
    const grid = GRID_PARAMS[area];
    if (!grid) return null;

    const pos = latLonToGeos(lat, lon, area);
    if (!pos) return null;

    // Estimate data structure:
    // GK2A LE2 products typically use 2-byte int16 or 4-byte float32
    // Try float32 first (most physical products), then int16

    // Attempt 1: Assume minimal header + float32 array
    const totalPixels = grid.ncols * grid.nlines;
    const float32Size = totalPixels * 4;
    const int16Size = totalPixels * 2;

    // Check if buffer matches expected sizes (with some header allowance)
    let offset = 0;
    let bytesPerPixel = 4;

    if (buf.length >= float32Size && buf.length < float32Size + 4096) {
        offset = buf.length - float32Size;
        bytesPerPixel = 4;
    } else if (buf.length >= int16Size && buf.length < int16Size + 4096) {
        offset = buf.length - int16Size;
        bytesPerPixel = 2;
    } else {
        // Can't determine format — log for debugging
        console.log(`[GK2A] Raw binary: ${buf.length} bytes, expected float32=${float32Size} or int16=${int16Size}`);
        return null;
    }

    const pixelIndex = pos.line * grid.ncols + pos.col;
    const byteOffset = offset + pixelIndex * bytesPerPixel;

    if (byteOffset + bytesPerPixel > buf.length) return null;

    let value;
    if (bytesPerPixel === 4) {
        value = buf.readFloatBE(byteOffset);
    } else {
        value = buf.readInt16BE(byteOffset);
    }

    // Check for common NODATA values
    if (value === -9999 || value === -999 || value === 9999 || isNaN(value)) return null;

    return value;
}

/**
 * 응답 데이터에서 특정 좌표의 값 추출
 * @param {Buffer} buf - API 응답 버퍼
 * @param {number} lat
 * @param {number} lon
 * @param {string} area
 * @returns {number | null}
 */
async function extractPointValue(buf, lat, lon, area = DEFAULT_AREA) {
    if (!buf || buf.length < 100) return null;

    const format = detectFormat(buf);
    console.log(`[GK2A] Format detected: ${format}, size: ${buf.length} bytes`);

    switch (format) {
        case 'text_grid':
            return parseTextGrid(buf, lat, lon);
        case 'text_values':
            // Simple text — might be single value or table
            const text = buf.toString('utf8').trim();
            const val = parseFloat(text);
            return isNaN(val) ? null : val;
        case 'netcdf3':
            // NetCDF-3: need netcdfjs library (optional dependency)
            try {
                const { NetCDFReader } = require('netcdfjs');
                return parseNetCDF3(buf, lat, lon, area);
            } catch {
                console.warn('[GK2A] netcdfjs not available, skipping NetCDF-3 parse');
                return null;
            }
        case 'hdf5':
            return await parseHDF5(buf, lat, lon, area);
        case 'raw_binary':
            return parseRawBinary(buf, lat, lon, area);
        default:
            console.log(`[GK2A] Unknown format — first 32 bytes: ${buf.slice(0, 32).toString('hex')}`);
            return null;
    }
}

/**
 * NetCDF-3 파싱 (netcdfjs 사용)
 */
function parseNetCDF3(buf, lat, lon, area) {
    try {
        const { NetCDFReader } = require('netcdfjs');
        const reader = new NetCDFReader(buf);

        // Common variable names for cloud products
        const varNames = reader.variables.map(v => v.name);
        console.log(`[GK2A] NetCDF variables: ${varNames.join(', ')}`);

        // Try to find lat/lon dimensions
        const latVar = reader.getDataVariable('latitude') || reader.getDataVariable('lat');
        const lonVar = reader.getDataVariable('longitude') || reader.getDataVariable('lon');

        if (latVar && lonVar) {
            // Find nearest lat/lon index
            const latIdx = findNearestIndex(latVar, lat);
            const lonIdx = findNearestIndex(lonVar, lon);

            // Try common data variable names
            const dataVarNames = ['cloud_mask', 'CLD', 'cloud_fraction', 'CLA',
                'optical_thickness', 'NCOT', 'COT', 'cloud_top_temperature',
                'AOD', 'aerosol_optical_depth', 'fog_mask'];
            for (const name of dataVarNames) {
                const data = reader.getDataVariable(name);
                if (data) {
                    // Assume 2D: data[latIdx * ncols + lonIdx]
                    const ncols = lonVar.length;
                    const value = data[latIdx * ncols + lonIdx];
                    if (value != null && !isNaN(value)) return value;
                }
            }
        }

        // Fallback: try GEOS projection
        const pos = latLonToGeos(lat, lon, area);
        if (pos) {
            // Get first non-coordinate variable
            for (const v of reader.variables) {
                if (['latitude', 'longitude', 'lat', 'lon', 'x', 'y', 'time'].includes(v.name)) continue;
                const data = reader.getDataVariable(v.name);
                if (data && data.length > 100) {
                    const ncols = GRID_PARAMS[area]?.ncols || Math.round(Math.sqrt(data.length));
                    const idx = pos.line * ncols + pos.col;
                    if (idx >= 0 && idx < data.length) {
                        const value = data[idx];
                        if (value != null && !isNaN(value) && value !== -9999) return value;
                    }
                }
            }
        }

        return null;
    } catch (err) {
        console.warn(`[GK2A] NetCDF-3 parse error: ${err.message}`);
        return null;
    }
}

/**
 * HDF5 / NetCDF-4 파싱 (h5wasm 사용)
 * GK2A LE2 산출물은 HDF5 형식, GEOS 투영 2D 배열
 */
// h5wasm은 ESM 전용 → promise singleton (동시 호출 시 중복 import 방지)
let _h5wasmPromise = null;
async function _getH5wasm() {
    if (!_h5wasmPromise) {
        _h5wasmPromise = (async () => {
            const mod = await import('h5wasm');
            await mod.ready; // WASM 초기화 대기
            console.log('[GK2A] h5wasm loaded OK, FS available:', !!mod.FS);
            return mod;
        })().catch(err => {
            console.warn(`[GK2A] h5wasm load FAILED: ${err.message}`);
            _h5wasmPromise = null; // 실패 시 재시도 허용
            return null;
        });
    }
    return _h5wasmPromise;
}

async function parseHDF5(buf, lat, lon, area) {
    const h5wasm = await _getH5wasm();
    if (!h5wasm) return null;

    const FS = h5wasm.FS;
    const tmpPath = '/tmp_gk2a_' + Date.now() + '.h5';
    let file = null;

    try {
        // in-memory: Uint8Array → Module.FS 임시 파일
        FS.writeFile(tmpPath, new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));

        file = new h5wasm.File(tmpPath, 'r');
        const keys = file.keys();
        console.log(`[GK2A] HDF5 root keys: ${keys.join(', ')}`);

        // ═══ HDF5 내장 투영 파라미터 읽기 → latLonToGeos 동일 수식 사용 ═══
        let pos = null;
        if (keys.includes('gk2a_imager_projection')) {
            try {
                const proj = file.get('gk2a_imager_projection');
                const attrs = proj.attrs;
                const attrKeys = Object.keys(attrs || {});
                console.log(`[GK2A] HDF5 projection attrs: ${attrKeys.join(', ')}`);
                // GK2A 표준 속성명 + 변형 시도
                const cfac = attrs?.column_scaling_factor?.value ?? attrs?.cfac?.value ?? attrs?.CFAC?.value;
                const lfac = attrs?.line_scaling_factor?.value ?? attrs?.lfac?.value ?? attrs?.LFAC?.value;
                const coff = attrs?.column_offset?.value ?? attrs?.coff?.value ?? attrs?.COFF?.value;
                const loff = attrs?.line_offset?.value ?? attrs?.loff?.value ?? attrs?.LOFF?.value;
                if (cfac && lfac && coff != null && loff != null) {
                    // latLonToGeos()와 동일한 정확한 GEOS 수식 사용
                    const DEG2RAD = Math.PI / 180;
                    const { subLon, satHeight, earthA, earthB } = GEOS;
                    const e2 = 1 - (earthB * earthB) / (earthA * earthA);
                    const latRad = lat * DEG2RAD;
                    const lonDiff = (lon - subLon) * DEG2RAD; // FIX: subLon은 도(°)
                    const geocLat = Math.atan((earthB*earthB)/(earthA*earthA) * Math.tan(latRad));
                    const cosGeoc = Math.cos(geocLat), sinGeoc = Math.sin(geocLat);
                    const re = earthB / Math.sqrt(1 - e2 * cosGeoc * cosGeoc);
                    const r1 = satHeight - re * cosGeoc * Math.cos(lonDiff);
                    const r2 = -re * cosGeoc * Math.sin(lonDiff);
                    const r3 = re * sinGeoc;
                    const rn = Math.sqrt(r1*r1 + r2*r2 + r3*r3);
                    const xx = Math.atan2(-r2, r1); // FIX: atan2 사용
                    const yy = Math.asin(-r3 / rn);
                    const col = Math.round(coff + xx * cfac / 65536);
                    const line = Math.round(loff + yy * lfac / 65536);
                    pos = { col, line };
                    console.log(`[GK2A] HDF5 projection: cfac=${cfac} coff=${coff} lfac=${lfac} loff=${loff} → col=${col}, line=${line}`);
                }
            } catch (e) {
                console.warn(`[GK2A] HDF5 projection read error: ${e.message}`);
            }
        }
        // fallback: hardcoded grid params
        if (!pos) pos = latLonToGeos(lat, lon, area);
        if (!pos) { file.close(); FS.unlink(tmpPath); return null; }

        // GK2A LE2: 데이터 변수 탐색
        let dataVar = null;
        const candidateNames = ['image_pixel_values', 'Data', 'data', 'CLD', 'NCOT', 'APPS', 'CI'];
        for (const name of candidateNames) {
            if (keys.includes(name)) {
                dataVar = file.get(name);
                break;
            }
        }
        if (!dataVar) {
            for (const key of keys) {
                const item = file.get(key);
                if (item && item.shape && item.shape.length >= 2) {
                    dataVar = item;
                    break;
                }
            }
        }

        if (!dataVar || !dataVar.shape || dataVar.shape.length < 2) {
            console.warn('[GK2A] HDF5: No suitable 2D dataset found');
            file.close();
            FS.unlink(tmpPath);
            return null;
        }

        const nlines = dataVar.shape[0];
        const ncols = dataVar.shape[1];
        console.log(`[GK2A] HDF5 data shape: ${nlines}x${ncols}, pos: col=${pos.col}, line=${pos.line}`);

        if (pos.line < 0 || pos.line >= nlines || pos.col < 0 || pos.col >= ncols) {
            file.close();
            FS.unlink(tmpPath);
            return null;
        }

        const data = dataVar.value;
        const idx = pos.line * ncols + pos.col;
        let value = data[idx];

        // NODATA 체크 — scale 적용 전에 원본값으로 검사
        const rawValue = value;
        if (rawValue === -9999 || rawValue === -999 || rawValue === 9999
            || rawValue === 65535 || rawValue === -32768 || rawValue === 0xFFFF
            || typeof rawValue !== 'number' || isNaN(rawValue)) {
            file.close();
            FS.unlink(tmpPath);
            console.log(`[GK2A] HDF5 NODATA at idx=${idx}: raw=${rawValue}`);
            return null;
        }

        // scale_factor / add_offset 속성 적용
        try {
            const sf = dataVar.attrs?.scale_factor?.value ?? dataVar.attrs?.slope?.value;
            const ao = dataVar.attrs?.add_offset?.value ?? dataVar.attrs?.intercept?.value ?? 0;
            if (sf && sf !== 1) {
                value = value * sf + ao;
                console.log(`[GK2A] HDF5 scale: raw=${rawValue} → ${value.toFixed(3)} (sf=${sf}, ao=${ao})`);
            }
        } catch { /* attrs 미지원 시 원본값 사용 */ }

        file.close();
        FS.unlink(tmpPath);
        return value;
    } catch (err) {
        console.warn(`[GK2A] HDF5 parse error: ${err.message}`);
        try { if (file) file.close(); } catch { /* ignore */ }
        try { FS.unlink(tmpPath); } catch { /* ignore */ }
        return null;
    }
}

function findNearestIndex(arr, target) {
    let minDiff = Infinity;
    let idx = 0;
    for (let i = 0; i < arr.length; i++) {
        const diff = Math.abs(arr[i] - target);
        if (diff < minDiff) { minDiff = diff; idx = i; }
    }
    return idx;
}

// ═══ 산출물별 해석 함수 ═══

/**
 * CLD (구름탐지) → cloudScore (0-8)
 * CLD 값: 0=Cloud(High), 1=Cloud(Low), 2=Clear(High), 3=Clear(Low)
 * @param {number} value - CLD pixel value
 * @returns {number} cloudScore 0-8
 */
function cldToCloudScore(value) {
    if (value == null) return null;
    // GK2A CLD: 0=확실 구름, 1=불확실 구름, 2=확실 맑음, 3=불확실 맑음
    switch (Math.round(value)) {
        case 0: return 7.5;  // Cloud (high confidence)
        case 1: return 5.0;  // Cloud (low confidence)
        case 2: return 0.5;  // Clear (high confidence)
        case 3: return 2.0;  // Clear (low confidence)
        default: return null;
    }
}

/**
 * NCOT (야간 구름 광학두께) → cloudScore (0-8)
 * τ < 0.5: 거의 맑음, τ 0.5-2: 얇은 권운, τ 2-5: 중간, τ > 5: 두꺼운
 * ISCCP 기준: τ < 3.6 = thin cirrus
 * @param {number} tau - 광학두께 (optical depth)
 * @returns {number} cloudScore 0-8
 */
function ncotToCloudScore(tau) {
    if (tau == null || tau < 0) return null;
    if (tau < 0.3)  return 0.3;  // 거의 투명
    if (tau < 1.0)  return 0.3 + (tau - 0.3) * 2.0;   // 0.3 → 1.7
    if (tau < 3.6)  return 1.7 + (tau - 1.0) * 1.15;   // 1.7 → 4.7 (ISCCP thin cirrus 경계)
    if (tau < 10.0) return 4.7 + (tau - 3.6) * 0.5;    // 4.7 → 7.9
    return 8.0;
}

/**
 * NCOT → 투명도 보정값 (transparency adjustment)
 * 광학두께가 높으면 투명도 악화
 * @param {number} tau
 * @returns {number} 0-3 (투명도 점수 가산값)
 */
function ncotToTransparencyPenalty(tau) {
    if (tau == null || tau < 0.5) return 0;
    if (tau < 1.0) return 0.3;
    if (tau < 2.0) return 0.8;
    if (tau < 5.0) return 1.5;
    return 2.5;
}

/**
 * APPS (에어로졸 광학특성) → AOD 값
 * 위성 실측 AOD — 기존 Open-Meteo 모델 예측보다 정확
 * @param {number} value - APPS pixel value (AOD at 0.55μm)
 * @returns {number|null} AOD value
 */
function appsToAOD(value) {
    if (value == null || value < 0 || value > 5) return null;
    return value;
}

/**
 * CLA (구름분석) → 위성운량 (%)
 * @param {number} value - 구름 분율 (0-100)
 * @returns {number|null}
 */
function claToCloudFraction(value) {
    if (value == null || value < 0 || value > 100) return null;
    return value;
}

// ═══ 메인 API: 위성 구름 데이터 조회 ═══

/**
 * GK2A 위성 데이터에서 특정 좌표의 구름/대기 정보 조회
 * @param {number} lat
 * @param {number} lon
 * @returns {object|null} { cloudScore, opticalDepth, transparencyPenalty, aod, source }
 */
// ═══ 백그라운드 프리페치 ═══
// GK2A HDF5(54MB) 다운로드는 느리므로 캐시 미스 시 백그라운드에서 다운로드
// 현재 요청은 null 반환 → 다음 요청에서 캐시 히트
const _pendingFetches = new Set();

async function fetchSatelliteData(lat, lon) {
    const apiKey = process.env.GK2A_API_KEY;
    if (!apiKey) return null;
    if (!isInCoverage(lat, lon)) return null;

    const obsDate = getLatestObsTime(10);
    // 한국 좌표면 ELA(확장한반도, ~23MB) 사용 — EA(동아시아, ~54MB)보다 절반 크기
    const isKorea = lat >= 30 && lat <= 44 && lon >= 120 && lon <= 135;
    const area = isKorea ? 'ELA' : DEFAULT_AREA;
    // 좌표 라운딩 → 동일 위성이미지 중복 다운로드 방지 (0.05° ≈ 5.5km, GK2A 2km 해상도 대비 적절)
    const roundLat = (Math.round(lat * 20) / 20).toFixed(2);
    const roundLon = (Math.round(lon * 20) / 20).toFixed(2);

    // 1) 현재 obs 시간 캐시 확인
    const cacheKey = `gk2a_${roundLat}_${roundLon}_${obsDate}`;
    const cached = _cacheGet(cacheKey);
    if (cached !== undefined) return cached; // null = NODATA (캐시됨), undefined = 미스

    // 2) 이전 obs 시간 캐시 확인 (10분 전) — obs 시간 전환 시 gap 방지
    const prevObs = getLatestObsTime(10, 10);
    const prevKey = `gk2a_${roundLat}_${roundLon}_${prevObs}`;
    const prevCached = _cacheGet(prevKey);

    // 3) 백그라운드 프리페치 시작
    let fetchPromise = null;
    if (!_pendingFetches.has(cacheKey)) {
        _pendingFetches.add(cacheKey);
        // Use rounded coords for pixel extraction — must match cache key
        fetchPromise = _backgroundFetch(parseFloat(roundLat), parseFloat(roundLon), obsDate, area, cacheKey);
        fetchPromise.catch(() => {}).finally(() => {
            _pendingFetches.delete(cacheKey);
        });
    }

    // 4) 이전 캐시가 있으면 즉시 반환 (stale but valid)
    if (prevCached !== undefined) return prevCached;

    // 5) 캐시가 전혀 없으면 최대 20초 대기 (US→Korea HDF5 7MB + parse 시간)
    if (fetchPromise) {
        try {
            const result = await Promise.race([
                fetchPromise,
                new Promise(resolve => setTimeout(() => resolve(null), 20000))
            ]);
            return result;
        } catch (err) {
            console.warn(`[GK2A] fetchSatelliteData wait error: ${err.message}`);
            return null;
        }
    }

    return null;
}

async function _backgroundFetch(lat, lon, obsDate, area, cacheKey) {
    const apiKey = process.env.GK2A_API_KEY;

    // 야간 판별 (관측 시각 기준 KST 18시~06시)
    // obsDate는 UTC "YYYYMMDDHHMM" → KST = UTC+9
    const obsUtcHour = parseInt(obsDate.substring(8, 10), 10);
    const kstHour = (obsUtcHour + 9) % 24;
    const isNight = kstHour >= 18 || kstHour < 6;

    // 병렬 API 호출: CLD + (야간: NCOT) + (주간: APPS)
    const fetchProduct = async (product) => {
        const url = `${GK2A_BASE}/LE2/${product}/${area}/data?date=${obsDate}&authKey=${apiKey}`;
        try {
            const res = await axios.get(url, {
                timeout: 45000,  // 백그라운드 — HDF5 최대 54MB 다운로드
                responseType: 'arraybuffer',
                validateStatus: s => s < 400
            });
            const buf = Buffer.from(res.data);
            if (buf.length < 100) {
                console.warn(`[GK2A] ${product}: response too small (${buf.length}B)`);
                return null;
            }
            console.log(`[GK2A] ${product}/${area}: ${buf.length} bytes received`);
            return buf;
        } catch (err) {
            console.warn(`[GK2A] ${product} fetch error: ${err.message}`);
            return null;
        }
    };

    // ═══ v3.3: CLD/EA(54MB) 제거 — US서버에서 다운로드 불가 ═══
    // 야간: NCOT/ELA(~7MB) → 구름 점수 + 광학두께 + 투명도
    // 주간: APPS/ELA(~수MB) → AOD (구름은 KMA/METAR 지상관측 사용)
    const products = isNight ? ['NCOT'] : ['APPS'];

    const buffers = await Promise.all(products.map(p => fetchProduct(p)));

    const result = {
        cloudScore: null,
        opticalDepth: null,
        ncotCloudScore: null,
        transparencyPenalty: 0,
        aod: null,
        obsTime: obsDate,
        source: 'GK2A',
    };

    if (buffers[0]) {
        if (isNight) {
            const tau = await extractPointValue(buffers[0], lat, lon, area);
            if (tau != null && tau >= 0) {
                // 구름 있음: NCOT 광학두께 → 구름 점수
                result.opticalDepth = parseFloat(tau.toFixed(2));
                result.ncotCloudScore = ncotToCloudScore(tau);
                result.cloudScore = result.ncotCloudScore;
                result.transparencyPenalty = ncotToTransparencyPenalty(tau);
                console.log(`[GK2A] NCOT at (${lat},${lon}): τ=${tau.toFixed(2)} → cloud=${result.ncotCloudScore?.toFixed(1)}, transPenalty=${result.transparencyPenalty}`);
            } else if (tau === null) {
                // ★ NODATA(65535) = 위성이 구름을 감지하지 못함 = 맑은 하늘
                // NCOT은 구름이 있는 픽셀만 광학두께 산출 → NODATA = clear sky
                result.opticalDepth = 0;
                result.ncotCloudScore = 0.3; // 거의 맑음 (완전 0은 과도)
                result.cloudScore = 0.3;
                result.transparencyPenalty = 0;
                console.log(`[GK2A] NCOT at (${lat},${lon}): NODATA → interpreted as CLEAR SKY (cloud=0.3)`);
            }
        } else {
            const aodVal = await extractPointValue(buffers[0], lat, lon, area);
            result.aod = appsToAOD(aodVal);
            if (result.aod != null) {
                console.log(`[GK2A] APPS at (${lat},${lon}): AOD=${result.aod.toFixed(3)}`);
            }
        }
    }

    // 결과 캐싱 (NODATA도 캐싱하여 반복 다운로드 방지)
    const hasData = result.cloudScore != null || result.opticalDepth != null || result.aod != null;
    console.log(`[GK2A] _backgroundFetch result: hasData=${hasData}, cloud=${result.cloudScore}, tau=${result.opticalDepth}, aod=${result.aod}`);
    _cacheSet(cacheKey, hasData ? result : null);
    if (hasData) {
        console.log(`[GK2A] Background fetch complete → cached (${cacheKey})`);
        return result;
    }

    console.warn('[GK2A] No valid data extracted from any product');
    return null;
}

module.exports = {
    fetchSatelliteData,
    isInCoverage,
    // Export for testing
    latLonToGeos,
    getLatestObsTime,
    detectFormat,
    cldToCloudScore,
    ncotToCloudScore,
    ncotToTransparencyPenalty,
    appsToAOD,
};
