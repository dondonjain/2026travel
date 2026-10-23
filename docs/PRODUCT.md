# Product Knowledge

核對日期：2026-09-25。狀態：Current State 與 Open Questions 分開記錄。

## 閱讀與維護方式

這是供人類、Codex、ChatGPT 與其他 agent 共用的 repository 專案記憶，不是應用程式資料庫，也不是實作授權。

- [ARCHITECTURE.md](ARCHITECTURE.md)：目前程式與資料如何運作。
- [DOMAIN_MODEL.md](DOMAIN_MODEL.md)：已存在概念、資料證據與 accepted Domain Model v1；未決事項另行列出。
- [DECISIONS.md](DECISIONS.md)：決策狀態、既有決策文件索引及 ADR template。
- [CURRENT_TASK.md](CURRENT_TASK.md)：目前問題、限制與停止點；開始後續工作前先讀。

Current State 必須能連回程式或資料；產品意圖無證據時標記 Unknown / Open Question。假設經確認後才能更新決策狀態，不能因程式存在或文件使用「決定」一詞就推定人類已接受。未來修改相關實作時，應重新核對文件的來源與核對日期。

## 產品目的

### Current State

`portal-web` 提供「動態軌跡影音地圖」：以地圖、時間播放、景點清單與多媒體故事呈現 repository 內的旅程資料。可由 [頁面](../portal-web/src/app/page.tsx)、[Map](../portal-web/src/components/Map.tsx) 及 [既有 Roadmap](../ROADMAP.md) 確認。

Repository 另有 `travel-app`，提供 Day／分類行程瀏覽、地圖與留言照片功能。它具有獨立的 Firebase 資料流；目前未找到與 `portal-web` 的資料對照或整合程式。兩者未來是整合、並存或取代關係：Unknown。

## 主要使用者

| 面向 | 證據與狀態 |
| --- | --- |
| 旅程內容瀏覽者 | Current State：portal UI 支援看清單、操作地圖、播放軌跡及閱讀媒體。這是可觀察的使用角色，不等於已確認的客群定位。 |
| 登入後留言者 | Current State：travel-app 的 ReviewModal 提供文字與照片留言；可用性仍取決於外部 Firebase 設定。 |
| 非技術內容編輯者 | Known Direction：Roadmap Phase 8 明列 CMS 讓非技術人員新增景點、編輯天數及上傳媒體；不是目前 portal 已提供的角色／後台。 |
| 商業客群、內容擁有者與權限角色 | Unknown：未找到足以確認的產品規格。 |

## 核心使用情境與既有功能

### portal-web — Current State

- 切換地圖與景點清單；從卡片選取節點後切到地圖、同步其 Day 與時間位置。
- 清單按 Day、Category、Tag 篩選；Highlight 優先，再依時間排序。
- 播放或拖曳時間軸，觀看軌跡、載具位置與已到達節點。
- 啟動 Cruise，自動依時間順序停靠；支援上一站、下一站、暫停、退出與閱讀暫停。
- 桌機故事面板、手機可展開底部抽屜；呈現介紹、心得、標籤與媒體。
- YouTube iframe、圖片、external-video 縮圖與外連。
- URL 儲存 mode、day、category、tag；不是特定節點／播放進度的完整分享連結。

來源：[page](../portal-web/src/app/page.tsx)、[PlaceCardGrid](../portal-web/src/components/PlaceCardGrid.tsx)、[PlaceCard](../portal-web/src/components/PlaceCard.tsx)、[Map](../portal-web/src/components/Map.tsx)、[CruiseController](../portal-web/src/components/CruiseController.tsx)。

### travel-app — Current State

從 Firestore `locations` 讀取行程，空資料或讀取失敗時使用 `initialLocations`。支援 Day／分類篩選、Leaflet 地圖、外連 Google Maps，以及登入使用者的文字／照片留言。程式亦提供靜態清單匯入 Firebase 的操作；本次未執行。

來源：[App](../travel-app/src/App.tsx)、[LocationCard](../travel-app/src/components/LocationCard.tsx)、[ReviewModal](../travel-app/src/components/ReviewModal.tsx)。雲端實際內容、權限及正式部署狀況未查證。

## 已知方向，不代表已實作或已定案

- [ROADMAP.md](../ROADMAP.md) Phase 8：內容管理後台與動態資料來源；仍列出 Supabase / Firebase / Prisma + PostgreSQL 評估方向。
- [PHASE_8_DB_SCHEMA.md](../PHASE_8_DB_SCHEMA.md)：已有 Supabase、Place／Visit 拆分及遷移提案。它仍是 schema／migration 提案，不是執行指令；Domain Model v1 已 accepted，但 schema、欄位、權限與 migration 仍未決定。
- Place、Visit、ItineraryItem 的 Domain Model v1 已 accepted；Supabase schema、欄位、權限與 migration 等後續議題仍待決定，詳見 [CURRENT_TASK.md](CURRENT_TASK.md)。

## 尚未確認的產品問題

- 主要服務個人旅遊回顧、同行者、公開讀者，還是內容編輯團隊？
- 計畫中的行程、推薦與實際發生的造訪是否都在產品範圍內？
- 「景點數」代表不同場所數量，還是造訪／故事節點數量？
- Day 是日曆日、旅程第 N 天，還是人工編排章節？採哪個時區？
- 地點介紹、當次心得、Tags、Highlight 與第三方媒體的內容歸屬為何？
- CMS、多旅程、帳號權限及發布流程的具體範圍為何？
- 兩個應用是否共用未來的內容與留言？

以上均為 Open Questions，不由現有型別名稱推導答案。
