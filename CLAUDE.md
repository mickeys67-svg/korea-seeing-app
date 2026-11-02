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
- ⚠️ **모든 gcloud 명령에 `--project=mickey-485213`을 반드시 붙일 것.** gcloud 기본 프로젝트가 `talktics`(별개 프로젝트)로 돼 있으면, --project 없이 돌리면 빌드가 talktics에서 실행된다. talktics와는 완전 분리 — 절대 섞지 말 것.
- Build: gcloud.cmd builds submit --tag gcr.io/mickey-485213/korea-sky-seeing --project=mickey-485213
- Deploy: gcloud.cmd run deploy korea-sky-seeing --image gcr.io/mickey-485213/korea-sky-seeing --platform managed --region us-central1 --allow-unauthenticated --project=mickey-485213
- ⚠️ asia-northeast3에 배포하지 말 것 (한국서버 폐기됨)

## Git Config
- user.name: KIMSEUNGHO
- user.email: mickeys67@gmail.com

## Scoring Pipeline (Updated 2026-03-08)
- Transparency default: ?? 4 (null = neutral)
- Jet stream thresholds: <60kt=0, <100kt=2, <130kt=4, <160kt=6, else=8, null=4
- TKE: 전단 × 혼합길이 250m — `(|du/dz| × 250)² × stabilityFactor`, clamp [0.05, 3.0] (2026-11-03 수정: dz를 혼합길이로 잘못 써서 상층 제트에 늘 상한 3.0 붙던 버그 해소), 0.08 floor in USPModel
- Jet fallback: 1 + log1p(jetKt/80) * 0.6
