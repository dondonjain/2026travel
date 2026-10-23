# Phase 8-A: Supabase 動態資料庫與架構遷移設計 (Schema Design)

為了讓專案具備營運能力，允許非技術人員 (PM/編輯) 透過 CMS 新增或修改行程景點，我們決定引入 **Supabase (PostgreSQL + PostGIS)** 作為核心資料庫。

本文件定義了資料庫的 Schema 結構，以及如何從靜態 JSON 無痛轉移至資料庫的架構策略。

---

## 1. 實體正規化 (Entity Normalization) 與架構考量

過去在靜態 JSON 中，我們將「物理景點」與「造訪紀錄」混為一談 (例如 `node-1` 與 `node-4` 皆為岡山車站)。進入關聯式資料庫後，我們將徹底解耦這兩個概念：

* **Place (物理景點)**：客觀存在的地點。擁有固定的座標、本名、類別。
* **Visit (造訪紀錄)**：主觀的旅行體驗。綁定特定的時間、當下的遊記 (description)、當下拍攝的照片 (media) 以及是否為當日亮點 (is_highlight)。

這種設計不僅能避免座標重複儲存，更能輕鬆回答「我這輩子去過幾次岡山車站？」這類高階數據問題。

---

## 2. 資料庫 Schema 設計 (Place-Visit 解耦架構)

### 表格 1：`trips` (行程/旅程)
最高層級的旅程表，支援多趟不同的旅行。

| 欄位名稱 | 型別 | 屬性 | 說明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, Default (uuid_generate_v4) | 旅程唯一識別碼 |
| `title` | `varchar(255)` | Not Null | 旅程標題 (例：2026 日本山陽山陰自駕遊) |
| `slug` | `varchar(100)` | Unique, Not Null | URL 識別 (例：`sanyo-roadtrip-2026`) |
| `start_date` | `date` | Not Null | 旅程開始日期 |
| `end_date` | `date` | Not Null | 旅程結束日期 |

### 表格 2：`places` (物理景點)
客觀的地理資訊點 (POI - Point of Interest)。未來可與 Google Places API 串接。

| 欄位名稱 | 型別 | 屬性 | 說明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, Default (uuid_generate_v4) | 景點唯一識別碼 |
| `name` | `varchar(255)` | Not Null | 景點客觀本名 (例：岡山車站) |
| `category` | `varchar(50)` | Default 'other' | 類別 (`spot`, `food`, `stay`, `transit`, `other`) |
| `coordinates` | `geography(Point, 4326)` | Not Null | 空間座標 (經度, 緯度) |
| `created_at` | `timestamptz`| Default NOW() | 建立時間 |

### 表格 3：`visits` (造訪紀錄 / 行程節點)
一趟旅程 (`trip`) 在特定時間 (`visited_at`) 抵達某個景點 (`place`) 的主觀體驗。

| 欄位名稱 | 型別 | 屬性 | 說明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, Default (uuid_generate_v4) | 造訪紀錄識別碼 |
| `trip_id` | `uuid` | FK (trips.id) | 所屬旅程 |
| `place_id` | `uuid` | FK (places.id) | 造訪的物理景點 |
| `node_slug` | `varchar(100)`| Unique, Nullable | 供舊有系統對應 (`node-1`, `node-4`) |
| `title_override`| `varchar(255)`| Nullable | 自訂標題 (例：保留"岡山車站抵達"，若空則吃 place.name) |
| `description` | `text` | Nullable | 該次造訪的詳細遊記/心得 |
| `is_highlight`| `boolean` | Default false | 是否為該次旅程/該日的精選亮點 |
| `tags` | `text[]` | Default '{}' | 該次造訪的主觀標籤 (`['初體驗', '迷路']`) |
| `visited_at` | `timestamptz`| Not Null | 抵達時間 (用於前端動態推算 Day 1~7) |

### 表格 4：`visit_media` (造訪時段的多媒體)
綁定在「當次造訪」而非「景點」上，因為照片/影片是紀錄特定時間點的故事。

| 欄位名稱 | 型別 | 屬性 | 說明 |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, Default (uuid_generate_v4) | 多媒體識別碼 |
| `visit_id` | `uuid` | FK (visits.id) | 所屬造訪紀錄 |
| `type` | `varchar(50)` | Not Null | 媒體類型 (`image`, `youtube`, `external-video`) |
| `url` | `text` | Not Null | 圖片網址或 YouTube ID/網址 |
| `thumbnail` | `text` | Nullable | 影片的自訂縮圖網址 (若有) |
| `title` | `varchar(255)` | Nullable | 媒體標題 |
| `caption` | `text` | Nullable | 照片/影片的圖說 |
| `display_order`| `integer` | Default 0 | 輪播排序權重 |

---

## 3. 無痛轉移 (Migration) 計畫

### 階段一：撰寫資料清理與移轉腳本 (`scripts/seed_from_json.ts`)
由於過去 JSON 把 Place 和 Visit 混在一起，腳本在寫入前必須先進行「實體聚合」：
1. **聚合 Places**：比對 JSON 中座標相近或名稱相同的節點 (例如 `node-1` 與 `node-4`)，將其合併為單一 `place` 寫入資料庫，獲得唯一的 `place_id`。
2. **生成 Visits**：將 `node-1` 與 `node-4` 的 timestamp、遊記、照片，分別帶入剛才生成的 `place_id`，獨立寫入 `visits` 與 `visit_media`。

### 階段二：改寫前端 `src/lib/places.ts` (API 串接)
前端介面 `EnrichedPlace` 型別不變，但資料來源將改為 JOIN 查詢：
```typescript
export async function getAllEnrichedPlaces(): Promise<EnrichedPlace[]> {
  // 一次 JOIN 拿回所有體驗與實體景點資料
  const { data: visits } = await supabase
    .from('visits')
    .select(`
      *,
      place:places(name, category, coordinates),
      media:visit_media(*)
    `)
    .order('visited_at', { ascending: true });
    
  // 在前端映射回舊有 EnrichedPlace 結構，讓畫面層無需修改任何程式碼！
}
```
