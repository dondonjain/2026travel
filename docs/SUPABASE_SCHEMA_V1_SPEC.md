# Supabase Schema v1 Specification

核對日期：2026-09-25。狀態：REVIEWED；本文件是已通過審查的 schema mapping 規格，作為 Supabase v1 migration 的依據。

## 1. 目的、依據與邊界

本規格將 accepted Domain Model v1 映射為可供 Supabase/PostgreSQL 實作的關聯模型，並保留 raw Timeline/GPS 的來源可追溯性。

依據：

- [ADR-001](DECISIONS.md#adr-001accepted-domain-model-v1)：Trip、Trajectory、Place、Visit、Media；Visit 不與 raw Timeline node 一對一；ItineraryItem、Movement 不在 v1。
- [ADR-002](DECISIONS.md#adr-002public-trajectory-privacy--boundaries)：公開 Trajectory 採人工標記的 segment redaction；Visit 發布與 Trajectory 隱私分離；raw Trajectory 不可因公開遮蔽而破壞性修改。
- [Current Architecture](ARCHITECTURE.md)：目前 parsed nodes 未保留 raw `visit.endTime`、候選 `placeID`、`hierarchyLevel`；enriched trajectory 有 24,852 個時間點，故需同時區分來源、採樣點與公開讀取模型。

本規格不涵蓋：migration、seed/JSON 匯入、前端 refactor、CMS UX、RLS/角色權限的最終政策、Movement 或 ItineraryItem。舊有 [Phase 8 提案](../PHASE_8_DB_SCHEMA.md) 僅供比較，未直接採用。

## 2. 設計原則

1. `Visit` 是策展實體，不由 raw node 自動生成，也不以 `node-N` 作為身分。
2. raw 軌跡與公開軌跡分離：raw 資料可完整保存；公開讀取必須同時確認 Trip 與 Trajectory 的發布狀態並套用 redaction，不能直接讀 raw geometry。
3. `Place` 可被多個 `Visit` 重複引用；目前 node 級的 category、tag、highlight、故事文字屬 Visit 的策展內容，不推定為 Place 的永久屬性。
4. 所有時間事實以 `timestamptz` 保存、以絕對時間排序；需要顯示當地鐘面時間時，另保存適用的 IANA 時區。不得以執行環境時區推導。
5. raw event、GPS sample 與 redaction 都是 Trajectory 的技術／來源資料，不是新的公開內容或 Movement domain entity。

## 3. 關係總覽

```text
trips 1 ── 1 trajectories
trips 1 ── * visits * ── 1 places
visits 1 ── * visit_media
trajectories 1 ── * trajectory_source_records
trajectories 1 ── * trajectory_samples
trajectories 1 ── * trajectory_redactions
```

`trajectory_source_records` 不與 `visits` 建立必填或一對一關聯。日後若需要人工追溯，可另加 optional many-to-many provenance link；v1 不把來源紀錄誤作 Visit。

## 4. 資料表規格

### `trips`

| 欄位 | 型別／限制 | 語意 |
| --- | --- | --- |
| `id` | `uuid` PK | Trip 身分。 |
| `slug` | `text` unique, not null | 穩定公開 URL 識別。 |
| `title` | `text` not null | 旅程標題。 |
| `starts_on`, `ends_on` | `date`, not null；`starts_on <= ends_on` | 策展的旅行日期範圍，不從目前有 node 的日期自動推導。 |
| `default_time_zone` | `text` nullable | IANA 時區的預設值；跨時區 Visit 可覆寫。 |
| `publication_status` | enum/text check: `draft`, `published`, `archived`; not null default `draft` | Trip 公開狀態。 |
| `created_at`, `updated_at` | `timestamptz` | 稽核欄位。 |

### `places`

| 欄位 | 型別／限制 | 語意 |
| --- | --- | --- |
| `id` | `uuid` PK | 可跨 Trip 重用的 Place 身分。 |
| `canonical_name` | `text` not null | 已確認的場所名稱。 |
| `location` | PostGIS `geography(Point,4326)` nullable | 已確認的 Place 座標；未知時為 null，不以 raw 候選座標補值。 |
| `location_status` | enum/text check: `unverified`, `verified` | 避免將來源候選座標誤當固定 Place 事實。 |
| `created_at`, `updated_at` | `timestamptz` | 稽核欄位。 |

`places` 不設必填 category、tag、highlight 或 raw `placeID`。公開精準 Marker 的前提應為 `location_status = verified`，並由公開 read model 另套用相關發布／隱私規則。

### `visits`

| 欄位 | 型別／限制 | 語意 |
| --- | --- | --- |
| `id` | `uuid` PK | 策展 Visit 身分。 |
| `trip_id` | `uuid` FK → `trips.id`, not null | 所屬 Trip。 |
| `place_id` | `uuid` FK → `places.id`, not null | 所指向 Place。 |
| `title` | `text` nullable | 當次故事標題；null 時 UI 可採 Place 名稱。 |
| `description` | `text` nullable | 當次經驗，不是 Place 的永久介紹。 |
| `occurred_at` | `timestamptz` nullable | 策展排序／展示錨點；不是未經確認的 raw 到達或離開時間。 |
| `time_zone` | `text` nullable | 此 Visit 的 IANA 時區；優先於 Trip 預設值。 |
| `time_source` | enum/text check: `editorial`, `trajectory_derived`, `unknown` | 時間來源；`trajectory_derived` 不宣稱 raw node 等於 Visit。 |
| `narrative_dwell_ms` | integer not null, default `4000`, check 允許值集合 | 僅供公開播放的 curated/derived narrative dwell；不是 raw Visit duration，亦不保存或公開 raw started/ended timestamp。 |
| `presentation_category` | `text` nullable | Visit 層的展示分類。 |
| `tags` | `text[]` not null default empty array | Visit 層策展標籤。 |
| `is_highlight` | `boolean` not null default false | 此次 Visit 的展示旗標。 |
| `publication_status` | enum/text check: `draft`, `published`, `archived`; not null default `draft` | Visit 發布維度；獨立於 Trajectory redaction。 |
| `display_order` | `integer` nullable | 同一 `occurred_at` 或無時間 Visit 的人工穩定排序。 |
| `created_at`, `updated_at` | `timestamptz` | 稽核欄位。 |

排序規則：先以 `occurred_at` 的絕對時間排序；同值或 null 再以 `display_order`、`id` 穩定排序。v1 不以 raw hierarchy、node 順序或相同座標自動決定 Visit 先後。

### `visit_media`

| 欄位 | 型別／限制 | 語意 |
| --- | --- | --- |
| `id` | `uuid` PK | Media 身分。 |
| `visit_id` | `uuid` FK → `visits.id`, not null | 所屬 Visit。 |
| `media_type` | enum/text check: `image`, `youtube`, `external_video` | 呈現類型。 |
| `url` | `text` not null | 原始媒體 URL 或平台識別；確切格式在實作前驗證。 |
| `thumbnail_url` | `text` nullable | 選用縮圖。 |
| `title`, `caption` | `text` nullable | 媒體展示文案。 |
| `origin_kind` | enum/text check: `visit_captured`, `third_party`, `default`, `unknown` | 禁止推定所有 Media 都由當次 Visit 產生。 |
| `display_order` | `integer` not null default 0 | 同一 Visit 內順序；unique (`visit_id`, `display_order`)。 |
| `publication_status` | enum/text check: `draft`, `published`, `archived`; not null default `draft` | 媒體發布控制。 |
| `created_at`, `updated_at` | `timestamptz` | 稽核欄位。 |

### `trajectories`

| 欄位 | 型別／限制 | 語意 |
| --- | --- | --- |
| `id` | `uuid` PK | Trajectory 身分。 |
| `trip_id` | `uuid` FK → `trips.id`, unique, not null | v1 每個 Trip 一條實際旅行軌跡。 |
| `publication_status` | enum/text check: `draft`, `published`, `archived`; not null default `draft` | Trajectory 的獨立發布控制。Trip 已發布不會使 Trajectory 自動發布。 |
| `source_started_at`, `source_ended_at` | `timestamptz` nullable；開始不得晚於結束 | 已匯入來源涵蓋範圍，非策展 Visit 時間。 |
| `created_at`, `updated_at` | `timestamptz` | 稽核欄位。 |

採用 `publication_status`，而非 boolean flag，因為它與 `trips`、`visits`、`visit_media` 的既有發布生命週期一致，並可用 `draft` 作為安全預設。只有具發布權限的獨立動作才能將 Trajectory 改為 `published`；匯入不具有此權限。

### `trajectory_source_records`

保存原始 Timeline／GPS 的可追溯資料，而非公開內容。

| 欄位 | 型別／限制 | 語意 |
| --- | --- | --- |
| `id` | `uuid` PK | 來源紀錄身分。 |
| `trajectory_id` | `uuid` FK → `trajectories.id`, not null | 所屬軌跡。 |
| `source_kind` | enum/text check: `timeline_visit`, `timeline_activity`, `timeline_path`, `gps`, `other` | 原始來源類型。 |
| `source_key` | `text` not null | 外部／檔案來源內的穩定鍵；unique (`trajectory_id`, `source_key`)。 |
| `started_at`, `ended_at` | `timestamptz` nullable | 原始事件時間；可保留 visit endTime。 |
| `raw_payload` | `jsonb` not null | 原始資料快照，可保留候選 placeID、hierarchyLevel、probability 等。 |
| `ingested_at` | `timestamptz` not null | 匯入稽核時間。 |

### `trajectory_samples`

保存可重建完整 raw geometry 的有序採樣點；24,852 個既有 enriched 點屬可承受的初始量級，但不得假定插值點等同實測 GPS。

| 欄位 | 型別／限制 | 語意 |
| --- | --- | --- |
| `id` | `uuid` PK | Sample 身分。 |
| `trajectory_id` | `uuid` FK → `trajectories.id`, not null | 所屬軌跡。 |
| `sequence_no` | `integer` not null；unique (`trajectory_id`, `sequence_no`) | 軌跡重建順序。 |
| `position` | PostGIS `geography(Point,4326)` not null | 原始／衍生路徑點。 |
| `recorded_at` | `timestamptz` nullable | 該點的絕對時間。 |
| `time_basis` | enum/text check: `observed`, `interpolated`, `unknown` | 不把插值時間誤稱實測。 |
| `source_record_id` | `uuid` FK → `trajectory_source_records.id`, nullable | 可選來源追溯。 |
| `created_at` | `timestamptz` | 稽核欄位。 |

### `trajectory_redactions`

這是 ADR-002 的人工 redaction 設定，不修改 raw samples；公開讀取模型必須排除被涵蓋的 sample 範圍。

| 欄位 | 型別／限制 | 語意 |
| --- | --- | --- |
| `id` | `uuid` PK | Redaction 身分。 |
| `trajectory_id` | `uuid` FK → `trajectories.id`, not null | 所屬 Trajectory。 |
| `start_sample_id`, `end_sample_id` | `uuid` FK → `trajectory_samples.id`, not null | 要隱去的完整區間；編輯者必須把 safety buffer 納入此範圍。 |
| `reason` | `text` nullable | 僅供內部說明，絕不進公開 read model。 |
| `is_active` | `boolean` not null default true | 可逆的發布控制。 |
| `created_at`, `updated_at` | `timestamptz` | 稽核欄位。 |

實作約束：兩個 sample 必須屬於同一 `trajectory_id`，且 `start_sample.sequence_no <= end_sample.sequence_no`。這類跨列約束需在未來 migration 以 trigger 或受控寫入程序實現；不得只依前端保證。

## 5. 公開讀取模型與隱私規則

Public frontend 只能透過 Public Read Model；v1 不直接開放 `trajectory_source_records` 或 `trajectory_samples` 給匿名讀者。公開 Trajectory 的最低必要條件是：

```text
Trip.publication_status = published
AND Trajectory.publication_status = published
AND 所有 active trajectory_redactions 已套用
```

公開 API/view 的最低規格：

1. 僅讀取 `publication_status = published` 的 Trip、Visit 與 Media；公開 Trajectory 必須另外滿足上述三項條件。Trip 已發布本身不足以公開其 Trajectory。
2. Place Marker 只使用 `location_status = verified` 的座標；未驗證資料不公開為精準地點。
3. 以 sample `sequence_no` 切出 redaction 以外的連續 segments；redacted geometry 不回傳。需要提示時只可回傳抽象「未公開區段」資訊，不能回傳替代路線。
4. Visit 的 `publication_status` 不改變 Trajectory redaction；反之亦然。
5. Public Visit read model 可回傳 `narrative_dwell_ms`，但不得回傳用來導出的 raw `started_at`／`ended_at`、source record 或 raw GPS timestamp。
6. 來源 payload、redaction reason 與內部稽核欄位只能供受控後台存取。CMS Editor 可讀 raw Timeline/GPS，但一般 CMS 對 `trajectory_source_records` 與 `trajectory_samples` 為唯讀；raw corrections 走 controlled re-import/reprocessing。
7. RLS、後端角色與 Public Read Model 的實際 SQL／執行方式在 migration 設計階段另定；本規格不採納任何特定 `SECURITY DEFINER` 或 backend role 實作。

## 5.1 Import 與發布權限分離

Import Service 可建立／更新 `trajectories`、`trajectory_source_records` 與 `trajectory_samples`，以保存 raw Timeline/GPS 或完成受控 reprocessing；它不得自行發布任何 Trip、Visit、Media 或 Trajectory，亦不得決定 Trajectory privacy。

- 新建立或新匯入的 Trajectory 必須以 `publication_status = draft` 保存。
- 匯入 source records 或 samples 不得變更既有 Trajectory 的 `publication_status`，也不得新增、停用或縮減 redaction。
- 將 Trajectory 由 `draft`／`archived` 改為 `published` 是獨立的 publication authority 動作，必須在 privacy review 完成後才可進行。
- Visit publication 與 Trajectory privacy 保持完全解耦；改變其中一方不得隱含改變另一方。

## 6. 索引與完整性需求

- `trips.slug` unique。
- `visits (trip_id, occurred_at, display_order)`：Trip 內時間線與清單查詢。
- `visits (place_id)`：同一 Place 的重訪查詢。
- `visit_media (visit_id, display_order)` unique。
- `trajectories (trip_id, publication_status)`：Public Read Model 篩選已發布 Trajectory。
- `trajectory_samples (trajectory_id, sequence_no)` unique，並作為 public segment 切分與重建的主要索引。
- `trajectory_samples (trajectory_id, recorded_at)`：時間播放查詢；`recorded_at` nullable 的列不應破壞排序。
- `trajectory_source_records (trajectory_id, source_key)` unique。
- PostGIS GIST 索引：`places.location`、`trajectory_samples.position`，僅在 migration 確認 PostGIS extension 後建立。
- FK delete policy 建議採 restrict；刪除 Trip／Trajectory／Place 前需明確處理策展內容與來源稽核，不使用 cascade 當作便利清理。

## 7. 仍待決定，不能由本規格自動落實

- RLS 角色、編輯／發布流程與匿名讀取 view 的確切 SQL；包含 publication authority 的具體技術實作。
- raw source 的保存期限、JSON schema 驗證與重新匯入策略。
- `Place` 去重與 canonical name 的人工審核流程。
- 一個 Trip 是否在未來需要多條 Trajectory。
- Visit 的公開時間字串、取整粒度及敏感區段附近時間的遮蔽 UX；資料層僅保留正確的絕對時間與時區基礎。
- PostGIS geometry/geography 的具體 DDL、enum 或 check constraint 寫法、trigger 與 migration 順序。

## 8. 審查與下一步

本規格已通過 targeted schema review 與 security-contract fix verification，並由 User 與 ChatGPT 完成 adjudication，確認狀態為 REVIEWED。本規格與 `SUPABASE_SECURITY_V1_DESIGN.md` 作為 Codex 執行 Supabase v1 migration implementation 的正式依據。
