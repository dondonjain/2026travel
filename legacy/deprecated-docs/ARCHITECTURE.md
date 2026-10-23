# 動態軌跡影音地圖 (Travel Portal) - 技術架構與決策 (Architecture & Decisions)

本文件紀錄專案的核心技術選型、目錄結構定義，以及在開發過程中確立的重要架構決策。

## 技術選型 (Tech Stack)
* **核心框架**：Next.js (App Router) + React，位於 `portal-web` 專案中。
* **地圖渲染**：Mapbox GL JS + `react-map-gl` 進行地圖 UI 封裝。
* **地理運算**：使用 `@turf/turf` 進行距離、方位角 (bearing)、路徑插值計算。
* **UI 樣式**：Tailwind CSS (透過 className 調整版面)，Icon 統一採用 `lucide-react`。

## 目錄結構慣例
* `portal-web/src/components/Map.tsx`：負責所有地圖渲染、動畫迴圈 (requestAnimationFrame)、Popup 控制的核心元件。
* `portal-web/src/data/places-metadata.json`：存放景點的擴充詮釋資料（標題、描述、分類、多媒體列表）。
* `portal-web/src/types/itinerary.ts`：共用的 TypeScript 介面定義 (如 `MediaType`, `EnrichedPlace`)。

## 重大技術與產品決策 (Key Decisions)

### 1. 多媒體渲染策略 (Media Rendering)
* **YouTube**：保留 iframe 嵌入，讓使用者能在地圖內直接觀看完整 Vlog。
* **外部短影音 (IG/FB/TikTok)**：
  * **痛點**：如果在 Popup 塞入 IG/FB 的 iframe，會造成嚴重的效能卡頓與跨網域阻擋問題。
  * **決策 (自 Phase 3-C 起)**：資料結構抽象化為 `external-video`。前端僅渲染 `thumbnail` 封面圖，加上明顯的播放圖示，點擊時透過 `window.open` 外連開啟。

### 2. 動畫效能 (Animation Performance)
* 不依賴 React 的 `setInterval`，改採 `requestAnimationFrame` 來驅動地圖進度條與座標插值，以達 60fps 順暢效果。

### 3. 資料解耦 (Data Decoupling)
* 將純地理資訊 (GeoJSON) 與業務展現資訊 (metadata) 分離，在前端透過 `id` 進行動態合併 (Enrichment)，保持地圖軌跡檔輕量。

### 4. 視角避讓與排版解耦 (Floating Side Panel & Camera Padding)
* **痛點**：將大尺寸圖文 Popup 原地錨定在座標上方會壓死景點位置並遮蔽地形周遭。
* **決策 (自 Phase 5-B 起)**：
  * 地圖層與資訊層徹底分離，改為左側懸浮卡片 (`w-[350px]`)。
  * 景點座標處加入專屬呼吸聚焦脈衝環 (Pulse Radar)，精準指引實體位置。
  * 結合 Mapbox Camera Padding (`padding: { left: 360 }`)，確保景點平滑滑移至右側開闊視線的黃金分割區。

### 5. 載具擬真化策略 (Vehicle Avatar)
* **痛點**：工程圖示感過重（圓圈加圖標），欠缺真實旅行的生動趣味與玩家視角。
* **決策 (自 Phase 5-C 起)**：
  * 捨棄沉重的 WebGL/Three.js 3D 引擎依賴，採用高精細度 2.5D 頂視向量模型 (SVG) 搭配 CSS GPU 硬體加速。
  * 加入環境光遮蔽接觸陰影、前照燈微光束、車身烤漆金屬漸層與玻璃高光，達成 Google 地圖微縮模型車質感，同時維持極致 60fps。

### 6. 劇院級旅程巡航與景點自動駐留狀態機 (Theater Cruise & Waypoint Dwell)
* **痛點**：使用者若不手動拖拉時間軸或點擊景點，無法如觀賞紀錄片般「一鍵享受整趟旅行的故事導覽」。
* **決策 (自 Phase 6-A 起)**：
  * 建立巡航雙態狀態機（`Cruising Driving` ➔ `Waypoint Dwelling`）。
  * 抵達景點時自動切換至 5 秒倒數駐留，同步觸發左側故事卡展開與 Camera EaseTo 視角聚焦。
  * **閱讀防打擾 (Hover Freeze)**：當滑鼠游標移入懸浮故事卡時，自動凍結倒數計時；移開後自動恢復。
  * **章節直達**：支援隨時上一站、下一站跳轉，並與手動拖曳時間軸安全解耦。

### 7. 行動端底部抽屜與自適應視角避讓 (Mobile Bottom Sheet & Adaptive Camera Padding)
* **痛點**：桌機端左側懸浮卡片 (`w-[350px]`) 與左側相機避讓 (`padding.left: 360`) 在手機螢幕 (寬度 375~430px) 下，會將景點擠出螢幕外，且卡片與頂部控制列、底部時間軸重疊互遮。
* **決策 (自 Phase 6-B 起)**：
  * **雙態底部抽屜 (Two-stage Bottom Sheet)**：手機端自動轉為原生級底部抽屜。平時/停靠時維持 **輕量預覽態 (Peek, 125px)**，露出上方 75% 地圖視野；點擊或上滑展開為 **深度瀏覽態 (Expanded, 72vh)**，完整呈現 YouTube 影片、IG 短影音、多圖與遊記心得。
  * **動態相機空間避讓 (Adaptive Camera Padding)**：桌機端維持 `padding.left: 360`；手機端動態切換為 `padding.bottom: 200, top: 70`，確保景點座標始終平滑聚焦於手機上半部可視黃金中心。
  * **介面元素避讓協調**：手機端開啟抽屜時，底部時間軸平滑淡出退場，關閉時復原；頂部導覽列與巡航控制列自適應收縮，杜絕任何元素碰撞。

### 8. 多天數行程動態聚合與分段巡航架構 (Dynamic Multi-Day Chapter & State Cohesion)
* **痛點**：長天數旅遊（35 個景點節點）若未分天，景點卡片過於龐雜難以翻閱，且巡航播放一次跑完全程耗時過長，無法針對「今日行程」做聚焦導覽。
* **決策 (自 Phase 6-C 起)**：
  * **零 Migration 動態聚合計算法**：底層維持輕量 GeoJSON 與中繼資料結構，前端在讀取時自動透過節點的 timestamp 依據 YYYY-MM-DD 排序聚合，動態計算出 Day 1 ~ Day 7 的日期標籤、景點統計與時段起訖 (`startTime`, `endTime`)。
  * **三維度無縫篩選**：清單模式具備「天數膠囊（全部 / Day 1~7）」、「四大類別（景點/美食/住宿/交通）」與「熱門主題標籤快篩（#世界遺產、#歷史古蹟等）」並存聯動，並提供一鍵重設按鈕。
  * **巡航控制器章節分段 (Cruise Day Segmenting)**：`CruiseController` 頂部內嵌 D1 ~ D7 快捷章節切換，選中天數時自動將巡航景點範圍與時間範圍縮小至該天，章節提示（例如 `第 2 / 5 站`）精確對齊。
  * **雙模式雙向連動 (State Cohesion)**：全域維護 `selectedDay` 狀態，從清單選取某天景點時，地圖與巡航自動同步切換至該天，維持一致的心智模型。

### 9. 網址狀態同步與漸進式防呆載入 (URL State Sync & Progressive Fallback)
* **痛點**：React 內部 State 導致重新整理後篩選狀態遺失，且大量的 IG/FB 外部圖片容易因網路問題破圖造成畫面佈局抖動 (CLS)。
* **決策 (自 Phase 7 起)**：
  * **所見即分享 (URL QueryString Deep Linking)**：摒棄複雜的全域狀態管理庫 (Redux/Zustand)，採用最簡潔的單向資料流，將 `viewMode`、`selectedDay`、`category` 等狀態提升至根目錄 `page.tsx`，並透過 Next.js `useRouter` 無痕寫回 URL。第一次載入時反向從 URL 初始化狀態，達成完美深度連結。
  * **輕量級圖片代理渲染 (OptimizedImage)**：不依賴沉重的 `next/image` 與複雜的 CDN 白名單設定，實作自訂 `<OptimizedImage>` 原生封裝。具備載入前動畫骨架屏 (Skeleton)、載入後漸進淡入、以及外部連結失效時的優雅 Fallback 佔位圖，保持系統單純且穩定。
