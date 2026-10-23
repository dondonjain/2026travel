# Supabase v1 — RLS, Public Read Model, and Migration Implementation Design

核對日期：2026-09-25。狀態：REVIEWED ENGINEERING DESIGN；本文件為已通過審查與 fix verification 的工程與安全設計，作為 Supabase v1 migration 的實作規範。

## 1. 約束與安全立場

本設計實作層面遵守 [ADR-001](DECISIONS.md#adr-001accepted-domain-model-v1)、[ADR-002](DECISIONS.md#adr-002public-trajectory-privacy--boundaries)、[ADR-003](DECISIONS.md#adr-003public-read-and-rls-permission-contract)，以及 [Schema v1](SUPABASE_SCHEMA_V1_SPEC.md)。它不新增 Movement 或 ItineraryItem，也不改變 Visit 與 raw node 不一對一的邊界。

PostgreSQL 的 grant 決定角色能否存取物件，RLS 決定可存取哪些列；兩者都必須設定。Supabase 對已存在專案的 `public` schema 可能有預設 grant，且 `service_role` 會繞過 RLS，不能當作一般 Import Service credential。參考：[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)、[Supabase API security](https://supabase.com/docs/guides/api/securing-your-api)、[PostgreSQL Row Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)。

### 推薦 schema 邊界

| Schema | 是否列入 Supabase Data API exposed schemas | 內容 |
| --- | --- | --- |
| `app` | 否 | v1 全部 base tables、integrity trigger/function。 |
| `api_public` | 是 | 唯讀 Public Read Model views 與一個軌跡 RPC。 |
| `api_cms` | 是，但只 grant 給 `authenticated` | CMS 的受控 views／mutation RPC。 |
| `app_private` | 否 | 僅供 migration、受控函式與內部 helper 使用。 |

所有 `app` base tables 啟用 RLS。`anon` 不具 `app` schema usage 或 base-table grant；`app` 不列入 Data API exposed schemas。若 `api_cms` 採 security-invoker views，`authenticated` 會取得那些 views 所需的底層最小 grant，但一般 authenticated user 仍由無匹配 policy 的 RLS default-deny 拒絕，且無法經 Data API 直接選取未 exposed 的 `app` schema。此項結構可防止前端枚舉 base tables；RLS 是對 direct database access、role/grant 變動或未來 API exposure 的第二層防線。

## 2. Public Read Model

Public frontend 只能透過 Public Read Model；它不得被授予 `app` base tables 的 query surface。

### 2.1 Surface

| 介面 | 目的與可回傳欄位 | 不可回傳 |
| --- | --- | --- |
| `api_public.public_trips` view | `slug`、`title`、`starts_on`、`ends_on`、展示所需時區資訊；僅 published Trip。 | audit metadata、內部 UUID 以外的必要識別。 |
| `api_public.public_trip_visits` view | 以 Trip slug 篩選的公開 Visit：公開 visit id、標題、描述、發生／播放時間、展示分類、tags、highlight、已驗證 Place 的必要顯示名稱與座標，以及 curated `narrative_dwell_ms`。 | draft/archived Visit、未驗證或孤立 Place、raw node id／placeID、raw source 連結、raw trusted `started_at`／`ended_at`。 |
| `api_public.public_visit_media` view | 已公開 Trip + Visit + Media 的 visit id、媒體 type、URL、thumbnail、title、caption、display order、origin kind。 | draft/archived media、內部稽核欄位。 |
| `api_public.get_public_trajectory(trip_slug)` RPC | 僅在 Trip 與 Trajectory 都 published 時，回傳已去除 redaction 的 GeoJSON LineString segments、符合既有產品契約且不貼齊 hidden gap 邊界的安全衍生播放資訊，以及 `has_hidden_gap_after`。 | source/sample/redaction id、raw payload、redaction reason、private sample count、被遮蔽的 geometry、精確端點或 redaction boundary timestamp。 |

Place 不提供獨立 public view、RPC 或以 Place id 查詢的 endpoint。它只能作為 `public_trip_visits` 內、已發布 Visit 的巢狀顯示資料出現；`location_status <> verified` 時 Place 名稱與精準位置均不得由 Public Read Model 輸出。

`get_public_trajectory` 的資料契約以「公開 segment」而非 raw telemetry point 為單位。每個 segment 僅有不具來源意義的 `segment_index`、簡化後的 GeoJSON geometry、允許公開且不對應 hidden gap 邊界的衍生播放 metadata，及 `has_hidden_gap_after`。隱藏 connector 的最低資訊只有該 boolean／抽象 gap ordinal；不回傳 redaction id、樣本順序、座標、精確端點時間、private sample count、private path length 或 route geometry。UI 如顯示虛線，必須視為抽象 connector，不可宣稱或重建實際路線。

### 2.2 Publication chain enforcement

公開條件只在 Public Read Model 的 base query／RPC 中強制，不以 client-side filter 實作：

```text
Trip:       trip.publication_status = 'published'
Visit:      Trip published AND visit.publication_status = 'published'
Media:      Trip published AND Visit published AND media.publication_status = 'published'
Trajectory: Trip published AND trajectory.publication_status = 'published'
            AND active redactions have been subtracted
```

這使 published Visit 位於 redacted Trajectory、或 unpublished Visit 位於公開 Trajectory 都保持合法，且不會互相改變發布或 privacy 狀態。

### 2.3 Recommended safe execution mechanism

`security_invoker` view 會要求呼叫者也能存取底層 tables，與「Public frontend 不得 query base tables」衝突。預設 view 又可能以 owner 權限執行。因此推薦 migration 建立專用 `NOLOGIN NOBYPASSRLS` 的 `app_public_reader` owner：

1. 只授予它 Public Read Model 所需的 `app` schema／table column `SELECT`。
2. 令所有 `api_public` view 與 `get_public_trajectory` 由此 role 擁有；該 role 不是 table owner、不具 `BYPASSRLS`，且對 `app` 表仍受只允許公開鏈資料的 RLS policy 約束。
3. 只授予 `anon` 對 `api_public` 的 schema usage、指定 views 的 `SELECT` 及指定 RPC 的 `EXECUTE`；絕不授予 `app` schema usage 或 base-table privilege。
4. 如 RPC 在 migration 實作時需以 definer privilege 執行，必須由 `app_public_reader` 擁有、固定空 `search_path`、完全限定物件名、無動態 SQL、只回傳上述 whitelist 欄位，且僅 grant `EXECUTE` 給 `anon`／必要的 `authenticated`。

這是本輪推薦的 PostgreSQL engineering choice，不是將任何先前 reviewer 的具體實作偏好視為已接受架構。migration 前仍須以目標 PostgreSQL 版本與 Supabase exposure 設定驗證 owner、RLS 與 PostgREST 行為。[Supabase views security](https://supabase.com/docs/guides/database/views)

## 3. RLS 與 privilege model

### 3.1 角色矩陣

| Principal | Base-table grant / RLS | API surface | 明確禁止 |
| --- | --- | --- | --- |
| `anon` | `app` 所有 tables default-deny；無 schema usage、無 base-table grant。 | 僅 `api_public` 指定 views／trajectory RPC。 | 所有 raw、redaction metadata、CMS 寫入、base table query。 |
| 一般 `authenticated` | RLS default-deny；可能持有 security-invoker CMS views 所需的底層最小 grant，但沒有可匹配 policy。 | 無 `api_cms` 寫入／raw 讀取權。 | 以登入狀態取得 CMS 或 publication 權限。 |
| CMS Editor（`authenticated` JWT 的受控 `app_metadata` claim） | RLS 允許策展表與 redaction 的必要 CRUD；允許 source records／samples `SELECT`，拒絕其 INSERT/UPDATE/DELETE。 | `api_cms` 的 curated read/write 與 raw read-only surface。 | 覆寫 provenance、直接取得 importer 權限。 |
| `app_importer` custom PostgreSQL role | 受控 backend `LOGIN` role、`NOBYPASSRLS`；僅 technical table／column 的 scoped DML。可改為 `NOLOGIN` group role 加受控 worker credential，但不可使用 `service_role`。 | 不經 public/CMS API。 | 發布任何內容或 Trajectory、寫 Visit/Place/Media、寫 redaction、改 editorial 欄位。 |
| migration owner | migration 時的 owner/admin。 | 不作為 application credential。 | 作為 frontend、CMS 或 importer credential。 |

CMS Editor claim 應只取自不可由使用者自行寫入的 `app_metadata`／Custom Access Token Hook；不可使用 `user_metadata`。JWT 改動在 refresh 前可能仍有效，故撤權流程必須要求 token refresh／session revoke。這是 RBAC 實作的工程選擇，仍須在 migration design review 檢查其管理流程。[Supabase RBAC](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac)

### 3.2 Base-table policy and grant contract

| Table | CMS Editor | `app_importer` | `anon`／一般 authenticated |
| --- | --- | --- | --- |
| `trips`, `places`, `visits`, `visit_media` | curated CRUD，包括 publication control。 | 無讀寫。 | default-deny。 |
| `trajectories` | 讀取、建立／更新、publication control；可刪除僅在尚無 technical child 時。 | 僅對 draft row 讀取／寫入 `id`、`trip_id`、source time columns；INSERT 不得傳入 status，UPDATE 不得更新 `publication_status`。 | default-deny。 |
| `trajectory_redactions` | CRUD。 | 無讀寫。 | default-deny。 |
| `trajectory_source_records`, `trajectory_samples` | `SELECT` only。 | 僅當 parent Trajectory 為 draft 時的 scoped INSERT/UPDATE/DELETE/SELECT，限技術 re-import 所需列。 | default-deny。 |

Import safety 必須由三層同時保障：

1. column-level grants 不授予 `trajectories.publication_status` 寫入權；INSERT 省略 status 並使用 `draft` default。
2. `app_importer` 對 `trajectories` 的 RLS INSERT／UPDATE 只允許 `publication_status = 'draft'`，且 UPDATE policy 不允許 status 改變。`trajectory_source_records` 與 `trajectory_samples` 的每一個 importer SELECT／INSERT／UPDATE／DELETE policy 都必須以 parent `trajectories.publication_status = 'draft'` 為條件；不得只檢查 child row 自身。
3. `BEFORE` technical-write trigger 在 source record/sample 的 INSERT、UPDATE、DELETE 讀取並鎖定 parent Trajectory，確認其仍為 draft；UPDATE 若改變 `trajectory_id`，舊／新 parent 都必須為 draft。這補足 RLS predicate 在並發 CMS publish 與 importer technical write 間的 TOCTOU 風險。

source/sample policy 或 trigger 不可提升 publication status、修改 redaction，或在 re-import 後觸發自動發布。不得以 Supabase `service_role` 作為 importer，因其可 bypass RLS；使用受控 custom role 的直接後端連線或等效受控 write path。

### 3.3 Published → re-import → review → republish workflow

對已發布 Trajectory，re-import 必須按以下有狀態、非自動的流程：

```text
CMS Editor: published → draft
Public Read Model: 立即不再回傳此 Trajectory
Importer: 僅在 draft 狀態寫入 source records / samples / technical reprocessing
CMS Editor: 重新檢查 privacy 與 redaction
CMS Editor: 明確決定 draft → published，或維持 draft
```

Importer 不可執行任一 status transition，也不可在 technical write 後讓 status 自動變更。若 CMS Editor 與 Importer 並發，technical-write trigger 對 parent Trajectory 的鎖定必須使兩個操作序列化；任何 technical write 最終面對 published parent 時均被拒絕。

## 4. Redaction enforcement

| 規則 | 責任層 |
| --- | --- |
| start/end sample 同屬 redaction 的 `trajectory_id` | `BEFORE INSERT OR UPDATE` trigger：鎖定／讀取兩 sample 並驗證 trajectory。單一 FK 無法表示。 |
| `start.sequence_no <= end.sequence_no` | 同一 trigger；單一 `CHECK` 無法跨表讀取 sequence。 |
| CMS 選取 safety buffer | CMS controlled write path；將 buffer 直接含在 start/end sample 範圍。 |
| inactive redaction 無作用 | Public trajectory query 僅讀 `is_active = true`；不改 raw data。 |
| overlapping／adjacent ranges | trajectory RPC 的 query logic 將 active `[start_sequence_no, end_sequence_no]` 排序並做 interval union；相鄰（next start <= prior end + 1）合併。 |
| public geometry 無 redacted samples | RPC 以 union 後區間 anti-join sample，再把剩餘連續 sample group 聚合為 segments；任何不足以構成 LineString 的片段不回傳。 |
| 不洩漏被遮蔽端點 | RPC whitelist 不回傳 sample／redaction id、sequence、redaction reason、被移除點、exact redaction boundary timestamp／geometry、private sample count 或可推導 private path length 的 metadata；只給 `has_hidden_gap_after` 與不貼齊 gap 邊界的安全衍生播放資訊。 |

trigger 必須拒絕跨 Trajectory 範圍與倒置區間，不可「自動修正」範圍。觸發器與 public RPC 都應由 migration owner 審核、限定 search path，並於 verification 以 overlap、adjacency、inactive range 與跨軌跡案例測試。

## 5. Migration-ready integrity contract

### 5.1 Types, defaults, and checks

- 使用 `pgcrypto` 的 UUID 產生能力與 PostGIS；先在目標 Supabase project 驗證 extension availability。
- v1 status／kind 優先採 `text` + named `CHECK`，而不立即使用 PostgreSQL enum：值集合較易以 constraint migration 調整與 rollback。所有 Trip／Visit／Media／Trajectory publication status `NOT NULL DEFAULT 'draft'`。
- `trips`: unique non-empty `slug`；`starts_on <= ends_on`。
- `places`: `canonical_name` non-empty；`location_status = 'verified'` 當且僅當 `location IS NOT NULL`。unverified Place 不保存候選座標到 canonical `location`。
- `visits`: `trip_id`、`place_id` not null；`time_source` check；`display_order` 若存在則 non-negative。排序為 `occurred_at NULLS LAST, display_order NULLS LAST, id`，不需把 raw node 順序寫為 constraint。
- `visit_media`: unique (`visit_id`, `display_order`)；`display_order >= 0`。
- `trajectories`: unique `trip_id`；source range check；status default draft。
- `trajectory_samples`: unique (`trajectory_id`, `sequence_no`)；`sequence_no >= 0`；position not null；source record FK nullable。Importer 的 technical DML 另受 parent draft RLS + trigger guard，不是單一 table constraint 可表示。
- `trajectory_redactions`: start/end sample FKs not null、active default true；同 Trajectory／順序由 trigger。

### 5.2 Foreign keys, indexes, and deletion

- 所有 domain/technical child FK 預設 `ON DELETE RESTRICT`；不以 cascade 便利清理來源稽核或策展內容。
- 查詢索引：`trips(slug, publication_status)`、`visits(trip_id, occurred_at, display_order)`、`visits(place_id)`、`visit_media(visit_id, display_order)`、`trajectories(trip_id, publication_status)`、`trajectory_samples(trajectory_id, sequence_no)`、`trajectory_samples(trajectory_id, recorded_at)`、`trajectory_source_records(trajectory_id, source_key)`。
- PostGIS GIST：`places(location)`、`trajectory_samples(position)`。先建立一般 B-tree／constraint，再建立可能較昂貴的 spatial index。

Publication chain 是跨表 read authorization，不以 FK／CHECK 表達；由 Public Read Model 的 query predicate 和其測試強制。

## 6. Migration plan (do not execute in this phase)

| Phase | Work | Failure / rollback concern |
| --- | --- | --- |
| 0. Preconditions | 確認 PostgreSQL 版本、PostGIS／pgcrypto、Data API exposed schemas、default privileges；建立空白測試 project。 | 既有 default grant 可能使 table 意外 exposed；先盤點並 revoke。 |
| 1. Roles and schemas | 建立 `app`、`api_public`、`api_cms`、`app_private` 與 least-privilege owners／`app_importer`；只 expose API schemas。 | role ownership 錯誤會造成 RLS bypass；失敗時 drop 尚未使用的 schema／role。 |
| 2. Base schema | 建立 tables、PK、FK、NOT NULL、CHECK、publication defaults、基本 B-tree indexes。 | FK/constraint 若與 seed 不符，不匯入資料；回滾該 migration transaction。 |
| 3. Spatial and integrity | 建立 GIST indexes、redaction validation trigger、sample ordering，以及 Importer technical-write parent-draft trigger。 | spatial index 或 trigger 失敗不得以關閉保護繼續；修正後重跑 transaction。 |
| 4. RLS and grants | 每個 `app` table enable RLS、force RLS where applicable、revoke default grants、加入 CMS/import/public-reader scoped policies；Importer child technical DML policy 必須檢查 parent draft status。 | policy/grant 漏洞比 availability 更嚴重；測試未通過即 revoke API access and rollback。 |
| 5. Read models | 建立/owner `api_public` views、trajectory RPC、`api_cms` read/write surface；僅授必要 views/RPC grants。 | view owner／search path 錯誤可能洩漏資料；驗證後才授 anon usage/select/execute。 |
| 6. Verification | 使用 anon、ordinary authenticated、CMS Editor、importer 四種 session 執行 security test matrix；檢查 grants、RLS、function execute 和 API exposure。 | 任一 forbidden read/write 成功即回滾或 revoke API grants，不開始 data migration。 |

所有 migration 應可在單一 transactional DDL 範圍內時使用 transaction；extension、role、schema exposure 等平台操作若無法交易式 rollback，須在 runbook 明記補償步驟和前置備份／環境隔離。

## 7. Post-migration verification plan

下列測試要同時以 SQL role/session 與 Supabase Data API 實測，且驗證「permission denied」與「空結果」皆不會誤被當作成功公開：

1. anon 無法 query 任一 `app` base table、raw samples、source records 或 raw payload。
2. anon 無法經 Public Read Model 看到 draft Trip，或 published Visit 所屬 draft Trip。
3. anon 無法看到 published Media 所屬 draft／archived Visit，或其 Trip 未發布。
4. anon 無法以 id／slug 枚舉 orphan Place；public Visit 引用的 unverified Place 不輸出精準 location。
5. published Trip + draft/archived Trajectory 不回傳任何 trajectory segment。
6. published Trip + published Trajectory 只回傳已套用 active redaction 的 segments；inactive redaction 不影響結果。
7. 重疊與相鄰 redactions 產生 single union gap；public response 不含 sample id、sequence、redaction id/reason、raw endpoint 或可恢復被遮蔽 geometry 的替代 endpoint data。
8. Importer 可寫 technical data，但不能 insert published Trajectory、update Trajectory status、寫 redaction、寫 Visit／Place／Media 或修改 highlight/story。
9. Importer 對 published Trajectory 的 source record/sample INSERT、UPDATE、DELETE 一律失敗；對 draft Trajectory 成功且不改變 publication status。模擬 CMS publish 與 importer write 並發，確認 parent-draft trigger 不會讓 technical write 在 published 狀態提交。
10. CMS Editor 可讀 raw records/samples，但一般 CMS surface 無法 INSERT/UPDATE/DELETE 它們；可將 published Trajectory 明確降為 draft、完成 review 後再明確發布。
11. published Visit 位於 redacted Trajectory 時仍可依 Visit chain 出現；unpublished Visit 位於公開 Trajectory 時不出現，但不會令 Trajectory 消失。
12. trajectory RPC 的 snapshot／schema test 確認不輸出 exact redaction boundary timestamp、private sample count、private path length、sample/redaction identifier、internal ingestion/audit metadata，且沒有另一 public query 可還原這些資料。

## 8. Open engineering items and next gate

沒有新增未解產品決策。下列屬 migration 實作與環境驗證細節：目標 Supabase PostgreSQL 版本與 schema exposure 設定、custom role credential delivery、CMS claim 發行與撤權 runbook、view/function owner、migration toolchain、確切 SQL 與 test harness。

本設計已通過 targeted engineering/security review，且 Importer published-Trajectory write blocking issue 經 targeted fix verification 確認修復完成 (PASS)，並由 User 與 ChatGPT 完成 adjudication。
目前已授權推進至下一階段：`ENGINEERING_READY — MIGRATION IMPLEMENTATION`。Codex 可依據本設計、Schema Spec 與 Migration Invariants / Checklist 開始撰寫與執行 migration。
