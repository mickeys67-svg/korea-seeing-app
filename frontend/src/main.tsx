import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// v5.4 비용0원: Service Worker — 재방문자 egress 0 만들기
// vite-plugin-pwa의 registerSW는 자동 갱신 (autoUpdate) 설정과 함께 작동
if ('serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true });
  }).catch(() => { /* SW registration optional */ });
}
