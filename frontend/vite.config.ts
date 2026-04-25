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
        // 정적 자산은 즉시 캐시 → 재방문자 egress 0
        globPatterns: ['**/*.{js,css,html,webp,jpg,svg,woff2}'],
        // index.html은 SW 업데이트 즉시 반영되도록 cleanupOutdatedCaches
        cleanupOutdatedCaches: true,
        // 5MB 한도 — 큰 이미지 자동 제외
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
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
