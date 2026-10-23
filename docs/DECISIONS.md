# Decision Register

核對日期：2026-09-25。本文件區分實作事實、既有決策敘述與可追溯的正式接受。

## 狀態與證據

- OBSERVED：可由程式／資料確認的事實；不等於人類決策。
- PROPOSED / UNDER DISCUSSION：供討論的方案，不能據此實作。
- ACCEPTED：有明確的人類接受者、接受日期及可追溯依據。
- REJECTED / SUPERSEDED：已有明確否決或替代依據，保留歷史。

本次新增 Accepted ADR。接受依據為 2026-09-25 使用者明確接受的 Accepted Domain Model v1；已實作亦不自動等於 Accepted。

## 既有決策文件索引

| 來源 | 文件中的內容 | 本次處理 |
| --- | --- | --- |
| [根 ARCHITECTURE](../ARCHITECTURE.md) 第 1–9 節 | 媒體呈現、動畫、JSON 分工、面板與視角、載具、Cruise、手機抽屜、Day、URL／圖片處理 | 保留原文及設計背景；實作核對見 docs/ARCHITECTURE，不重建推測性的 Accepted ADR。 |
| [ROADMAP](../ROADMAP.md) Phase 8 | CMS 與動態資料庫方向，列出多種技術候選 | 視為已存在的規劃文件，不當作上線或遷移完成證據。 |
| [PHASE_8_DB_SCHEMA](../PHASE_8_DB_SCHEMA.md) | Supabase 與 trips／places／visits／visit_media、資料聚合、JOIN 提案 | Domain Model v1 已 accepted；本文件仍是未接受的 schema／migration 提案，不代表 schema、欄位、權限或 migration 已決定或可直接執行。 |

## ADR-001：Accepted Domain Model v1

- Status：ACCEPTED
- 決策日期：2026-09-25
- 接受者：使用者
- 接受依據：本次使用者明確接受的六項 Domain Model v1 decisions
- 實作狀態：NOT IMPLEMENTED

### 決定

- Trip 是一次完整旅行。
- Trajectory 表示旅行實際走過的空間路徑；原始 GPS／Timeline 是來源，不等於網站內容。
- Visit 是值得整理、展示的一次到訪經驗，不與 raw Timeline node 一對一。
- Place 是可重複引用的實體／地理場所；同一 Place 可被同趟或不同 Trip 多次造訪。
- Media 與 Visit 關聯，用於聚合值得觀看的內容，但不要求由該 Visit 當下產生。
- ItineraryItem 與 Movement 暫不納入 Domain Model v1；raw activity／movement 目前主要是 Trajectory 的來源。

### Rationale

這些邊界回應了 repository 中的重訪、跨日停留、純交通 activity、沒有明確 Place 的移動內容、短暫 GPS node，以及重疊／巢狀 raw visit。它們避免把 raw Timeline node 直接當成網站 Visit，也避免把第三方或預設媒體誤當成當次造訪產出。

### 影響與待辦

本決定尚未指定 Supabase 的 tables、欄位、FK、約束或匯入規則。下一階段是將 accepted domain model 映射至 Supabase schema。

## ADR-002：Public Trajectory Privacy & Boundaries

- Status：ACCEPTED
- 決策日期：2026-09-25
- 接受者：使用者
- 接受依據：2026-09-25 產品規則邊界審查 (Boundary Review) 後由 User 拍板。
- 實作狀態：NOT IMPLEMENTED

### 決定

1. v1 採 explicit manual Trajectory segment redaction。
2. Visit publication 與 Trajectory privacy 是獨立維度。
3. unpublished / absent Visit 不會自動隱藏附近 Trajectory。
4. 若某位置或行程需要保密，CMS 編輯者必須明確將一段 Trajectory 標記為 private/redacted。
5. Raw Trajectory 保持完整，不因公開隱私設定被破壞性修改。
6. Public Trajectory rendering 必須移除 redacted segment 的精確 geometry。
7. 公開 UI 可以使用抽象 connector / 虛線表示「此段未公開」，但不得虛構實際路線。
8. Redaction 必須允許涵蓋敏感位置前後的 safety buffer，避免從公開端點反推出敏感位置。
9. v1 不要求：automatic home detection、privacy radius、Movement entity。
10. Trajectory 的時間化 geometry / timeline representation 屬 engineering design concern，不是新增 Movement 的理由。

## ADR-003：Public Read and RLS Permission Contract

- Status：ACCEPTED
- 決策日期：2026-09-25
- 接受者：使用者
- 接受依據：Public Read + RLS Permission Contract review 後，使用者於本任務明確確認。
- 實作狀態：NOT IMPLEMENTED

### 決定

- Public frontend 不得直接 query base tables，只能透過明確設計的 Public Read Model。
- Public Trip／Visit／Media 分別要求其完整 publication chain 為 `published`；Place 沒有獨立 publication lifecycle，只能因已發布 Visit 且已驗證 location 被公開 read model 引用，不能被獨立枚舉。
- Public Trajectory 必須同時滿足 Trip 已發布、Trajectory 明確已發布、所有 active redactions 已套用。Trip 已發布不會自動公開 Trajectory。
- Public visitor 永遠不得取得 raw source／sample、raw payload、sample 或 redaction identifiers、redaction reason、內部 audit metadata、draft／archived 資料或被移除的精確 geometry。
- CMS Editor 可讀策展內容與 raw Timeline/GPS；一般 CMS 對 raw source records／samples 為唯讀，raw corrections 走 controlled re-import/reprocessing。
- Import Service 只可寫入 technical/source/provenance data；不得發布內容或 Trajectory、建立 Visit、修改策展內容／highlight、決定 redaction，或因 re-import 改變 Trajectory privacy。

### 影響與待辦

本 ADR 定義安全與發布契約，不指定 view ownership、RLS SQL、role credential、RPC 或 trigger 的實作方式；這些工程設計見後續 Supabase security design，仍未建立 migration。

## ADR-004：Published Trajectory Technical-Write Guard

- Status：ACCEPTED
- 決策日期：2026-09-25
- 接受者：使用者
- 接受依據：targeted engineering/security review 的 blocking issue 修正契約，由使用者於本任務明確接受。
- 實作狀態：NOT IMPLEMENTED

### 決定

- Import Service 只可對 `publication_status = draft` 的 Trajectory 寫入 technical trajectory data，包括 source records、samples 與 re-import/reprocessing 產生的 technical writes。
- 已 published 的 Trajectory 不得由 Import Service 修改 technical data；Import Service 不得將 published 改為 draft、將 draft 改為 published、修改 redaction 或取得 publication authority。
- 已 published Trajectory 需要 re-import 時，CMS Editor 必須先明確改為 draft，使 Public Trajectory 立即停止公開；匯入完成後由 Editor 重做 privacy/redaction review，再決定是否明確發布。
- re-import 不得自動改變 Trajectory publication status。

### 影響與待辦

此契約需在 Importer 的 column privilege、parent-status RLS 條件與 technical-write integrity guard 同時落實，並以 published parent 的 source/sample DML 拒絕測試驗證。它不新增 Domain Model entity 或 schema table。

## DISCUSSION-001：Place／Visit／ItineraryItem 責任邊界

- Status：SUPERSEDED by ADR-001。
- 記錄日期：2026-09-25；不是接受日期。
- 背景：目前 EnrichedPlace 將節點內容、場所位置與造訪時間合併；資料含重訪、跨夜、巢狀紀錄、移動與第三方媒體。
- 目標：確認 Place、Visit、ItineraryItem 的責任與 Media 歸屬。
- 原討論假設：Trip → Visit ← Place；Visit → Media。
- 原先未決定事項已由 ADR-001 的 domain boundary 處理；schema 與匯入細節仍未決定。
- 人類接受者／接受日期：原討論未記錄；其結論由 ADR-001 取代。
- 依據：[DOMAIN_MODEL](DOMAIN_MODEL.md)、[CURRENT_TASK](CURRENT_TASK.md)、[既有提案](../PHASE_8_DB_SCHEMA.md)。
- 實作狀態：未實作；本次只建立文件。
- 風險：把匯入節點當成策展 Visit、把編輯文字當成已確認場所、把預設媒體當實拍內容。

## ADR Template

新增決策時複製以下格式；template 本身不是決策。只有取得明確接受證據才能將 Status 改為 ACCEPTED，並分開記錄是否已實作。

```markdown
## ADR-NNN：<決策標題>

- Status：PROPOSED
- 提案日期：YYYY-MM-DD
- 提案者：<人類或 agent；未知則填 Unknown>
- 決策擁有者：<人類；尚未確認則填 Unknown>
- 接受者／接受日期：未接受
- 接受依據：<可追溯 issue、PR、確認紀錄或文件；未有則填無>
- 實作狀態：NOT IMPLEMENTED

### 背景與問題

<目前事實、來源連結與待解問題；區分事實與假設>

### 目標、Scope 與 Non-scope

<本決策涵蓋與不涵蓋的範圍>

### 選項與取捨

<考慮過的選項、證據及未知事項>

### 提議／決定

<未接受時寫提議；接受後記錄明確決定>

### 影響、風險與待決問題

<對資料、UI、維護與使用者的影響>

### 驗證與後續

<如何驗證、實作依據，以及取代／被取代的 ADR>
```
