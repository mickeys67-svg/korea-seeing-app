# Cafe24 Migration Guide ☕

Cafe24 Node.js Hosting requires a few specific settings different from Render.

## 1. Prerequisites
- **Node.js Hosting**: Ensure you purchased "Node.js Hosting" (not Web Hosting).
- **Git**: Ensure you have the git repository URL from Cafe24 (e.g., `userid@userid.cafe24.com:userid`).

## 2. Prepared Files (Already Done ✅)
- **`web.js`**: Created in project root (Cafe24 requires this specific filename).
- **`.gitignore`**: Updated to *include* `package-lock.json` and `dist/` (build artifact).
    - Cafe24 servers often struggle to build React apps due to resource limits. We will upload the **pre-built** frontend.

## 3. Deployment Steps

### Step A: Build Frontend Locally (중요! ⭐)
Cafe24 서버는 사양이 낮아서, 서버에서 직접 빌드하면 메모리 부족으로 멈출 수 있습니다.
그래서 내 컴퓨터(로컬)에서 미리 화면을 만들어서 파일만 올리는 방식을 씁니다.

1. **터미널 열기**: VS Code에서 터미널을 엽니다 (`Ctrl` + `~`).
2. **명령어 입력**:
   ```bash
   cd frontend
   npm run build
   cd ..
   ```
   (이러면 `frontend/dist` 폴더가 생깁니다. 이 폴더가 우리가 만든 웹사이트의 실체입니다.)

### Step B: Commit Everything (빌드된 파일 포함)
우리가 `.gitignore`를 수정해서 `dist` 폴더도 Git에 올라가도록 설정했습니다.

```bash
git add .
git commit -m "Deploy: Upload built frontend assets to Cafe24"
```

### Step C: Push to Cafe24 (업로드)
Cafe24에서 받은 git 주소로 밀어넣습니다. (처음에 한 번만 `remote add` 하면 됩니다.)

```bash
# 만약 Cafe24 리모트 연결 안 했다면:
# git remote add cafe24 [상점아이디]@builder.cafe24.com:[상점아이디]

git push cafe24 main
```
(비밀번호를 물어보면 Cafe24 호스팅 비밀번호/FTP 비밀번호를 입력하세요.)

### Step D: Restart Server
1. Go to Cafe24 **Node.js App Management** console.
2. Click **Stop** then **Start** (or Restart).

## 4. Environment Variables
- Ensure you set `MONGODB_URI` in the Cafe24 App Management console if possible, or create a `.env` file on the server (via SSH/FTP).
- Do not commit `.env` to git for security.
