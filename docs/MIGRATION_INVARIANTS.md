# Migration Invariants

核對日期：2026-09-25。本文件列出 Codex 在進行 Supabase v1 Migration 實作時，絕對不可違反的系統不變數 (Invariants)。

## 1. Domain Invariants (領域模型不變數)
- **Visit ≠ Timeline Node**：Visit 代表策展的造訪經驗，不能直接將 raw Timeline node 1:1 映射為 Visit。
- **Technical Tables Separation**：`trajectory_source_records` 與 `trajectory_samples` 永遠是 technical / support tables，絕不可升格為 Domain entities，也不可暴露給前端作為內容。

## 2. Data Integrity Invariants (資料完整性不變數)
- **Redaction Trajectory Consistency**：`trajectory_redactions` 的 `start_sample_id` 與 `end_sample_id` 必須嚴格屬於同一個 `trajectory_id`。
- **Redaction Sequence Order**：`start_sample` 的 `sequence_no` 必須小於或等於 `end_sample` 的 `sequence_no`。
- **Strict Foreign Keys**：Domain 與 Technical child 的外鍵關聯預設為 `ON DELETE RESTRICT`，不得為了方便清理而使用 `CASCADE`。

## 3. Publication Invariants (發布控制不變數)
- **Independent Trajectory Privacy**：Trip 的發布狀態變更，絕不能自動改變 Trajectory 的發布狀態。
- **Publication Authority Isolation**：改變任何實體的 `publication_status` 是 CMS Editor (Publication Authority) 的專屬權利，Importer 永遠不具備此權限。
- **Visit/Trajectory Decoupling**：Visit 的發布與否與 Trajectory 的 privacy redaction 是完全獨立的兩個維度，改變一方不能隱含改變另一方。

## 4. Security Invariants (安全存取不變數)
- **Base Table Concealment**：`anon` 角色永遠不能獲得直接存取 `app` base tables 的權限。
- **CMS Raw Data Read-Only**：CMS Editor 只能讀取 raw source / samples，絕不可有權限直接 `UPDATE` 或 `DELETE` 原始 GPS 來源。
- **Importer Draft-Only Writes**：Importer 只能對狀態為 `draft` 的 Trajectory 進行技術資料寫入。已 published 的 Trajectory 對 Importer 是完全防寫的。

## 5. Privacy Invariants (隱私保護不變數)
- **No Raw Geometry Leakage**：Redacted 的 raw geometry 絕不會被 Public Read Model 直接暴露，連被遮蔽的點的座標都不可回傳。
- **Abstract Gap Metadata Protection**：Public trajectory RPC 的「未公開間隔」(Abstract gap) 絕不回傳 `exact redaction boundary timestamps`、`exact endpoints`、`private sample count`，或任何可推導出 `private path length` 的技術 metadata。

## 6. Migration Safety Invariants (遷移安全不變數)
- **Zero-Exposure Window**：Migration 執行中途，不得產生讓 `anon` 可以讀取 base tables 或未保護資料的短暫窗口。
- **Safe Rollback**：任何 DDL 失敗、Trigger 建立失敗或安全測試失敗時，Migration 必須完全 rollback 或 revoke api_public grant，不得留下危險的授權或失效的 RLS。
