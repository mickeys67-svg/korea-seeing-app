import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import viteCompression from 'vite-plugin-compression'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // v5.4 비용0원: 빌드 타임에 .gz / .br 파일 미리 생성
    // express.static이 .br/.gz를 자동으로 서빙하진 않지만, Cloudflare/CDN이 이걸 활용
    // 또한 디스크에 압축 파일이 있으면 추후 정적 파일 서버 변경 시 즉시 활용 가능
    viteCompression({ algorithm: 'gzip', ext: '.gz', threshold: 1024 }),
    viteCompression({ algorithm: 'brotliCompress', ext: '.br', threshold: 1024 }),
    // v5.4 비용0원: Service Worker로 정적 자산 + API 응답 클라이언트 캐싱
    // 재방문자는 정적 자산 0바이트, API는 stale-while-revalidate
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.webp', 'moon.jpg', 'robots.txt', 'sitemap.xml'],
      manifest: {
        name: 'Clear Skies — Astronomical Seeing Forecast',
        short_name: 'ClearSky',
        description: 'Free precision seeing forecast for astrophotographers',
        theme_color: '#0a0e1e',
        background_color: '#0a0e1e',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/logo.webp', sizes: '192x192', type: 'image/webp' },
          { src: '/logo.webp', sizes: '512x512', type: 'image/webp' },
        ],
      },
      workbox: {
        // 정적 자산(해시 파일)은 precache → 재방문자 egress 0
        globPatterns: ['**/*.{js,css,webp,jpg,svg,woff2}'],
        cleanupOutdatedCaches: true,
        // 5MB 한도 — 큰 이미지 자동 제외
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // 앱 셸(HTML)을 precache 내비게이션으로 고정하지 않는다. precache된 옛 셸 +
        // 캐시된 sw.js가 겹치면 옛 화면에 갇히는 문제가 생겼었다. 내비게이션은 아래
        // NetworkFirst로 항상 네트워크의 최신 index.html을 받고, 오프라인일 때만 캐시.
        navigateFallback: null,
        runtimeCaching: [
          {
            // HTML 내비게이션: 네트워크 우선(오프라인이면 캐시 폴백) → 셸이 캐시에 안 갇힘
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-shell',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // /api/weather, /api/photo-forecast — SWR (10분 fresh)
            urlPattern: ({ url }) => url.pathname.startsWith('/api/weather') || url.pathname.startsWith('/api/photo-forecast'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-forecast-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 30 }, // 30분 보관
            },
          },
          {
            // /api/cls/cities/search — 도시 검색은 1일 캐시
            urlPattern: ({ url }) => url.pathname.startsWith('/api/cls/cities'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'api-cities-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  }
})
