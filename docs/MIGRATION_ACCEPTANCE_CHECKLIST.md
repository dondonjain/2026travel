# Migration Acceptance Checklist

核對日期：2026-09-25。本清單用於驗收 Supabase v1 Migration 是否完全符合 Schema Spec 與 Security Design。

## 1. 基礎設施與權限 (Infrastructure & Roles)
- [ ] Schema `app` 存在且未暴露於 API。
- [ ] Schema `api_public` 與 `api_cms` 存在且已暴露於 API。
- [ ] PostgreSQL Role `app_importer` 存在，且設定為 `NOBYPASSRLS`。
- [ ] PostgreSQL Role `app_public_reader` (或等效 reader role) 存在，設為 `NOBYPASSRLS`，且擁有 `api_public` 視圖。
- [ ] `anon` 角色無 `app` schema usage，且無法 query base tables。

## 2. 結構與約束 (Schema & Constraints)
- [ ] 所有 Domain Model v1 的 base tables (`trips`, `places`, `visits`, `visit_media`, `trajectories`, `trajectory_source_records`, `trajectory_samples`, `trajectory_redactions`) 已建立於 `app` schema。
- [ ] 主鍵 (PK) 皆為 `uuid`。
- [ ] 外鍵 (FK) 約束皆為 `ON DELETE RESTRICT`，防止意外 cascade 刪除。
- [ ] `trips.slug`、`trajectories.trip_id`、`trajectory_samples(trajectory_id, sequence_no)`、`visit_media(visit_id, display_order)` 具備 UNIQUE 約束。
- [ ] 所有發布狀態 (`publication_status`) 預設值為 `'draft'` 且具備 NOT NULL 約束。
- [ ] PostGIS extension 已啟用，`places.location` 與 `trajectory_samples.position` 型別為 `geography(Point,4326)`。
- [ ] 必要的 B-tree 與 GIST 索引已建立。

## 3. 業務邏輯完整性 (Business Integrity)
- [ ] `places.location_status` 具備 check constraint，且 unverified Place 的精準 location 保障機制已實作。
- [ ] `visits` 依賴 `occurred_at` 與 `display_order` 的 deterministic ordering 已配置。
- [ ] 觸發器 (Trigger) 確保 `trajectory_redactions` 的 `start_sample_id` 與 `end_sample_id` 屬於同一個 `trajectory_id`。
- [ ] 觸發器 (Trigger) 確保 redaction `start.sequence_no <= end.sequence_no`。
- [ ] 觸發器 (Trigger) 防堵 Race condition：確保 Importer 對 technical data 執行 DML 時，parent `trajectory.publication_status` 必須為 `'draft'`，重匯入 (re-import) 具備 safety。

## 4. RLS 與公開讀取模型 (RLS & Public Read Model)
- [ ] `api_public.public_trips` 正確強制 publication chain (`published` Trip)。
- [ ] `api_public.public_trip_visits` 正確強制 publication chain (Trip + Visit 皆 `published`)。
- [ ] `api_public.public_visit_media` 正確強制 publication chain (Trip + Visit + Media 皆 `published`)。
- [ ] `api_public.get_public_trajectory` 成功實作 active redaction filtering 與 overlapping redactions 的 interval union。
- [ ] Public Read Model 不回傳 `start_sample_id`, `end_sample_id`, `source_record_id`, `raw_payload`, internal audit metadata。
- [ ] Abstract gap privacy 保護：不暴露 exact redaction boundary timestamps、exact endpoints、private sample count 及可推導 private path length 的 metadata。
- [ ] CMS Editor 具有寫入策展內容權限，但對 raw provenance (`source_records`, `samples`) 強制為唯讀。

## 5. 部署與失敗復原 (Deployment & Rollback)
- [ ] Migration 在單一交易 (transaction) 內執行，若遇非交易操作有明確標記 rollback 補償步驟。
- [ ] migration 失敗或安全驗證 (security verification) 不通過時，不會留下任何殘留的危險 grant，保證 fallback 至安全狀態。
