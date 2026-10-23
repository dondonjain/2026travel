# Domain Concepts and Accepted Domain Model v1

核對日期：2026-09-25。Current Model 描述目前程式；Accepted Domain Model v1 記錄已接受的領域邊界。此文件不代表 production implementation 或資料庫 schema 已完成。

## Current Model

來源：[型別](../portal-web/src/types/itinerary.ts)、[data layer](../portal-web/src/lib/places.ts)、[parser](../portal-web/scripts/parse_timeline.js)。

| 已存在概念 | 目前表示與責任 |
| --- | --- |
| 旅程／Trajectory | 一份匯入的 FeatureCollection 與根 startTime/endTime/times；目前沒有 runtime Trip entity、trip id 或多旅程選擇。 |
| 原始 visit | Timeline 偵測紀錄，有起訖、候選地點、信心及階層；不等於已策展的網站 Visit。 |
| video-node | 每筆原始 visit 產生的 Point；id 是 node-N，帶 title、description、youtubeId、timestamp。名稱不代表媒體真實性。 |
| PlaceMetadata | 依 node key 保存內容；欄位為 id、title、description、tags、media、isHighlight、category。不是以永久場所 id 索引的主檔。 |
| EnrichedPlace | 節點與 metadata 合併的 UI 物件；同時持有內容、位置、到達時間與 Day。實際單位是節點，不保證為不同實體場所。 |
| MediaItem | type、url、title、caption、thumbnail、platform；嵌在 metadata／合併物件的陣列中，沒有獨立媒體 id、拍攝時間或作者欄位。 |
| DaySummary | 從 EnrichedPlace 動態聚合的 day/dateStr/formattedDate/title/placeCount/startTime/endTime；不是持久化 Day entity。 |
| PopupInfo | Map 的展示狀態：nodeId、經緯度、內容、分類、Highlight、媒體；不保留完整造訪時間欄位。 |
| CruiseState | 型別檔存在宣告；Map 以各個 state 管理巡航，未找到對此介面的引用。 |
| Location／Review | travel-app 的獨立概念：Location 混合 day/title/jp/cat/lat/lng/note；Review 是其下留言、照片與留言時間。 |

travel-app 來源：[types](../travel-app/src/types.ts)、[App](../travel-app/src/App.tsx)、[ReviewModal](../travel-app/src/components/ReviewModal.tsx)。

## 欄位語意與邊界

| 欄位／概念 | Current State；非未來欄位分配 |
| --- | --- |
| title | 場所名、抵達／漫步等故事標題、旅程景點 N 佔位名並存。 |
| description | 地點介紹、當次心得、餐飲故事、抵達時間混用。 |
| coordinates | 原始候選地點位置，複製進每次 node；是否應成為場所固定座標或造訪快照仍未知。 |
| category | node 級分類；spot 也可能是自動分類預設，不能當成確認過的場所性質。 |
| tags | 場所特徵、活動主題與「自動分類」產製標記混合。 |
| isHighlight | node 級展示旗標，影響排序、徽章與 Marker；不是巡航站點納入條件。永久推薦或單次亮點的意圖未知。 |
| timestamp | 原始 visit.startTime；不是留言時間，也沒有表示離開時間。 |
| Day | 由有節點的日期排序編號；無節點日期不建立章節，時區依執行環境。 |
| display order | node 原陣列順序、清單 Highlight＋時間順序、巡航時間順序、media 陣列順序並存；沒有目前實作的 display_order 欄位。 |
| node id／slug | node-N 由匯入順序產生，不是地點識別；node_slug、visited_at 只出現在提案，不是目前 runtime 欄位。 |
| media | 包含固定預設影片、圖片、第三方外連；不能整體判定為本次造訪自行產出。 |

目前沒有獨立實作的 Place、Visit、ItineraryItem 三套實體；檔案位於 types/itinerary.ts 不代表已有 ItineraryItem。

## 目前資料中的模型壓力證據

以下是原始紀錄／編輯文字的事實，不保證場所命名或外部媒體內容已驗證。原始日本區間多為 UTC+09，parsed 多為 UTC+08；應比較相同瞬間，不能只比較鐘面數字。

| 案例 | Repository 證據 | 尚不能推出的結論 |
| --- | --- | --- |
| 同地重訪 | node-1/4、6/9、22/30、23/28 各組具有相同原始 placeID 與座標；node-1/4 是 8/14、8/15 兩次停留 | 不代表 metadata 名稱皆正確；重訪本身可符合一 Place 多 Visit。 |
| 跨日住宿 | initialLocations 的松江 Universal Hotel note 明寫「Day 4 & Day 5 住宿 (兩連泊)」，day 卻只有 Day 4 | 沒有日曆時間或與 portal node 的正式對照，不能認定特定 GPS node 就是該飯店。 |
| 重疊／階層 | node-2/3、17/18、20/21、28/29 分別為 hierarchyLevel 0/1，時間包含或相同；node-28/29 起訖完全相同、相距約 14 公尺、placeID 不同 | 不能直接判為先後兩次造訪，也不能未經確認就合併。 |
| 移動 | 8/14 原始 activity 有 flying 與 in train 候選類型、兩端座標與距離；parser 只納入軌跡 | 辨識交通方式並非已確認事實；移動不天然等於某個單點場所。 |
| 低內容節點 | node-15 原始停留約 2 分 53 秒；metadata 只有自動內容與預設影片 | 不能只依短停留判定沒有旅遊價值，也不能因有 node 就推定值得發布。 |
| 故事跨場所 | node-14 公園介紹中含未具名廣島燒餐飲；node-7 含甜點與咖啡經驗 | 不能認定所有故事都發生在 node 的單一位置。 |
| 第三方媒體 | node-7 external-video caption 為「看看其他旅客在倉敷的絕美短影音」 | 不符合全部媒體皆由本次 Visit 產生的直接推定。 |
| 未具名推薦 | initialLocations 的「讚岐烏龍麵 (琴平町)」note 為周邊午餐推薦 | 不是已確認的特定餐廳或已發生造訪。 |

證據：[原始 Timeline](../portal-web/src/data/raw/Timeline.json)、[parsed nodes](../portal-web/src/data/parsed-trajectory.json)、[metadata](../portal-web/src/data/places-metadata.json)、[行程清單](../travel-app/src/data/initialLocations.ts)。

## Accepted Domain Model v1

Status: ACCEPTED；尚未實作。

以下是已明確接受的領域模型，不是 repository 目前已實作架構，也不是資料庫 schema：

```text
Trip → Visit ← Place
Visit → Media
```

- Trip：一次完整旅行。
- Trajectory：這趟旅行實際走過的空間路徑；原始 GPS／Timeline 是來源，不等於網站內容。
- Visit：這趟旅行中值得被整理、展示的一次到訪經驗，不與 raw Timeline node 一對一。
- Place：可重複引用的實體／地理場所；Visit 指向 Place，同一 Place 可在同趟或不同 Trip 被多次造訪。
- Media：與 Visit 關聯，用來聚合該次到訪值得觀看的內容；不要求 Media 一定由該 Visit 當下產生。
- ItineraryItem、Movement：暫不進入 Domain Model v1。原始 Timeline 的 activity／movement 目前主要作為 Trajectory 的來源，不是獨立 CMS content entity。

## 尚未決定的問題

- Accepted model 映射到 Supabase schema 時的資料表、欄位、FK 與約束。
- Trajectory 在 schema 中的保存粒度，以及 raw GPS／Timeline 的保留方式。
- Visit、Place、Media 的具體欄位、去重規則與內容策展流程。
- 跨日住宿、巢狀 raw visit 與重疊 GPS node 在資料匯入時的具體處理。
- ItineraryItem 與 Movement 未納入 v1；未來是否重新評估仍未決定。

[既有 Phase 8 文件](../PHASE_8_DB_SCHEMA.md) 已含更具體的 Supabase schema 提案，但不自動等同於本次 accepted model 的 schema 映射。後續應先依 accepted model 進行 schema mapping，再另行決定是否實作。
