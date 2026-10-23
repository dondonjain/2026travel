# Current Task

## POI resolution pipeline (2026-10-23)

Status: LOCAL_CODE_AND_DATABASE_VERIFICATION_PASS / HOSTED_AND_EDITOR_SESSION_INTEGRATION_PENDING

- User approved independent trajectory/fetch/ranking services, null Place for conflicts, then explicitly approved the minimal nullable-FK/status/CMS migration. See [POI_RESOLUTION](POI_RESOLUTION.md) for accepted behavior, defaults and reproduction.
- Strict >3-hour AND >250-m observation gaps produce two anchors; administrative/address results remain context only. Async resolver suggestions never auto-create/link Places. Both importer paths persist resolution status and null associations; SQL constraints/trigger enforce the boundary. Manual editor-only review retains pending Visit state until separate confirmation.
- New security-invoker CMS review view includes null-Place Visits through a left join; existing public/preview contracts remain unchanged. Correction to earlier investigation: cms_visits itself was already a direct base-table view; the preview query had the inner join.
- Isolated checkpoint snapshot: 66 application/module/render/source-contract checks pass; TypeScript, focused lint and network-enabled webpack build pass. Disposable PGlite/PostGIS runs all five migrations and the actual importer: 29 Visits, five spatial conflicts, zero conflicting non-null links. SQL runtime verifies editor/non-editor RLS, manual POI creation, null-Place confirmation denial and anonymous ACLs. This does not assert hosted Supabase/PostgREST PASS.
- No hosted migration, re-import, deployment or existing-data rewrite. Live providers/browser and historical hotel identity remain UNVERIFIED. Current CMS has no editor session supplier; new UI accepts a trusted cmsAccessToken, but the current page does not supply one and explicitly disables review saving. Authentication architecture was not expanded or bypassed. Reloaded rows preserve status, not temporary provider candidates; a source lookup for re-search is not included.
- Existing hosted CP4 test encountered DNS failure; sandbox build also encountered Google Fonts DNS, resolved only for build by network-enabled execution. No credentials were inspected or copied. New QA wrapper uses a disposable in-memory runtime and no environment files.
- MVP playback/chronology -> unchanged -> MATCH under regression; candidate suggestions/null conflict links -> APPROVED DIFFERENCE. Next external gates: authenticated session integration under existing editor policy, controlled hosted migration verification, then browser/manual POI acceptance. Do not claim full deployed workflow completion.

Updated: 2026-09-28

Status: READY_FOR_PRODUCT_OWNER_CAMERA_ACCEPTANCE

## Cruise Camera Stability + Day Navigation Decoupling (2026-09-28)

Status: MACHINE_VERIFICATION_PASS / READY_FOR_PRODUCT_OWNER_CAMERA_ACCEPTANCE

- Narrative Movement camera framing is now selected once from the complete safe route parts using the existing Golden latest-versus-fifth-coordinate thresholds, stored on the Movement, and kept stable for that Movement. Existing bands `11.5/35`, `9.5/30`, `7.5/25`, and plane `5/15` remain unchanged.
- Each Movement issues one existing 350 ms framing transition. While that transition is active, follow updates wait; afterward, rendered progress updates center only. Visit dwell disables Movement follow and retains `14.5/35/800 ms` focus. A post-redaction-gap resume reapplies the same latched Movement band.
- `selectedDay` remains the sole playback and URL scope. During an active All-scope Cruise, the controller derives its visual Day highlight from the active Visit; exiting/resetting returns the visual highlight to All. Visual synchronization cannot filter or rebuild the All timeline.
- Focused and affected regression tests pass `29/29`; TypeScript, targeted ESLint, webpack production build, tracked-source secret scan, and `git diff --check` pass.
- Headless-Chrome runtime verification passed on the 35-Visit local application: short/medium/long samples selected `11.5/35`, `9.5/30`, and `7.5/25`; each emitted one zoom target followed by center-only updates; Visit focus settled at `14.5/35`; pause/resume retained the visual Day; All scope remained 35 Visits with no Day URL parameter while highlight advanced to D7; explicit D7 changed to `?day=7` and 1 Visit; returning to All restored 35 Visits.
- Product Owner subjective camera comfort/aesthetic acceptance remains the only gate. No trajectory data, geometry generation, pacing, schema, privacy/public contract, deployment, or hosted fixture was changed.

## Goal

完成 Application Integration Vertical Slice 2 的 bounded playback regression repair：以 35 Visits 建立 34 個 runtime Movements、沿 ordered public `routeParts` 播放，並維持 privacy 與 accepted dwell contract。

## Background

目前 portal-web 由 GeoJSON node 與 places-metadata 合併成 EnrichedPlace，未分離永久場所與一次造訪。原始 Timeline 同時包含重訪、跨夜停留、巢狀候選地點及移動；metadata 也含第三方媒體。既有 Phase 8 文件提出拆分，但不代表此討論已結束或獲准實作。

## Accepted Domain Model v1

```text
Trip → Trajectory
Trip → Visit ← Place
Visit → Media
```

Accepted on 2026-09-25 by the user; NOT IMPLEMENTED。

Trip 是一次完整旅行；Trajectory 表示實際走過的空間路徑，raw GPS／Timeline 是來源；Visit 是值得整理、展示的一次到訪經驗，不與 raw Timeline node 一對一；Place 可重複引用且可被多次造訪；Media 與 Visit 關聯但不要求由當次 Visit 產生。ItineraryItem 與 Movement 暫不納入 v1；raw activity／movement 主要作為 Trajectory 來源。

## Open questions for current phase

- 領域模型至 Schema 與 Security Design 的映射問題已在前期審查中全部解決，無 unresolved product/architecture decisions。
- 已核准 Option A；尚待在 dedicated hosted test project 執行 migration、controlled importer 與公開 playback read-only verification。
- JSON production data migration、CMS 與 production deployment 均維持後續獨立 gate。

## Current Scope

- 為 `app.visits` 加入受限值集合的 `narrative_dwell_ms`，並只經 `api_public.public_trip_visits` 公開此 derived scalar。
- 由 controlled Okayama importer 僅在明確提供 Visit-local trusted start/end range 時導出 bucket；其他情況寫入已核准 `4,000 ms` fallback。
- Playback adapter／timeline 消費該 scalar；不變更 movement pacing。

## Non-scope / Do Not Implement Yet

- JSON production data migration / seed 資料匯入
- CMS 前端 UI 實作
- Importer application 的新增功能或 broader provenance model
- movement pacing、trajectory RPC、RLS/security architecture 的變更
- production deployment

本階段只實作已核准的最小 public dwell contract；不讀取 credential files、不重設或 reseed hosted QA fixture，也不宣告 browser／hosted runtime PASS。

## Application Integration Vertical Slice 1

Codex 已完成第一個 read-only application slice：

- `fetchSupabaseEnrichedPlaces(tripSlug)` 僅查詢三個 approved `api_public` views；先確認 published Trip，再分別取得 visits 與 media 並於 adapter 依 `visit_id` 組合。
- `EnrichedPlace` 暫時保留為 presentation DTO；public null coordinates 映射為 `null`，不建立 `[0,0]` fallback。
- `page.tsx` 維持 Client Component，以既有 URL/filter/map state 做最小 async loading/error integration。
- PlaceCardGrid 的排序、category/tag filtering 與 day grouping 維持；無公開座標的卡片正常顯示但不觸發 map navigation。
- TrajectoryMap 及 cruise/timing 仍使用 legacy static GeoJSON，沒有查詢 trajectory RPC 或推導 private timing data。
- 已加入 mapping、media join、highlight/time sorting、day grouping、missing media、nullable coordinate 與 separate public-view request regression tests。

本機 adapter unit tests（4/4）、TypeScript、focused lint 與 Next.js webpack production build 已通過。Repository-wide lint 仍被既有 legacy map/scripts 的 59 errors 阻擋，本輪未擴張修復；預設 Turbopack build 在目前 Windows execution environment 因 child-process access denied 失敗，改用 webpack build 驗證成功。尚未使用 hosted credentials 執行 application runtime verification，不得宣告 hosted PASS 或 production readiness。

## 已完成的分析與文件

- [PRODUCT](PRODUCT.md)：目前功能、已知方向及未知產品意圖。
- [ARCHITECTURE](ARCHITECTURE.md)：JSON、雙重 enrichment、UI 消費路徑及文件差異。
- [DOMAIN_MODEL](DOMAIN_MODEL.md)：目前概念、真實壓力案例與 accepted model v1。
- [DECISIONS](DECISIONS.md)：決策索引、ADR-001、ADR-002 (Public Trajectory Privacy)、ADR-003 (Public Read/RLS Permission Contract) 與 ADR-004 (Published Trajectory Technical-Write Guard)。
- [SUPABASE_SCHEMA_V1_SPEC](SUPABASE_SCHEMA_V1_SPEC.md)：Schema v1 mapping 已通過 targeted review 與 security-contract fix verification，狀態為 REVIEWED。
- [SUPABASE_SECURITY_V1_DESIGN](SUPABASE_SECURITY_V1_DESIGN.md)：RLS、Public Read Model、redaction enforcement 與 migration implementation design；已通過 targeted review，且 blocker 經 fix verification 通過 (PASS)，狀態為 REVIEWED。
- [MIGRATION_ACCEPTANCE_CHECKLIST](MIGRATION_ACCEPTANCE_CHECKLIST.md)：Migration 驗收查檢表，涵蓋結構、約束、Trigger、RLS 與 Rollback。
- [SECURITY_VERIFICATION_MATRIX](SECURITY_VERIFICATION_MATRIX.md)：Migration 後 24 項安全與權限測試案例矩陣。
- [MIGRATION_INVARIANTS](MIGRATION_INVARIANTS.md)：Migration 實作時必須維持的 6 大類系統不變數。

## Risks / Evidence to retain

- node-1/4 等重訪共用原始候選 placeID，卻各有 metadata；名稱與分類可能不同。
- node-28/29 起訖完全相同且 hierarchyLevel 不同，不能直接當作先後兩站。
- 松江 Universal Hotel 的兩連泊存在於獨立行程清單，尚無與 portal node 的正式對照。
- node-7 收錄「其他旅客」影片；不能假設所有 media 都是當次造訪產出。
- 原始 visit.endTime、placeID、hierarchyLevel 在 parsed 節點中未保留。
- [歷史紀錄，已解決] PHASE_8_DB_SCHEMA 與 Domain Model v1 的接受狀態曾有落差；Domain Model v1 現已 accepted。PHASE 8 仍僅是 schema／migration 提案，不可按文件語氣自動開始遷移；schema、欄位、權限與 migration 仍待決定。

## Investigation completion

Place / Visit stress-test investigation 已完成；其 evidence 與限制保留於 [DOMAIN_MODEL](DOMAIN_MODEL.md)。本文件不再把該 investigation 視為未完成的 hypothesis。

## Handoff / Stop condition

前期所有的產品決策、Schema Spec、Security Design 與 Blocker fix verification 皆已全數通過審查，並由 User 與 ChatGPT 完成 adjudication。
Codex 已建立 [Schema v1 migration](../supabase/migrations/20260925000000_schema_v1.sql)、[static database assertions](../supabase/tests/20260925000000_schema_v1_static.sql) 與 [migration runbook](../supabase/README.md)。

Migration runtime verification target: dedicated hosted Supabase test project (`travel-migration-test-20260925` / `kvykdkwhgepdbzobzkky`)。

在執行 hosted Supabase (`kvykdkwhgepdbzobzkky`) 隔離環境測試時，migration `20260925000000_schema_v1.sql` 已成功推送並完整 commit。
經 Antigravity 執行 Acceptance Checklist、Security Matrix、Redaction Privacy 與 lock-presence 運行時測試，核心邏輯與約束驗證結果如下：
- **通過驗證項目**：8 張 base tables、UUID PK、`ON DELETE RESTRICT`、Trigger `validate_redaction_range`（阻擋反向與跨軌跡區間）、Trigger `guard_technical_write`（取得 parent row lock 且阻擋已發布軌跡寫入）、CMS Editor 權限（唯讀 raw、可改 curated/redactions）、Importer 權限（只寫 draft、禁改 status/redactions）、Redaction Interval Union 演算法（active/inactive/overlapping/adjacent 區間合併正確且幾何輸出無洩漏敏感端點/時間資訊）。真正 two-session blocking 尚待 clean hosted re-verification。
- **Runtime 已確認、Codex 已完成 code fix，待 clean re-verification 的權限缺陷**：
  1. **View Grants 時序問題**：Migration 第 661–663 行在物件所有權已轉給 `app_public_reader` 且已撤銷 `CURRENT_USER` 的角色成員身分之後才執行 `GRANT SELECT ... TO anon, authenticated;`，導致 runner 因非 owner 且無 grant option 使得授權未生效，`anon` 訪問 `api_public.*` 時遭 PostgREST 401/42501 拒絕。
  2. **缺少 extensions schema USAGE**：`api_public.get_public_trajectory` 為 `SECURITY DEFINER` 且 owner 為 `app_public_reader`，內部調用 PostGIS 函數，但 `app_public_reader` 未被授予 `GRANT USAGE ON SCHEMA extensions TO app_public_reader;`，執行時觸發 `ERROR: 42501: permission denied for schema extensions`。

Codex 已完成兩項最小修復：
- `api_public` views／RPC 的最終 object ACL 現在由 migration runner 在 ownership transfer 前建立；其後才進入 PostgreSQL 17 bounded `SET`／schema `CREATE` window、轉移 owner，並精準撤回 temporary capabilities。`app_public_reader` 仍為最終 owner，且 migration 結束後不保留 `SET`／`INHERIT` 或 `CREATE ON api_public`。
- 永久授予 `app_public_reader` `USAGE ON SCHEMA extensions`，僅補足 public views／RPC 執行 PostGIS functions/types 所需的 schema lookup，未授予 `CREATE` 或其他 extension object write privilege。

Catalog assertions 已補強 owner、anon/authenticated view SELECT、RPC owner／SECURITY DEFINER／exact empty search path／EXECUTE ACL、PUBLIC EXECUTE absence、extensions USAGE、role attributes 與 temporary capability cleanup。另新增 top-level role-session regression，覆蓋 CMS valid redaction INSERT/UPDATE，以及 Importer source/sample INSERT/UPDATE/DELETE 與跨 parent sample move branch。既有 `20260925000006_concurrency_lock_check.sql` 僅證明單一 session 存在 lock，不構成兩 session blocking proof；真正兩 session 驗證步驟已記錄於 migration runbook，仍須由 Antigravity 在 isolated hosted environment 執行。

早期診斷期間曾手動變更 hosted test database；Round 3 已改由 clean reset 驗證並取代該批 evidence。Round 3 在 targeted role branch 中發現的新 blocker 與修復狀態記錄如下。

## Runtime Verification Findings (Round 3)

在 2026-09-25 執行 Clean Hosted Runtime Verification 時：
- **Step 1 (Clean Migration)**: PASS。
- **Step 2 (Catalog Assertions)**: PASS。
- **Step 3 (Targeted Role-Branch Regression)**: FAIL。

失敗原因：
`supabase/tests/20260925000007_role_branch_verification.sql` 以 `authenticated` 身分嘗試寫入 `trajectory_redactions` 時觸發 `app_private.validate_redaction_range()`。
該 function 執行 `SELECT ... FROM app.trajectory_samples FOR KEY SHARE`，但 `authenticated` 角色對 `trajectory_samples` 僅有 `SELECT` 權限。
在 PostgreSQL 中，`FOR KEY SHARE` 需要有 `UPDATE` 權限。由於該 trigger function 預設以呼叫者 (caller) 身分執行，導致 `42501: permission denied for table trajectory_samples` 錯誤。

Codex 已完成最小權限修復：
- 新增 internal `app_integrity_executor`：`NOLOGIN NOINHERIT NOBYPASSRLS`，不作為 application credential，也不授予任何 caller membership。
- `validate_redaction_range()` 改為 hardened `SECURITY DEFINER`，由 `app_integrity_executor` 擁有，維持 exact empty `search_path`、schema-qualified references 與 PUBLIC EXECUTE revoke。
- `guard_technical_write()` 也改用同一 restricted owner。這不是因外觀相似而擴張：其 source 明確執行 `SELECT publication_status ... FOR UPDATE` 及跨 parent move 時讀取 `trajectory_redactions`，而 `app_importer` 沒有這些 caller privileges，因此具有同一個可由 migration grants 證明的結構缺陷。
- executor 僅取得 validation/locking 所需欄位 SELECT，以及為 `FOR UPDATE`／`FOR KEY SHARE` 必要的 `UPDATE(id)` column grants；FORCE RLS 的 lock policies 使用 `USING (true) WITH CHECK (false)`，允許讀取／鎖定 existing rows但拒絕提交任何更新。
- `authenticated`、`app_importer` 與 `app_public_reader` 的 raw-table write grants均未擴張。ownership transfer使用 bounded PostgreSQL 17 SET/schema CREATE window，結束後精準撤回。

Catalog assertions 已加入 trigger function security mode／owner／search path／EXECUTE exposure、executor role attributes／exact column grants／RLS policies、trigger wiring、temporary capability cleanup，以及 authenticated仍無 raw UPDATE 的驗證。Local source checks已通過；尚未執行 hosted runtime。

Round 3 當時的 Workflow Gate 為 `MIGRATION_FIX_REQUIRED`，後續修補已於 Round 4 部分驗證。尚未宣告 runtime PASS或 production readiness；不得開始 JSON data migration、frontend refactor或 production deployment。

## Runtime Verification Findings (Round 4)

在 2026-09-25 再次執行 Clean Hosted Runtime Verification 時：
- **Step 1 (Clean Migration)**: PASS (PostgreSQL 17.6)。
- **Step 2 (Catalog Assertions)**: PASS。
- **Step 3 (Targeted Role-Branch Regression)**: **FAIL**。
  - **Context 1**: CMS Editor (`authenticated`) inserting `trajectory_redactions` 成功，證明 `app_integrity_executor` 的 `validate_redaction_range` 鎖定權限修復有效。
  - **Context 2**: Importer (`app_importer`) executing `INSERT INTO app.trajectory_source_records ...`
  - **Error 1**: `ERROR: 42501: permission denied for table trajectories`
  - **Root Cause 1（Codex independent analysis）**: FK enforcement 不是直接原因；PostgreSQL referential-integrity checks 會繞過 RLS。真正以 `app_importer` 權限執行的是 child INSERT policy 的 `WITH CHECK (EXISTS (... FROM app.trajectories ... publication_status = 'draft'))`。RLS policy expression 會以 query caller 權限執行，而 `app_importer` 原先只有 `id`、`trip_id` 與 source time columns 的 SELECT，沒有 `publication_status` SELECT，因此 parent-draft policy subquery 對 `app.trajectories` 觸發 `42501`。
  - **Context 3**: Importer (`app_importer`) executing `INSERT INTO app.trajectory_samples ...`
  - **Error 2**: `ERROR: 42501: permission denied for schema extensions`
  - **Root Cause 2**: `trajectory_samples.position` 是 `extensions.geography` 類型。`app_importer` 未被授予 `USAGE ON SCHEMA extensions`，因此無權使用 PostGIS 類型與函數（如 `extensions.ST_SetSRID`）。
- **Step 4 (Integrity Executor Privilege Boundary)**: **PASS**。
  - **Evidence**: 直接切換為 `app_integrity_executor` 並執行 `UPDATE app.trajectories SET id = id` 測試。
  - **Result**: `ERROR: 42501: new row violates row-level security policy for table "trajectories"`。
  - **Conclusion**: `WITH CHECK (false)` 成功阻擋了 raw-data commit，同時允許 `FOR SHARE/KEY SHARE` row locking。Security Definer 設計安全有效。
- **Step 5 - 8**: BLOCKED。

Codex 已完成最小權限修復：
1. 在既有 column-level trajectory SELECT 清單加入 `publication_status`；未改為 table-level SELECT。`importer_select_draft_trajectories` 仍只讓 Importer 看見 draft rows，因此新增欄位只會呈現固定的 `draft` 值，且 `publication_status` UPDATE 仍未授予。
2. 授予 `app_importer` `USAGE ON SCHEMA extensions`，讓 schema-qualified PostGIS functions/types 可被解析；未授予 `CREATE` 或任何 extension write privilege。
3. 未修改 FK、Importer parent-draft RLS predicates、FORCE RLS、publication semantics 或 `app_integrity_executor`。Targeted role regression 的 Importer sample INSERT 改為直接呼叫 schema-qualified PostGIS constructors，以覆蓋實際失敗路徑。

Catalog/source assertions 已補上 Importer exact trajectory SELECT columns、`publication_status` 無 UPDATE、technical-table DML、extensions `USAGE` 且無 `CREATE`、禁止 table-level trajectory SELECT，以及原有 authenticated raw-write isolation／integrity-executor restrictions。Local source verification 已通過；新 migration 尚未在 hosted environment 執行。

當前 Workflow Gate 為 `MIGRATION_RUNTIME_VERIFICATION_PASS`。Steps 1–8 已全數通過 hosted runtime verification。

## Runtime Verification Findings (Round 5)

在 2026-09-25 從 Clean DB Reset 執行 Runtime Verification：
- **Step 1 (Clean Migration)**: **PASS** (PostgreSQL 17.6)。
- **Step 2 (Catalog Assertions)**: **PASS**。確認 `app_importer` 獲得 `publication_status` 欄位與 `extensions` USAGE，且無擴張至 table-level SELECT 或 CREATE。
- **Step 3 (Targeted Role-Branch Regression)**: **PASS**。CMS Editor 與 Importer 的各項新增寫入均順利執行，包含 PostGIS type 解析與 FK RLS validation，且無違反預期。
- **Step 4 (Integrity Executor Privilege Boundary)**: **PASS**。`app_integrity_executor` 的 `WITH CHECK (false)` 成功防堵任何非授權的 raw write。
- **Step 5 (Full Security Matrix)**: **PASS**。全矩陣零異常。
- **Step 6 (Redaction / Privacy RPC)**: **PASS**。隱私切分、gap 旗標與幾何簡化完全符合規格。
- **Step 7 (True Two-Session Concurrency)**: **PASS**。透過雙背景程序與 `pg_sleep(10)` 實測，證明 `SECURITY DEFINER` 的 lock 成功阻擋並讓第二個 session 進入 queue 等待，完美實現併發防護。
- **Step 8 (PostgREST / API Verification)**: **PASS**。修正 `TEST_API_URL` 後，透過真實 HTTP PostgREST 端點完整測試 5 大分支共 20 項細部驗證（Schema 隔離、Anon 讀取模型與發布語意、軌跡隱私與 RPC 遮蔽、Authenticated 非 CMS 存取限制、Authenticated CMS Editor 權限邊界），全部 20/20 PASS。

Steps 1–8 已全數通過 hosted 執行期驗證。依專案規範，不自行宣告 production readiness，推薦將 Gate 推進至 `MIGRATION_RUNTIME_VERIFICATION_PASS` 供 Orchestrator 進行後續裁決。

## Runtime Verification Findings (Round 6)

在 2026-09-26 建立 temporary deterministic fixture 執行 Completion Verification：
- **Step 3 (Public API Precheck)**: PASS。公開 Trip、Visits 及 Media 均透過 pi_public 正確顯示。
- **Step 4-9 (Adapter Mapping & App Runtime)**: PASS。實際 etchSupabaseEnrichedPlaces 成功執行，確認 null 座標無洩漏、Media composition 隔離正確、Highlight / timestamp 排序邏輯與 DTO filtering 欄位完全相容。Application async 載入成功且正常。
- **Step 11 (Fixture Cleanup)**: PASS。所有 Temporary rows 與 scratch files 均成功清理。

目前狀態為 APPLICATION_INTEGRATION_RUNTIME_VERIFICATION_PASS，完成所有分支的驗證。

## Application Integration Vertical Slice 2 — Privacy-Safe Narrative Playback

Updated: 2026-09-26

Status: APPLICATION_INTEGRATION_VERTICAL_SLICE_2_RUNTIME_VERIFICATION

### Goal

以既有 MVP Cruise Controller 的互動模型，將地圖播放由 legacy raw GPS timestamp path 改為 approved `api_public` read models 與 `get_public_trajectory(trip_slug)` RPC 的安全 segment path。這是 application-only integration；不改 Schema、RLS、migration、CMS 或 Importer。

### Implemented locally

- 舊有 exact-GPS playback 已在 branch `archive/gps-timestamp-playback`、commit `aa0548a` 保存，再由 implementation branch 進行替換。
- 新增 `supabase-trajectory` public adapter，只以 `Content-Profile: api_public` POST RPC 取得 segment index、LineString geometry 與 `has_hidden_gap_after`。
- 新增 application-level Narrative Playback Timeline：Visit 排序與 day grouping 來自已公開 Visit data；公開 segment 依 segment index 排序；距離只從已公開 geometry 計算。
- movement pacing 集中於 `narrative-playback.ts`。目前 public contract 不提供 transport mode；repo 中可用 mode 僅是 raw Timeline source，不能帶入 public playback，因此採 explicit `unknown` fallback（camera-only、不顯示 car/plane avatar），不猜測私有資訊。
- 保留 Cruise Controller 的啟動、pause/resume、previous/next stop、約 5 秒 dwell、day selection、card-to-map 和 manual map selection 行為。無對應公開 segment 的 Visit 僅移動到已公開 Visit location，不建構 route。
- progressive route 僅輸出已回傳的 individual public LineString features。遇到 `has_hidden_gap_after` 時，完成當前安全線段後 avatar 消失、鏡頭轉至下一段安全起點、再繼續；不建立 connector、直線或 hidden geometry。

### Local verification

- Node focused tests: 11/11 PASS（public segment ordering、duration policy、unknown fallback、5-second dwell constant、day-derived Visit ordering、gap transition source wiring、avatar suppression、no fabricated `[0,0]`、manual/card-map wiring、no raw GPS timing import、public-RPC-only access）。
- TypeScript: PASS.
- Focused ESLint: PASS.
- Next.js webpack production build: PASS.
- Repository-wide ESLint: FAIL，現存 12 errors / 4 warnings，位於既有 `enrich.js`、`scripts/*`、`src/lib/places.ts` 與 `OptimizedImage.tsx`；本 slice 未擴張修復。

### Remaining verification

- **[2026-09-26 更新]** 已修復 `.env.local` 誤用 Management API Key (sbp_ 開頭) 導致 `get_public_trajectory` 回傳 401 Unauthorized 的問題，改用正確的 Anon JWT Key (`sb_publishable_...`)。
- 開發伺服器與資料庫已重新同步測試資料，`fetchSupabaseEnrichedPlaces` 與 RPC 皆能正常取得資料。
- 由於開發者已暫停工作流程，**瀏覽器端的 UI 互動手動測試 (Browser Manual QA)** 尚未完成。
- 下一次啟動時，應從手動驗證 Cruise Controller、Privacy Gap 跳躍與天數切換開始。若無誤，即可宣告 `APPLICATION_INTEGRATION_VERTICAL_SLICE_2_RUNTIME_VERIFICATION_PASS`。

## Application Integration Vertical Slice 2 — Playback Regression Repair

Updated: 2026-09-27

Status: READY_FOR_CONTROLLED_ENRICHED_HOSTED_REIMPORT

### Approved Visit narrative dwell contract (implementation pending hosted verification)

- Product owner has accepted Option A: `app.visits.narrative_dwell_ms` is the sole curated public Visit pacing value. It is not a raw Visit duration.
- `api_public.public_trip_visits` exposes only this derived scalar; it does not expose trusted `started_at`／`ended_at`, source records, or raw GPS timing.
- The approved mapping is recorded in `MVP_BEHAVIORAL_BASELINE.md`; missing, invalid, partial, or reversed trusted Visit-local duration uses the approved `4,000 ms` fallback. No adjacent Visit time or GPS inference is permitted.
- A follow-up migration and controlled Okayama importer update implement this contract. Local source/type/lint tests pass; dedicated hosted migration/importer/runtime verification remains required before this slice may advance.

### Confirmed root cause

第一版 Narrative Timeline 把 public trajectory segment 當成 Visit-to-Visit movement。Okayama QA fixture 有 35 個 Visits、1 條含 286 coordinate 的 continuous public LineString，因而錯誤產生 1 個約 4,549 km 的 movement，並立即碰到 12 秒 cap；Cruise stop progression 與 camera framing 因此跳動。

### Golden-reference values retained

來源：`archive/gps-timestamp-playback` / `aa0548a`。

| 行為 | Golden MVP | 修復後 |
| --- | --- | --- |
| Visit dwell | 5,000 ms、100 ms progress | 已核准的 provisional `narrative_dwell_ms` mapping；維持 100 ms progress |
| Movement pacing | 舊 raw-timestamp player 以約 60 秒播放全 route | Product Owner 已拒絕固定全旅程 60 秒；每個 Visit pair 使用既有 bounded distance policy（unknown: 4.5–12 秒） |
| 夜間 acceleration | 23:00–06:59、40× | 未移植；不得由 public Visit timestamp 捏造 raw movement timing |
| stop focus | `easeTo`, zoom 14.5, pitch 35, 800 ms | 相同 |
| card → map | `flyTo`, zoom 14.5, pitch 35, 1,200 ms | 相同 |
| route follow | 350 ms ease-out；11.5/35、9.5/30、7.5/25、5/15 thresholds | 相同 public-geometry thresholds |
| completed route | `fitBounds`, padding 100, 3,000 ms, pitch 0 | 本 bounded repair 未聲稱已重新驗證 |
| previous / next | direct focused dwell stop | 相同 |

### Repair implementation

- Timeline 現在依 chronological public Visit 建立 `N - 1` movement intervals。每個 verified Visit coordinate 投影到 ordered public LineString；相鄰 Visit projections 切出對應的 safe range。
- public segment 的數量不再限制 movement 數量；一條 continuous LineString 可承載多個 Visit pair。
- 若 interval 跨 `has_hidden_gap_after`，range 保留多個獨立 route part；gap transition 中 marker 不顯示，之後才從下一段安全 geometry 繼續。
- 無 transport mode 時仍是 `unknown`，只顯示中性 position marker，不推測 car／plane。沒有 public route edge 時 movement 保持無 geometry，不補畫 path。

### Verification status

- Local focused tests (22/22)、TypeScript 與 focused ESLint 已通過。
- 測試以既有 TypeScript dev dependency 的小型 CJS register 執行，避免將 Node runtime version 差異誤判為 production failure。
- 新增 `verify-public-playback.cjs` 僅接受 caller-injected public Supabase configuration，輸出 aggregate-only fixture count，不讀取 credential files。
- 已以既有 public app configuration 執行 aggregate-only hosted read：35 visits、34 runtime movements、1 public segment、286 public coordinates、0 unmapped visits、無 synthetic route part。這不是 enriched re-import 或 browser QA PASS。

### Bounded trajectory/camera repair (2026-09-27)

- Provenance diagnosis confirms that the controlled importer used `parsed-trajectory.json` for technical samples, while the Golden MVP rendered the existing `enriched-trajectory.json` path. The parsed line has 382 samples including three >100 km endpoint jumps; the Golden path has 24,852 existing derived samples and no >100 km jump. Visit ordering and public range slicing remain 35 Visits / 34 movements.
- The importer now keeps curated Visits from the parsed fixture but writes technical samples only from the already checked-in Golden path, with internal `time_basis = 'interpolated'`. It performs no routing request and creates no geometry.
- Production playback 現已實作 Visit-to-Visit range slicing：全域 monotonic projection 將 chronological Visits 配對到 ordered public route edges，35 Visits 產生 34 Movements；每個 movement 保存一或多個 real `routeParts`。
- Progressive path 與中性 marker 皆沿目前 `routePart` 插值。privacy gap 前的 safe part 保持顯示，marker 隱藏，900 ms camera transition 後從下一個 safe part 恢復；不連接 hidden geometry。
- Follow camera 保持 Golden 的 reactive/per-frame target update；每次 `easeTo` duration 350 ms、ease-out，沒有 350 ms throttle。Golden scale bands 11.5/35、9.5/30、7.5/25、5/15 已按 archive 的 latest-vs-fifth-coordinate thresholds 恢復。
- Visit arrival 仍先進入 dwell 並停止 movement，再執行 14.5 / 35 / 800 ms focus；follow effect 在 dwell 時停用。Card-to-map 維持 14.5 / 35 / 1,200 ms `flyTo`。
- User-visible time formatting already uses minute precision; regression coverage now asserts no seconds are shown.
- Accepted `narrative_dwell_ms` mapping 未變更；production dwell timer 現消費目前 Visit 的 public derived scalar，缺值維持 4,000 ms fallback。
- Local focused tests (22/22), TypeScript, focused ESLint, Next.js webpack production build, `git diff --check`, and aggregate-only public hosted verification pass. Hosted controlled enriched re-import plus browser Cruise QA remain separate gates; this task does not claim either PASS.

## Controlled enriched hosted re-import (2026-09-27)

Status: DATA_AND_RUNTIME_VERIFICATION_PASS / CREDENTIAL_ROTATION_REQUIRED

- Target was validated as the dedicated hosted QA project before mutation. No production project was touched and no schema migration was needed.
- The controlled importer replaced only `japan-2026` and inserted the checked-in Golden `enriched-trajectory.json`: 24,852 technical samples, sequence 0–24,851, all marked `interpolated`.
- Hosted counts: 1 Trip, 35 Places, 35 Visits, 40 Media, 1 Trajectory, 1 source record, 24,852 samples.
- Hosted dwell distribution: 1,500×11; 2,000×5; 2,800×2; 4,000×4; 5,000×2; 6,500×2; 8,000×9; fallback 0; total 143,100 ms.
- Actual public RPC: 1 segment, 11,171 coordinates, `has_hidden_gap_after=false`; the fixture currently has no active redaction/privacy gap.
- Largest public adjacent step is 82.040 km. It maps to five consecutive Golden source steps totaling 82.062 km (path/chord ratio 1.0003; endpoint match error at most 64.01 m), so it is expected flight-path simplification rather than an unexplained teleport; no public step exceeds the prior 100 km extreme threshold.
- Hosted production aggregate: 35 Visit units, 34 Movements, 34 real routeParts, 0 unmapped Visits, monotonic projections, 0 endpoint-only synthetic Movements, first progressive geometry available immediately, marker midpoint available.
- Public API exposes `narrative_dwell_ms` but no Visit `started_at`, `ended_at`, or real duration; anonymous REST access to raw samples/source records returns schema rejection. Privacy-gap separation and no-connector behavior remain covered by focused regression tests because this fixture currently has no active gap.
- No secrets were written to source files, Git diff, or fixtures. One early failed connection diagnostic printed the dedicated QA database connection URL in command output. Do not record the value; rotate the dedicated QA database password before advancing to Product Owner Cruise QA.
- Browser Cruise smoke/qualitative QA was not performed and remains Product Owner-owned.

## Repository secret boundary (2026-09-27)

Status: IMPLEMENTED / LOCAL_NEGATIVE_TESTS_PASS / UNTRACKED_CREDENTIAL_ARTIFACT_BLOCKS_GATE

- Normal QA now uses bounded `qa:*` package commands. Configuration is loaded internally by variable name; credentials are not accepted as positional CLI arguments.
- Public playback uses only Tier 0 public configuration. QA database smoke and aggregate fixture verification use the separately named `QA_DATABASE_READ_URL` inside read-only transactions. Controlled `japan-2026` import uses the separately named `QA_DATABASE_WRITE_URL`.
- Shared diagnostics redact loaded values, PostgreSQL URLs, Supabase PAT/secret-key forms, JWT-looking auth tokens, and explicit password fields. Missing configuration reports variable names only.
- `AGENTS.md` now forbids direct secret-file inspection, environment dumps, literal credentials in commands/scripts, ordinary Tier-3 use, and unapproved credential operations.
- The schema has no dedicated LOGIN verifier role; `app_public_reader` is `NOLOGIN`. The Tier-1 wrapper is transaction-read-only, but a truly least-privilege login requires a separate migration/security decision.
- Repository/interface enforcement does not provide OS-level isolation. A same-user process with unrestricted filesystem access can technically bypass wrappers; stronger isolation requires a separate account, CI/credential broker, external secret manager, or equivalent sandbox.
- Local negative boundary tests pass 6/6; tracked-source credential scan, 22/22 existing application/playback tests, TypeScript, and focused ESLint pass. No hosted operation, credential rotation, schema change, fixture change, or product-visible behavior change was performed.
- The sanitized scan also identified an unrelated untracked root file, `rotate.js`, containing a PAT-shaped literal. Its value was not inspected or printed, and the user-owned untracked file was not modified. It should be removed or sanitized through an explicitly authorized bounded action before credential rotation is considered complete.
