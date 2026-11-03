console.log("Starting Server...");
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const compression = require('compression');

// Import Controllers & Services
const weatherController = require('./controllers/weatherController');
const photoController = require('./controllers/photoController');
const WeatherService = require('./services/weatherService');

const app = express();
const PORT = process.env.PORT || 8080;

// gzip compression — egress 60-70% 절감
app.use(compression());

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
        }
    },
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Rate limiting for API routes
// Cloud Run sets X-Forwarded-For — trust proxy to get real client IP
app.set('trust proxy', 1);
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', apiLimiter);

// Middleware
const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['https://www.clearsky.kr', 'https://clearsky.kr', 'http://localhost:5173'];
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, curl, etc.)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    // v5.4 비용0원: preflight 응답을 24h 동안 브라우저가 캐시 → OPTIONS 요청 사실상 0
    maxAge: 86400,
}));
app.use(express.json({ limit: '50kb' }));

// HTTPS redirect + www canonicalization (Cloud Run sets x-forwarded-proto)
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') && req.header('x-forwarded-proto') !== 'https') {
            return res.redirect(301, `https://${req.hostname}${req.originalUrl}`);
        }
        const host = req.header('host') || '';
        if (host === 'clearsky.kr') {
            return res.redirect(301, `https://www.clearsky.kr${req.originalUrl}`);
        }
        next();
    });
}

// Firestore — lazy init: 첫 접근 시에만 클라이언트 생성 (콜드스타트 -500ms)
// ENABLE_TRAINING_DATA=false 이고 /api/feedback 호출이 없으면 영원히 초기화 안 됨 → 비용 0
let _firestoreInstance = null;
function getFirestore() {
    if (!_firestoreInstance) {
        const { Firestore } = require('@google-cloud/firestore');
        _firestoreInstance = new Firestore({ databaseId: 'koreaseeingapp1' });
        console.log('[Firestore] lazy init (database: koreaseeingapp1)');
    }
    return _firestoreInstance;
}
// feedbackController는 req.app.locals.db로 접근 — getter로 lazy 초기화 연결
Object.defineProperty(app.locals, 'db', { get: getFirestore });
// WeatherService에는 lazy 게터를 주입 (ENABLE_TRAINING_DATA=true 때만 실제 호출됨)
WeatherService.setDbResolver(getFirestore);

// --- Health Check (for Cloud Run / Load Balancers) ---
// Firestore write 제거 — Cloud Run은 HTTP 200만 필요, DB 확인은 실제 API 호출에서 수행
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

// --- SEO: Dynamic sitemap with current date ---
app.get('/sitemap.xml', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    res.type('application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.clearsky.kr/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`);
});

// --- API Routes ---
app.get('/api/weather', weatherController.getWeatherAndSeeing);
app.get('/api/photo-forecast', photoController.getPhotoForecast);

// Register CLS routes
const clsRoutes = require('./routes/cls');
app.use('/api/cls', clsRoutes);

// Register Geocode route (주소→좌표, 사용자 입력 기반 · GPS 미사용)
const geocodeRoutes = require('./routes/geocode');
app.use('/api/geocode', geocodeRoutes);

// Register Feedback routes
const feedbackRoutes = require('./routes/feedback');
app.use('/api', feedbackRoutes);

// --- Static Asset Serving (Production) ---
if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, '../frontend/dist');
    const fs = require('fs');

    // v5.4 비용0원: 사전 압축된 .br/.gz 파일을 우선 서빙 (CPU 0, 응답 ~30%↓)
    // vite-plugin-compression이 빌드 타임에 생성한 .br/.gz를 활용
    app.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        // 압축 가능 확장자만 처리
        if (!/\.(js|css|html|svg|json|woff2?)$/i.test(req.path)) return next();

        const accept = req.headers['accept-encoding'] || '';
        const tryServe = (ext, encoding, contentType) => {
            const compressedPath = path.join(distPath, req.path + ext);
            if (!fs.existsSync(compressedPath)) return false;
            res.setHeader('Content-Encoding', encoding);
            res.setHeader('Vary', 'Accept-Encoding');
            res.setHeader('Content-Type', contentType);
            // express.static의 캐시 헤더와 동일하게 맞춘다. 이 핸들러가 express.static보다
            // 먼저 돌기 때문에, 여기서 Cache-Control을 안 붙이면(sendFile은 cacheControl:false라
            // 자동 헤더도 없음) 응답에 캐시 헤더가 전혀 없어 Cloudflare가 제멋대로 캐시한다.
            // 과거 cls/*·html이 이 구멍으로 빠져 옛 위젯/셸이 고착됐다(수동 ?v= 버스팅의 원인).
            if (req.path.includes('/assets/')) {
                // 해시된 번들: 내용이 바뀌면 파일명도 바뀌므로 영구 캐시 안전
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            } else if (
                req.path.endsWith('/sw.js') || req.path.endsWith('/registerSW.js') ||
                req.path.endsWith('.webmanifest') || req.path.endsWith('.html') ||
                (req.path.includes('/cls') && (req.path.endsWith('.js') || req.path.endsWith('.css')))
            ) {
                // 해시 없는 고정 이름(PWA 제어·앱 셸·cls 위젯): 캐시되면 옛 버전이 고착 → 반드시 no-cache
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            }
            // 그 외 비해시 정적(favicon.svg 등)은 sendFile 기본값에 맡긴다.
            res.sendFile(compressedPath, { cacheControl: false, immutable: false });
            return true;
        };

        // MIME 타입 추정
        const ext = path.extname(req.path).toLowerCase();
        const mime = {
            '.js': 'application/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.html': 'text/html; charset=utf-8',
            '.svg': 'image/svg+xml',
            '.json': 'application/json; charset=utf-8',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
        }[ext] || 'application/octet-stream';

        if (accept.includes('br') && tryServe('.br', 'br', mime)) return;
        if (accept.includes('gzip') && tryServe('.gz', 'gzip', mime)) return;
        next();
    });

    // 1. Serve static files — HTML no-cache, assets immutable (hashed filenames)
    app.use(express.static(distPath, {
        maxAge: '1y',      // 해시된 에셋(JS/CSS): 1년 캐시 (파일명에 해시 포함)
        immutable: true,   // 브라우저가 재검증 요청 안 보냄
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('.html')) {
                // HTML은 항상 최신 버전 제공
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            }
            // robots.txt, sitemap.xml — 해시 없는 SEO 파일은 캐시 금지
            if (filePath.endsWith('robots.txt') || filePath.endsWith('sitemap.xml')) {
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            }
            // cls/ 폴더의 JS/CSS는 해시가 없으므로 캐시 금지
            if (filePath.includes('cls') && (filePath.endsWith('.js') || filePath.endsWith('.css'))) {
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            }
            // PWA 서비스워커·매니페스트: 해시 없는 고정 이름 → no-cache로 SW 자동 갱신 보장.
            // (1년 immutable이면 새 sw.js가 안 내려가 옛 앱이 영영 서빙됨)
            if (filePath.endsWith('sw.js') || filePath.endsWith('registerSW.js') || filePath.endsWith('.webmanifest')) {
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            }
        }
    }));

    // 2. Catch-all for SPA - Must be the LAST route
    // Use regex to avoid string parsing issues in Express 5
    app.get(/.*/, (req, res) => {
        // Safe check for URL - Only serve index.html for non-API GET requests
        const url = req.originalUrl || req.url || '';
        if (req.method === 'GET' && !url.startsWith('/api')) {
            // SEO: Only serve index.html for root path
            // Non-root paths → 301 redirect to prevent Google from indexing duplicate pages
            if (url !== '/' && url !== '') {
                return res.redirect(301, '/');
            }

            // FORCE NO-CACHE for index.html entry point
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            const indexPath = path.join(distPath, 'index.html');
            return res.sendFile(indexPath, (err) => {
                if (err) {
                    console.error(`Error sending index.html from ${indexPath}:`, err.message);
                    if (!res.headersSent) {
                        res.status(500).send('Frontend build not found.');
                    }
                }
            });
        }

        // If not a GET or is an API route that reached here, 404
        res.status(404).json({ error: 'Route not found' });
    });
} else {
    // Basic fallback for development if someone hits a non-existent route
    app.get('/', (req, res) => {
        res.send('Korea Sky Seeing API is running. (Development Mode - Please run frontend separately)');
    });
}

// --- Global Error Handling Middleware ---
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
