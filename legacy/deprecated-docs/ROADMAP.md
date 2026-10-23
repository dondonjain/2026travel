# 動態軌跡影音地圖 (Travel Portal) - 開發藍圖 (Roadmap)

本文件紀錄專案的歷史里程碑與未來的階段規劃。每次完成重大階段時，請更新此文件。

## 已完成階段 (Completed)

### Phase 1 ~ 3: 地圖基礎與多媒體整合
* **基礎地圖渲染**：整合 Mapbox 與 `react-map-gl`，支援地圖基本操作。
* **靜態景點 Popup**：景點標記與 Popup 彈窗基本框架，支援標籤 (Tags)、分類 (Category)、摘要 (Description)。
* **多媒體播放 (YouTube)**：在 Popup 中以 `iframe` 嵌入 YouTube 影片。
* **Phase 3-C 多元社群短影音 (Lightweight)**：
  * **目標**：支援 IG Reels、FB Shorts 等短影音。
  * **決策**：不採用 `iframe`，而是採用「封面圖 (Thumbnail) + Play 播放按鈕疊加 + 點擊外連」架構，以確保行動裝置效能。

### Phase 4: 真實動態軌跡與載具
* **動態軌跡進度**：支援根據時間軸自動推進軌跡線與攝影機跟隨 (Camera tracking)。
* **真實道路貼合**：使用 Mapbox Directions API 產生真實道路 GeoJSON 軌跡。
* **動態載具圖示**：透過 turf.js 計算方位角 (Bearing)，根據交通方式（飛行/平面）動態切換圖示（飛機/汽車）並旋轉車頭。

### Phase 5-A: 語意感知動態變速與鏡頭抗抖動
* **夜間 40 倍速快轉**：自動判別深夜時間 (23:00~07:00) 加速跳過無效停留，白天維持正常速度保留深度旅遊時長。
* **相機視野平滑調優**：調降傾角 (Pitch 35) 並設定飛航鳥瞰 (Zoom 5)，修復線段插值導致的頻繁 Zoom In/Out 抖動。

### Phase 5-B: 懸浮側邊資訊面板 (Floating Side Panel)
* **排版解耦**：將原地遮蔽景點的錨點 Popup，重構為左側懸浮毛玻璃資訊面板。
* **景點聚焦動效**：選中景點時觸發座標點上的呼吸脈衝光圈 (Pulse Radar)，精準辨識地理位置。
* **鏡頭避讓演算法 (Camera Padding)**：選中或聚焦時自動計算 Padding，使景點與周遭地形開闊露出於右側可視中心。

### Phase 5-C: 擬真微縮模型車載具 (Toy-car Miniature Avatar)
* **Google 地圖質感模型車**：繪製 2.5D 頂視立體流線跑車，包含金屬烤漆光澤、擋風玻璃高光、全景天窗、前後車燈光束與車底環境陰影。
* **微縮客機航行模型**：飛航模式同步切換為 2.5D 噴射客機，具備後掠主翼、雙渦輪引擎與翼端航行信標燈。
* **硬體加速平滑轉向**：搭配 GPU 加速的旋轉過渡 (transition-transform)，過彎時呈現順暢的模型車轉向動態。

### Phase 6-A: 劇院級旅程巡航導覽模式 (Theater Cruise Mode)
* **沙發馬鈴薯沉浸觀影**：提供「開始欣賞旅程」漂浮啟動膠囊，一鍵自動沿真實道路啟程。
* **景點自動駐留 (Auto-Dwell)**：抵達景點時自動懸停 5 秒並展現倒數光條，左側故事卡平滑展開，鏡頭同步聚焦。
* **閱讀防打擾機制 (Hover Freeze)**：滑鼠懸停故事卡時自動凍結倒數，移出後恢復。
* **劇院控制器 (CruiseController)**：支援即時章節標示（如 `第 3 / 18 站`）、上一站/下一站跳轉與隨時插斷退出。

---

### Phase 6-B: 行動端底部抽屜適配與響應式視角避讓 (Mobile Bottom Sheet & Responsive Spatial Layout)
* **原生級底部抽屜 (Bottom Sheet)**：手機窄螢幕 (<640px) 自動切換為抽屜佈局，支援輕量預覽態 (Peek, 125px) 與深度瀏覽態 (Expanded, 72vh) 滑順切換。
* **自適應相機避讓 (Adaptive Camera Padding)**：桌機端維持左側避讓 (`padding.left: 360`)，手機端自動切換為底部避讓 (`padding.bottom: 200, top: 70`)，確保景點座標永遠置於手機上半部黃金視覺中心。
* **介面元素防遮碰協調**：手機端展開抽屜時，底部時間軸自動淡化避讓；頂部導覽列與 CruiseController 控制器小螢幕自動縮減間距與文字，全載具零破版。

---

### Phase 6-C: 多天數章節分段巡航與主題標籤篩選 (Multi-Day Chapter & Tag Filter)
* **動態日期聚合演算法**：無須手動設定或更動靜態資料，前端依據節點 timestamp 自動分析對應出 Day 1 ~ Day 7 行程與景點統計。
* **分天與主題多維過濾**：景點清單支援「全部天數 / Day 1 ~ Day 7」膠囊切換、景點/美食/住宿/交通分類篩選，以及動態聚合熱門標籤 (#世界遺產、#歷史古蹟等) 一鍵快篩。
* **劇院分段巡航控制**：CruiseController 整合天數分段膠囊 (D1 ~ D7)，選取特定天數時地圖巡航自動限定在該天時段內，時間軸進度與景點章節編號同步對齊。
* **雙模式狀態同步**：地圖模式與景點清單模式共用全域天數狀態，從清單選取特定景點跳轉回地圖時，自動切換至該景點所屬天數與時間點。

---

### Phase 7-A: URL 深度連結與狀態分享 (Deep Linking & State Sharing)
* **網址狀態雙向綁定**：將 `viewMode`、`selectedDay`、`activeCategory`、`activeTag` 等瀏覽狀態全部集中至上層控管，並與 URL QueryString 綁定。
* **無縫分享與載入**：實現了「所見即分享」，使用者將帶有參數的網址分享給朋友，開啟後會直接進入特定的天數、分類或清單狀態。

### Phase 7-B: 圖片體驗優化與防呆 (Image Optimization & Fallback UX)
* **輕量級圖片渲染機制**：實作自訂 `OptimizedImage` 元件，摒棄沉重的 Next.js `next/image` 設定，改採原生 `onLoad`/`onError` 狀態管理。
* **漸進式骨架屏 (Progressive Skeleton)**：圖片載入完成前顯示動畫骨架屏，載入後平滑淡入，大幅降低畫面抖動 (CLS)。
* **防破圖機制**：針對失效的外部圖片資源（如 IG 臨時縮圖），提供優雅的 Fallback UI，維持良好的使用體驗。

---

## 進行中 / 待認列階段 (Current / Upcoming)

### Phase 8: 內容管理後台與動態資料庫 (CMS & Database Migration)
* **預期目標**：打破目前依賴靜態 `places-metadata.json` 與 GeoJSON 的限制，建置後台系統 (Admin Panel) 讓非技術人員能新增景點、編輯行程天數與上傳多媒體。
* **技術方向**：評估引入 Supabase / Firebase / Prisma + PostgreSQL 作為動態資料來源，並設計資料庫 Schema 進行無痛搬遷。
* **下一步行動**：由 PM 定義具體範圍並進行評估。
