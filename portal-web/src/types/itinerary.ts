export type MediaType = 'youtube' | 'image' | 'external-video';

export interface MediaItem {
  type: MediaType;
  url: string; // 支援 YouTube 完整網址、YouTube Video ID 或圖片 URL (本機/外部)
  title?: string;
  caption?: string;
  thumbnail?: string;
  platform?: 'ig' | 'fb' | 'tiktok'; // 外部影片所屬平台
}

export interface PlaceMetadata {
  id: string; // 對應 GeoJSON 特徵中的 id (例如 "node-1")
  title: string; // 景點真實名稱
  description?: string; // 景點詳細描述或旅遊心得
  tags: string[]; // 自訂標籤 (例如 ["日本山陽", "歷史古蹟", "必吃美食"])
  media: MediaItem[]; // 支援同時擁有影片與多張相片
  isHighlight?: boolean; // 是否為重要地標
  category?: 'spot' | 'food' | 'stay' | 'transit' | 'other'; // 景點分類
}

export type PlacesMetadataMap = Record<string, PlaceMetadata>;

export interface EnrichedPlace {
  id: string; // 例如 "node-1"
  title: string; // 景點名稱
  description?: string; // 景點描述
  tags: string[]; // 標籤
  category?: 'spot' | 'food' | 'stay' | 'transit' | 'other'; // 分類
  isHighlight?: boolean; // 是否為精選景點
  media: MediaItem[]; // 多媒體清單
  coordinates: [number, number] | null; // [經度 lng, 緯度 lat]；未公開位置必須保留 null
  timestamp?: string; // 到達時間字串 (ISO 或原始)
  narrativeDwellMs?: number; // 僅供公開播放的衍生敘事停留時間；不是 raw Visit duration
  formattedTime?: string; // 友善格式化時間 (例如: 8月19日 16:03)
  coverImageUrl?: string; // 封面圖網址 (照片或 YouTube 縮圖)
  dayNumber?: number; // 所屬行程天數 (1, 2, 3...)
  dateStr?: string; // 所屬日期字串 (YYYY-MM-DD)
}

export interface DaySummary {
  day: number; // 天數編號 (1 ~ N)
  dateStr: string; // 日期字串 (YYYY-MM-DD)
  formattedDate: string; // 格式化日期 (8月14日)
  title: string; // 顯示標題 (例如: Day 1 (8/14))
  placeCount: number; // 該日景點數量
  startTime: number; // 該日首個節點時間戳記
  endTime: number; // 該日最後節點時間戳記
}

export interface CruiseState {
  isCruising: boolean; // 是否啟用劇院巡航導覽模式
  isDwelling: boolean; // 是否處於景點駐留倒數狀態
  currentStopIndex: number; // 當前駐留或目標景點索引 (0 ~ N-1)
  dwellProgress: number; // 當前駐留倒數百分比 (0 ~ 100)
  totalStops: number; // 總景點數
  isHoverPaused?: boolean; // 是否因滑鼠懸停故事卡而暫停倒數
}
