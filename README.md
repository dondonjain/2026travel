# Travel Portal (動態旅行敘事與審核平台)

本專案是一個專為旅行紀錄、時空軌跡重構、與劇院級敘事漫遊（Cruise Playback）打造的動態旅行展示與後台審核系統。

---

## 專案核心架構

```text
travel/
├── portal-web/      # [核心] 前端應用與創作者後台 (Next.js 16 + React 19 + Mapbox GL)
├── supabase/        # [核心] 資料庫結構與安全合約 (PostgreSQL 17 + PostGIS + RLS)
├── docs/            # [核心] 專案長期記憶庫 (Project Memory)
├── journals/        # [核心] 開發日誌與工程決策歷程
├── legacy/          # [歸檔] 早期一次性網頁與歷史過期草案 (唯讀封存)
├── scratch/         # [暫存] 診斷日誌、臨時腳本與補丁
└── AGENTS.md        # [規範] AI 協作規範與安全邊界操作手冊
```

---

## 目錄導覽與職責

### 1. 前台與後台主系統 (`portal-web/`)
- **前台讀者端**：以 Mapbox GL 呈現 60fps 平滑視角、自適應相機避讓（Camera Padding）、隱私軌跡裁切（Privacy Gap Skip）與章節式敘事漫遊。
- **後台審核端 (`/cms`)**：提供創作者審核 Google Timeline 重建行程的專用工作台（`Trip → Day → Visit → Detail → Confirm → Preview`），支援即時地圖證據校正與草稿全螢幕漫遊預覽。

### 2. 資料庫與安全層 (`supabase/`)
- 採用 **PostgreSQL 17 + PostGIS**，嚴格實作 Row Level Security (RLS)。
- 區隔 `app`（私有資料）、`api_public`（讀者端公開安全投影）與 `api_cms`（認證創作者 RPC 與防呆觸發器）。

### 3. 專案記憶庫 (`docs/`)
專案所有重大決策、架構規範與當前任務均記錄於此，所有 AI 與開發者作業前必須先研讀：
- **當前任務狀態**：[`docs/CURRENT_TASK.md`](docs/CURRENT_TASK.md)
- **CMS 治理藍圖與檢查點**：[`docs/CMS_CURRENT_STATUS.md`](docs/CMS_CURRENT_STATUS.md)、[`docs/CMS_VS1_V_MODEL_PLAN.md`](docs/CMS_VS1_V_MODEL_PLAN.md)
- **系統架構基準**：[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **領域模型定義**：[`docs/DOMAIN_MODEL.md`](docs/DOMAIN_MODEL.md)
- **安全邊界手冊**：[`docs/SECRET_BOUNDARY.md`](docs/SECRET_BOUNDARY.md)

---

## 快速啟動

### 開發前台與 CMS 後台
```bash
cd portal-web
npm install
npm run dev
```
瀏覽器開啟 `http://localhost:3000`（前台讀者頁）或 `http://localhost:3000/cms`（審核後台）。

### 執行自動化測試與安全掃描
```bash
cd portal-web
npm test                 # 執行所有核心邏輯與合約測試
npx tsc --noEmit        # TypeScript 靜態型別檢查
npm run qa:secret-scan  # 敏感憑證掃描
```
