# Google Cloud Run 배포 가이드

이 가이드는 "Korea Sky Seeing" 애플리케이션을 Google Cloud Run에 배포하는 절차를 상세히 설명합니다.

## GitHub와 배포의 관계
질문하신 **"GitHub에 먼저 올려야 하나요?"**에 대한 답변입니다:
- **필수는 아닙니다**: 아래 소개하는 `gcloud builds submit` 방식은 **현재 내 컴퓨터의 파일**을 직접 압축해서 Google Cloud로 전송합니다. 따라서 GitHub에 올리지 않아도 배포는 가능합니다.
- **권장합니다**: 하지만 코드 분실 방지와 이력 관리를 위해 배포 전 GitHub에 커밋(Commit) 및 푸시(Push)하는 것을 **강력히 권장**합니다.

---

## 전제 조건 (Prerequisites)

1.  **Google Cloud SDK (gcloud CLI)**가 설치되어 있어야 합니다. (터미널에서 `gcloud` 입력 시 반응이 있어야 함)
2.  **Google Cloud Project**가 생성되어 있어야 합니다.
3.  해당 프로젝트에 **결제(Billing)**가 활성화되어 있어야 합니다.

## 배포 단계별 상세 설명

### 1. (선택사항) GitHub에 코드 저장
가장 안전한 방법은 코드를 먼저 저장하는 것입니다.
```bash
git add .
git commit -m "배포 전 코드 저장"
git push origin main
```

### 2. 필요한 Google Cloud 서비스 활성화
배포에 필요한 클라우드 서비스(이미지 저장소, Cloud Run 실행 환경)를 켭니다. 한 번만 하면 됩니다.

```bash
gcloud services enable containerregistry.googleapis.com
gcloud services enable run.googleapis.com
```

### 3. 프로젝트 ID 설정
`[YOUR_PROJECT_ID]`를 실제 구글 클라우드 프로젝트 ID로 바꿔서 입력하세요.
(예: `korea-sky-app-12345`)

```bash
gcloud config set project [YOUR_PROJECT_ID]
```

### 4. 컨테이너 빌드 및 업로드 (Build)
이 명령어가 **내 컴퓨터의 코드를 Google 서버로 전송**하고, Docker 이미지를 만듭니다.
*Docker가 내 컴퓨터에 설치되어 있지 않아도, 구글 서버에서 빌드하므로 상관없습니다.*

```bash
gcloud builds submit --tag gcr.io/[YOUR_PROJECT_ID]/korea-sky-seeing
```

### 5. Cloud Run으로 배포 (Deploy)
만들어진 이미지를 실제 서비스로 배포합니다.

```bash
gcloud run deploy korea-sky-seeing \
  --image gcr.io/[YOUR_PROJECT_ID]/korea-sky-seeing \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,MONGODB_URI=[YOUR_MONGODB_CONNECTION_STRING]
```

*   **Region**: `asia-northeast3`는 서울 리전입니다.
*   **MONGODB_URI**: 실제 몽고DB 접속 주소(비밀번호 포함)를 입력해야 합니다. 따옴표(`"`)로 감싸주는 것이 좋습니다.
    * 예: `MONGODB_URI="mongodb+srv://user:pass@cluster..."`

### 6. 배포 확인
배포가 완료되면 터미널에 **Service URL**이 출력됩니다 (예: `https://korea-sky-seeing-xyz.a.run.app`).
해당 주소를 클릭하여 웹사이트가 잘 뜨는지 확인하세요.

## 팁 & 문제 해결

- **업데이트 하려면?**: 코드를 수정한 뒤, **4번(빌드)**과 **5번(배포)** 과정만 다시 반복하면 됩니다.
- **에러 발생 시**: Google Cloud Console 접속 -> Cloud Run -> 해당 서비스 클릭 -> **Logs(로그)** 탭에서 상세한 에러 원인을 확인할 수 있습니다.
