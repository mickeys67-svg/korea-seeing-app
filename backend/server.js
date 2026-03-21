console.log("Starting Server...");
require('dotenv').config();
const express = require('express');
const { Firestore } = require('@google-cloud/firestore');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const compression = require('compression');

// Import Controllers & Services
const weatherController = require('./controllers/weatherController');
const WeatherService = require('./services/weatherService');

const app = express();
const PORT = process.env.PORT || 8080;

// gzip compression — egress 60-70% 절감
app.use(compression());

// Security headers
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline styles/scripts for SPA
    crossOriginEmbedderPolicy: false,
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
    }
}));
app.use(express.json({ limit: '50kb' }));

// Firestore Database — single instance shared across all services
const db = new Firestore({ databaseId: 'koreaseeingapp1' });
app.locals.db = db;
WeatherService.setDb(db);
console.log('Firestore initialized (database: koreaseeingapp1)');

// --- Health Check (for Cloud Run / Load Balancers) ---
// Firestore write 제거 — Cloud Run은 HTTP 200만 필요, DB 확인은 실제 API 호출에서 수행
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

// --- API Routes ---
app.get('/api/weather', weatherController.getWeatherAndSeeing);

// Register CLS routes
const clsRoutes = require('./routes/cls');
app.use('/api/cls', clsRoutes);

// Register Feedback routes
const feedbackRoutes = require('./routes/feedback');
app.use('/api', feedbackRoutes);

// --- Static Asset Serving (Production) ---
if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, '../frontend/dist');

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
            // cls/ 폴더의 JS/CSS는 해시가 없으므로 캐시 금지
            if (filePath.includes('cls') && (filePath.endsWith('.js') || filePath.endsWith('.css'))) {
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
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
