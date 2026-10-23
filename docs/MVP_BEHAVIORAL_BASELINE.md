# MVP Behavioral Baseline

狀態：ACCEPTED。採用日期：2026-09-27。  
適用範圍：所有會影響 Travel Portal 使用者可見行為的實作、重構、測試與 runtime／UX verification。

## 1. Product intent

Travel Portal 的地圖播放不是單純的軌跡動畫，而是一段可由使用者閱讀、暫停、探索與導覽的旅程敘事。使用者應能理解目前位於哪一站、以舒適的節奏觀看移動、在每個 Visit 閱讀完整故事，並可隨時手動探索地圖。

本文件定義該體驗的行為契約。它不指定內部資料結構、framework 或演算法；內部實作可以改變，但可觀察的使用者體驗必須相容。

## 2. Golden reference

- Golden branch：`archive/gps-timestamp-playback`
- Preservation commit：`aa0548a`

該版本是已調校的 MVP 行為規格，不只是 legacy code、靈感或實作範例。除非本文件記錄為 approved deviation，任何使用者可見差異都先視為 regression。

## 3. Must-preserve behaviors

### 3.1 Chronological narrative and Day scope

- Visits 依時間順序播放為一段旅程故事。
- 選擇 Day 會適當地重設並縮小該段故事；全覽則涵蓋整段旅程。
- 跨 Day 的安全移動不可被靜默省略。應保留安全的移動表示，讓使用者理解跨日邊界；不得補造 raw timing、隱藏幾何或新的重大 UX 慣例。

### 3.2 Visit dwell and reading protection

- 抵達 Visit 時，Cruise 依 3.3 的已核准 provisional dwell mapping 停留（無 trusted duration 時為 4 秒）；此值讓使用者閱讀該站故事，並取代原 MVP 的約 5 秒單一值。
- 閱讀行為必須防止非預期的倒數前進；MVP 中的 hover 與行動裝置展開閱讀語意均屬此保護。
- 在 active dwell 中關閉故事，或點擊空白地圖，代表使用者已完成此站；Cruise 必須前往下一站，而不是只關閉內容並等待剩餘倒數。

### 3.3 Provisional Visit dwell pacing — subject to real-MVP QA

此規則僅控制 Cruise 抵達 Visit 後的**敘事 dwell time**；它不是實際歷史經過時間的線性呈現，也不得與 movement pacing 混用。

| Real Visit duration | Cruise dwell |
| --- | --- |
| 少於 30 分鐘 | 1.5 秒 |
| 30 ≤ d < 45 分鐘 | 2.0 秒 |
| 45 ≤ d < 60 分鐘 | 2.8 秒 |
| 60 ≤ d < 90 分鐘 | 4.0 秒 |
| 90 ≤ d < 120 分鐘 | 5.0 秒 |
| 120 ≤ d < 180 分鐘 | 6.5 秒 |
| d ≥ 180 分鐘 | 8.0 秒 |

- 180 分鐘以上一律維持 8.0 秒上限。
- 不得新增 threshold、插值或其他 duration 規則。
- 此規則狀態為 **PROVISIONAL / SUBJECT TO REAL-MVP QA**。
- trusted `started_at`／`ended_at` 只能由 backend/private layer 用於導出 dwell；public frontend 不得接收該等 raw timestamps，也不得從相鄰 `occurred_at` 或 raw GPS 推論 duration。
- 已接受 Option A：Visit 儲存 curated/public `narrative_dwell_ms`。public playback 只可取得這一個最小的 derived dwell value；不得藉此擴大 public API 或暴露 private source records。
- 缺少 trusted Visit duration 時，`narrative_dwell_ms = 4000`；這是已核准 fallback。

### 3.4 Cruise Controller

Cruise Controller 是主要 guided-tour interaction model，必須保留：

- 開始巡航；
- play／pause／resume；
- 目前站點與總站數的方向感；
- previous／next；
- Day 選擇；
- dwell progress；
- exit；
- 停靠、聚焦與故事閱讀狀態。

Previous／Next 必須讓使用者可見地聚焦被選取的 Visit，並進入該站的 dwell／story state；不得只改變隱藏進度。

### 3.5 Camera and map framing

以下 MVP 調校值是初始 baseline，不得被新的「reasonable defaults」靜默替換：

| Interaction | Baseline framing |
| --- | --- |
| Visit focus | 約 zoom 14.5、pitch 35°、800 ms |
| Card-to-map | 約 zoom 14.5、pitch 35°、1,200 ms |
| Route follow | 現有 scale-sensitive follow-camera 與平滑過場 |
| Follow bands | 現有已調校的 local／regional／long zoom/pitch bands |
| Journey completion | 平靜地以 safe/public geometry 全覽旅程 |

Movement camera framing 以每個 Movement 的完整 safe/public route characteristics 選擇並鎖定既有 follow band；Movement 期間主要以中心平移跟隨 marker，不得以當下短視窗 sample spacing 每 frame 重選 zoom band。下一個 Movement 可重新選擇既有 band，Visit arrival 仍恢復既有 focus framing。

Card、marker 與 Cruise 對同一 Visit 的互動必須收斂到同一則 Visit story。手動探索仍必須可用，且與 guided Cruise 行為相容。

### 3.6 Progressive journey and privacy gaps

- 路徑在播放時逐步呈現，但只能使用 privacy-safe public geometry。
- 旅程完成時，使用 safe/public geometry 顯示全覽。
- privacy gap 不得繪製、插值或以 fake connector 連接 hidden route。
- 跨越 privacy gap 時，avatar 消失或保持 absent，鏡頭轉場至下一段安全 segment，再從安全 geometry 恢復播放。

### 3.7 Narrative progress control

必須保留可拖曳的 narrative progress scrubber。它呈現 Visit／movement 的敘事進度，而不是 private raw GPS telemetry time；使用者應能理解旅程進度並主動定位播放位置。

### 3.8 Meaningful media storytelling

在來源媒體支援時，每個 Visit 必須維持 MVP-equivalent 的完整故事能力：

- 多個 media items；
- media 選擇與切換；
- embedded YouTube；
- external-video preview／presentation；
- images；
- tags；
- description；
- 適合行動裝置閱讀的行為。

不得未經新的產品核准而把此體驗簡化成單一媒體或僅提供外部連結。

## 4. Tunable behaviors

下列行為可以調整，但只要使用者可見，就必須經 explicit product review。現有 MVP 參數仍是初始 baseline：

- 整段旅程的總時長；
- movement-duration formula；
- 各 movement 的 lower／upper duration caps；
- night acceleration；
- highlight-marker transition duration；
- avatar 視覺樣式；
- camera 的精確 threshold。

### Approved hybrid pacing direction

播放採用 hybrid pacing model：維持 MVP 已調校的整體旅程節奏與時長感；在該 envelope 內，再以 transport mode + distance 調整各段 movement pace，並使用明確的 lower／upper bounds。

單一超長 movement 不得僅因實體距離很大而主導整段播放。當尚無可信的 public transport-mode source 時，使用已核准的 fallback；不得從敏感 GPS 推論 car／plane，也不得捏造 transport semantics。transport-mode source 的選擇仍是獨立產品決策。

## 5. Implementation-only mechanisms

以下舊機制本身不是產品需求，可以替換：

- exact raw GPS point-by-point timestamp playback；
- raw `pointTimes`；
- raw GPS timestamp interpolation；
- 舊有相鄰 sample 超過 3 km 的 flight heuristic；
- internal timestamp nudge logic；
- `lastNodeCount` implementation mechanism；
- rendering protected/private portions of the raw route。

替換這些機制時，仍須保持本文件指定的可見結果。

## 6. Approved deviations from the MVP

以下偏離 MVP 的事項已核准：

1. Public playback 使用 privacy-safe trajectory geometry，而非完整 raw route geometry。
2. Hidden/redacted trajectory sections 不得重建。
3. Public frontend 不得暴露 exact raw GPS timestamps。
4. transport mode 不可用時，不得猜測 vehicle type。
5. Narrative timing 內部可不同於精確歷史 elapsed time，但必須保留已調校的敘事節奏。

## 7. Product-decision stop rule

**STOP 並回到產品擁有者，先取得明確裁決後才可實作**，只要出現以下任一情況：

- 既有 baseline behavior 無法保留；
- feature 需要被移除；
- 可見互動會有重大變化；
- 已調校的 camera／timing parameter 必須被替換；
- 存在多個實質不同的 UX alternatives；
- privacy/security constraint 與 MVP behavior 衝突；
- 為了保留體驗需要額外複雜度；
- 需要新的 default 或 product assumption；
- 必須選擇 transport-mode source；
- 現有 regression 被提議永久化。

Agents 不得自行在這些選項中替產品擁有者作決定。

## 8. Agent operating rules

1. MVP Behavioral Baseline 對使用者可見行為具權威性。
2. Repository implementation 可在內部改變，前提是 observable behavior 相容。
3. Technical convenience、code cleanliness、framework conventions 或 reduced complexity 都不授權改變產品行為。
4. 不得靜默替換已調校的值。
5. 任何影響行為的工作前，必須先對照本 baseline。
6. 每份影響 baseline behavior 的 implementation report 必須列出：

   ```text
   MVP baseline behavior
   → implemented behavior
   → MATCH / APPROVED DIFFERENCE / REGRESSION / UNVERIFIED
   ```

7. Codex 在進行任何影響 UX／product behavior 的 implementation task 前，必須閱讀本文件。
8. Antigravity 在 runtime／UX verification 前，必須閱讀本文件。
9. Antigravity 驗證的是與 baseline 的相容性，不負責判斷不同做法是否「更好」。
10. 產品決策屬於產品擁有者。

## 9. Known current regressions

以下是後續要修復的 implementation defects，不構成本 baseline 的永久偏離：

- 行動裝置展開故事不再正確暫停 dwell。
- 完整 multi-media story 被簡化。
- timeline／scrubber 的進度方向感被移除或簡化。
- dwell 中關閉故事不再如 MVP 般前往下一站。
- dwell 中點擊空白地圖不再如 MVP 般前往下一站。
- 真實 `japan-2026` playback 仍有 Visit-to-route movement mapping regression，造成不正確／跳躍的導航。

## 10. Revision history

| Date | Record |
| --- | --- |
| 2026-09-27 | Baseline adopted. Golden MVP reference: `archive/gps-timestamp-playback@aa0548a`. Baseline extracted by agent; product-owner adjudication completed. Decisions recorded: 1A / 2C / 3A / 4A / 5C. |
| 2026-09-27 | Provisional Visit dwell pacing completed with approved half-open boundaries and private trusted-duration derivation rule. It remains subject to real-MVP QA and distinct from movement pacing. |
| 2026-09-27 | Product owner accepted Option A: the public Visit contract exposes only curated `narrative_dwell_ms`; missing trusted duration uses the approved 4,000 ms fallback. |
| 2026-09-28 | Product owner approved stable Movement-level camera framing and decoupled All-scope visual Day highlight from playback/URL Day scope. Existing framing bands and Visit focus values remain unchanged. |
