# 歷史專案與過期文檔歸檔區 (Legacy Archive)

本目錄存放專案發展初期的歷史網頁、單次自駕展示應用以及早期過期文件。此處內容已封存，**僅供架構回溯與歷史脈絡參考，不再進行維護或作為系統現行開發標準**。

---

## 目錄說明

### 1. `one-off-okayama-site/` (2026 年 8 月)
專案最早期的單次日本自駕旅遊展示原型：
- **`index.html`**：最初期的單檔純 HTML + Leaflet 靜態地圖原型。
- **`travel-app/`**：以 Vite + React 19 + React-Leaflet + TailwindCSS + Firebase Firestore/Storage 搭建的自駕行程展示與照片留言網頁。
- **現行對應**：已被主系統 **`portal-web/`**（Next.js 16 + Mapbox GL + Supabase CMS）全面取代。

### 2. `deprecated-docs/` (2026 年 9 月早期)
在系統尚未正式建立 `docs/` Project Memory 規範前的過期設計草案：
- **`ARCHITECTURE.md`** (2026-09-24)：早期架構文件，已被 **`docs/ARCHITECTURE.md`** 全面取代與深化。
- **`ROADMAP.md`** (2026-09-24)：早期技術藍圖，已被 **`docs/CMS_VS1_V_MODEL_PLAN.md`** 等現代計畫取代。
- **`PHASE_8_DB_SCHEMA.md`** (2026-09-25)：早期資料庫遷移提案，已被 **`docs/SUPABASE_SCHEMA_V1_SPEC.md`** 與 **`supabase/migrations/`** 正式取代。
