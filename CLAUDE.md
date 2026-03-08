# Korea Seeing App - Project Notes

## Server Configuration
- **Production Server (US only)**: https://www.clearsky.kr
- **Korea Cloud Run server has been decommissioned** (previously: korea-sky-seeing-943327451630.asia-northeast3.run.app)
- Only the US server (clearsky.kr) is in operation

## Deployment (US server ONLY - us-central1)
- Code is pushed to GitHub: git@github.com:mickeys67-svg/korea-seeing-app.git
- Server runs on Google Cloud Run (NOT Vercel)
- Project ID: mickey-485213
- Region: **us-central1** (미국) ← 반드시 이 리전에 배포할 것!
- Docker image: gcr.io/mickey-485213/korea-sky-seeing
- Build: gcloud.cmd builds submit --tag gcr.io/mickey-485213/korea-sky-seeing
- Deploy: gcloud.cmd run deploy korea-sky-seeing --image gcr.io/mickey-485213/korea-sky-seeing --platform managed --region us-central1 --allow-unauthenticated
- ⚠️ asia-northeast3에 배포하지 말 것 (한국서버 폐기됨)

## Git Config
- user.name: KIMSEUNGHO
- user.email: mickeys67@gmail.com

## Scoring Pipeline (Updated 2026-03-08)
- Transparency default: ?? 4 (null = neutral)
- Jet stream thresholds: <60kt=0, <100kt=2, <130kt=4, <160kt=6, else=8, null=4
- TKE: 0.2 in weatherService, 0.08 floor in USPModel
- Jet fallback: 1 + log1p(jetKt/80) * 0.6
