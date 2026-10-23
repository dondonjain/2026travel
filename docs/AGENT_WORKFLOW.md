# 專案多 Agent 協作與工程營運模型 (Agent Operating Model)

本文件定義 Travel Portal 專案中多個 AI Agent (ChatGPT, Codex, Antigravity) 的工程協作流程。目的在於建立清楚的職責劃分、任務分流、狀態卡控與審查機制，避免越權、重工或低效的成本消耗。

## 1. 角色定義與職責邊界

### ChatGPT (Product & Architecture Orchestrator)
* **職責**：產品與架構決策、任務拆解 (Task Decomposition)、Agent 路由分配 (Agent Routing)、成果整合與最終裁決 (Final Adjudication)。
* **限制**：不直接進行高風險或大量的源碼撰寫，專注於系統藍圖與方向確立。

### Codex (Principal Engineer & Core Systems)
* **職責**：負責高 Context、高風險、跨模組的工程任務。
* **範圍包含**：資料庫 Schema 設計、Migration 腳本撰寫、系統整合 (Integration)、大型重構 (Refactor)、安全性敏感 (Security-sensitive) 的實作。

### Antigravity (Implementation Specialist & Reviewer)
* **職責**：具備清楚邊界的低風險實作 (Bounded Implementation)、針對性驗證 (Targeted Verification)、獨立審查 (Independent Review)、局部 Repo 稽核。
* **限制**：專注於可獨立驗證的小型任務，不負責架構設計。

## 2. 任務分流規則 (Task Routing Rules)

* **Antigravity 優先**：只要任務能安全切分為具備明確邊界 (Bounded) 且有清楚驗收條件的工作，優先交由 Antigravity 處理。
* **Codex 處理複雜任務**：需要廣泛 Repository Context、深度架構推理 (Architecture Reasoning) 或具有高破壞半徑 (High Blast Radius) 的工作，必須交由 Codex 處理。
* **非工程 Agent 決策**：尚未定稿的產品決策必須留在 ChatGPT 與 User 之間討論，嚴禁交由工程 Agent (Codex/Antigravity) 自行決定。

## 3. 工作流程閘口 (Workflow Gates)

為確保工程品質與決策透明度，所有重大任務需通過狀態閘口。Workflow Gates 必須明確支援兩種 Review：
- **Pre-engineering product/architecture review**
- **Post-implementation code/integration review**

**硬規則 (Hard Rule)**：If a review stage has been explicitly planned, ChatGPT must not silently perform or skip that review itself.

### 產品決策流程 (Product Decision Flow)
1. `PRODUCT_DRAFT`：產品需求或初步架構草案建立。
2. `USER_DECISION_REQUIRED`：遇到需要 User 拍板的未知或重大決策（如需要）。
3. `REVIEW_READY`：產品或架構設計已準備好進行審查。
4. `REVIEWED`：產品或架構設計審查通過。
5. `ENGINEERING_READY`：決策已確認，邊界與驗收條件已定義，可開始實作。

### 工程開發流程 (Engineering Flow)
1. `ENGINEERING_READY`：準備開始工程實作。
2. `IMPLEMENTED`：工程 Agent 完成實作，等待審查。
3. `REVIEW_READY`：實作程式碼已準備好進入審查階段。
4. `REVIEWED`：程式碼與整合審查通過。
5. `FINAL_REVIEW`：由 ChatGPT 或 User 進行最終成果確認。

## 4. 升級與中斷規則 (Escalation Rules)

* **Antigravity 越界中斷**：當 Antigravity 在實作過程中發現範圍 (Scope) 超出原定邊界，必須 **STOP** 並回報 Scope Expansion，嚴禁自行擴張實作範圍。
* **Codex 決策中斷**：當 Codex 在工程過程中發現尚未解決的產品或架構決策 (Unresolved Product Decision)，必須 **STOP** 並回報給 ChatGPT 處理。

## 5. 程式碼審查規則 (Review Rules)

* **Antigravity 審查 Codex**：Codex 完成的實作，可交由 Antigravity 進行針對性驗證與審查 (Targeted Review)。
* **高風險實作的審查**：若 Antigravity 的實作涉及 Auth、RLS (Row Level Security)、Schema 異動、Domain Mapping 或高風險整合，必須由 Codex 或 ChatGPT 進行 Integration Review。
* **免除審查條件**：小型、局部、具備獨立可測試性的修改，不強制要求 Codex 進行審查。

## 6. 成本控制原則 (Cost-Control Principle)

**Never spend Codex capacity on work that can be safely bounded and independently verified for Antigravity.**
(永遠不要將 Codex 的高成本運算力消耗在可以安全劃分邊界並由 Antigravity 獨立驗證的工作上。)

## 7. Travel Portal 協作範例 (Examples)

### 範例一：Trajectory Product Decision
* **情境**：定義「行程 (Trajectory)」模組應包含哪些子實體與關聯性。
* **流程**：
  1. ChatGPT 產出初步 `PRODUCT_DRAFT`。
  2. 遇到不確定的功能範圍，標記 `USER_DECISION_REQUIRED` 交由 User 拍板。
  3. User 拍板後，如果任務已指定 independent/targeted review，ChatGPT 必須先將狀態推進至 `REVIEW_READY`。
  4. 交由 Antigravity 進行審查 (review)。
  5. 再由 ChatGPT 進行裁決 (adjudicate)，通過後才進入 `ENGINEERING_READY`。

### 範例二：Supabase Schema Design
* **情境**：建立 Trajectory 相關的 Tables、Foreign Keys 與 RLS Policy。
* **流程**：
  1. 任務因高風險與跨模組特性，路由給 Codex 執行。
  2. Codex 完成 Schema 撰寫，狀態進入 `IMPLEMENTED` / `REVIEW_READY`。
  3. Antigravity 進行 targeted review，確認 SQL 語法與基礎規範是否吻合，完成 `REVIEWED`。
  4. User 或 ChatGPT 進行 `FINAL_REVIEW` 確保符合業務邏輯。

### 範例三：Bounded Frontend Implementation
* **情境**：依據 Figma 設計圖，實作單一個 `TrajectoryCard` UI 元件。
* **流程**：
  1. 任務具備清楚邊界與驗收條件，直接分派給 Antigravity。
  2. Antigravity 完成開發並通過局部測試 (`IMPLEMENTED`)。
  3. 因屬小型、局部可測試修改，不強制 Codex 審查。
  4. 直接進入 `FINAL_REVIEW` 確認 UI 樣式。
