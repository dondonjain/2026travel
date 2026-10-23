# Security Verification Matrix

核對日期：2026-09-25。本矩陣用於 Supabase v1 Migration 後的自動化／手動權限驗證。任何一項失敗皆代表 migration 失敗。

## Anon 匿名存取邊界

| Test ID | Actor | Precondition | Attempted Action | Expected Result | Security Property |
|---------|-------|--------------|------------------|-----------------|-------------------|
| A01 | anon | API / GraphQL | 嘗試直接 `SELECT` `app.trips` 等 base tables | `Permission denied` 或完全無法發現 endpoint | anon 無法直接讀 base tables |
| A02 | anon | API / GraphQL | 嘗試查詢 `app.trajectory_samples` | `Permission denied` | anon 無法讀 raw samples |
| A03 | anon | API / GraphQL | 嘗試查詢 `app.trajectory_source_records` | `Permission denied` | anon 無法讀 raw payload |
| A04 | anon | 存在 draft Trip | 查詢 `api_public.public_trips` | 結果不含該 Trip | draft Trip 不可見 |
| A05 | anon | 存在 published Visit 但所屬 Trip 為 draft | 查詢 `api_public.public_trip_visits` | 結果為空 | published Visit + draft Trip 不可見 |
| A06 | anon | 存在 published Media 但所屬 Visit 為 draft | 查詢 `api_public.public_visit_media` | 結果為空 | published Media + draft Visit 不可見 |
| A07 | anon | 存在尚未被任何 public Visit 引用的 Place | 嘗試透過 API 枚舉 Place | 無端點 / 無法枚舉 | orphan Place 不可枚舉 |
| A08 | anon | 存在 `location_status='unverified'` 的 Place 被 public Visit 引用 | 查詢該 Visit 的 public view | Place 名稱或座標至少有一為隱藏/空值，或不暴露精確 location | unverified Place 不公開精準 location |
| A09 | anon | published Trip + private Trajectory | 呼叫 `get_public_trajectory` | 回傳空結果 / 無軌跡片段 | published Trip + draft Trajectory 不公開軌跡 |
| A10 | anon | published Trajectory + 有 active redaction | 呼叫 `get_public_trajectory` | 輸出已被挖空該區間的 GeoJSON | published Trajectory 套用 active redaction |
| A11 | anon | published Trajectory + 僅有 inactive redaction | 呼叫 `get_public_trajectory` | 輸出完整軌跡 GeoJSON | inactive redaction 不影響公開結果 |
| A12 | anon | published Trajectory + overlapping / adjacent redactions | 呼叫 `get_public_trajectory` | 相交範圍合併，無重複或遺漏切割 | overlapping redactions 不洩漏 samples |
| A13 | anon | published Trajectory + 有 active redaction | 檢查 RPC 回傳的 gap 與 segments metadata | 不包含精確 endpoint 時間、座標、sample count 或推導 path length | public gap 保護隱私與端點 metadata |

## CMS Editor 邊界

| Test ID | Actor | Precondition | Attempted Action | Expected Result | Security Property |
|---------|-------|--------------|------------------|-----------------|-------------------|
| C01 | Editor | 存在匯入的 raw records/samples | 執行 `SELECT` 取得 payload | 成功讀取 | CMS Editor 可以讀 raw source / samples |
| C02 | Editor | 存在匯入的 raw records/samples | 嘗試 `UPDATE` / `DELETE` 這些列 | `Permission denied` | CMS Editor 不可直接修改 raw source / samples |
| C03 | Editor | 存在 Trajectory 與策展實體 | 編輯策展文字或新增 redaction | `UPDATE` / `INSERT` 成功 | CMS Editor 可以修改 curated content / redactions |
| C04 | Editor | 存在 published Trajectory | 修改為 `draft` | 成功修改 | Editor 具備 publication authority |

## Importer 邊界

| Test ID | Actor | Precondition | Attempted Action | Expected Result | Security Property |
|---------|-------|--------------|------------------|-----------------|-------------------|
| I01 | Importer | 存在 `draft` Trajectory | 寫入 `trajectory_samples` | 成功寫入 | Importer 可以修改 draft Trajectory technical data |
| I02 | Importer | 存在 `published` Trajectory | 嘗試寫入 `trajectory_samples` | `Permission denied` (觸發 RLS 或 Trigger) | Importer 不可修改 published Trajectory technical data |
| I03 | Importer | 存在任意 Trajectory | 嘗試 `UPDATE` `publication_status` | `Permission denied` | Importer 不可修改 publication_status |
| I04 | Importer | 存在任意 Trajectory | 嘗試修改 `trajectory_redactions` | `Permission denied` | Importer 不可修改 trajectory_redactions |
| I05 | Importer | Editor 降級 published 到 draft，Importer 再匯入 | 查詢 `trajectories` 的狀態 | 維持 `draft` | re-import 不自動 publish Trajectory |
| I06 | Importer/Editor | Editor 嘗試發布，Importer 同時寫入 technical data | 並發執行兩操作 | 其中一方失敗或被序列化防堵 | concurrent publish/import 不繞過 draft-only guard |

## 複合產品邊界 (Domain/Publication Independence)

| Test ID | Actor | Precondition | Attempted Action | Expected Result | Security Property |
|---------|-------|--------------|------------------|-----------------|-------------------|
| P01 | anon | published Visit 落於 redacted trajectory 區間 | 查詢 `public_trip_visits` | Visit 正常顯示，不受軌跡隱藏影響 | published Visit 可以位於 redacted trajectory segment |
| P02 | anon | unpublished Visit 落於 public trajectory 區間 | 查詢 `public_trip_visits` 及 RPC | Visit 不顯示，軌跡正常顯示 | unpublished Visit 可以位於 public trajectory segment |
