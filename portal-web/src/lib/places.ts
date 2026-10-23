import parsedData from '@/data/parsed-trajectory.json';
import placesMetadataRaw from '@/data/places-metadata.json';
import type { PlacesMetadataMap, EnrichedPlace, MediaItem, PlaceMetadata, DaySummary } from '@/types/itinerary';

const placesMetadata = placesMetadataRaw as unknown as PlacesMetadataMap;

/**
 * 從 YouTube 網址或 ID 中提取 11 位元的影片 ID
 */
export function extractYouTubeId(urlOrId: string): string {
  if (!urlOrId) return '';
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) {
    return urlOrId;
  }
  try {
    const parsed = new URL(urlOrId);
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1);
    }
    if (parsed.hostname.includes('youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v) return v;
      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.replace('/embed/', '');
      }
    }
  } catch {
    // 忽略網址解析異常
  }
  return urlOrId;
}

/**
 * 取得 YouTube 高畫質縮圖網址
 */
export function getYouTubeThumbnail(urlOrId: string): string {
  const id = extractYouTubeId(urlOrId);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
}

/**
 * 提取 YYYY-MM-DD 日期字串
 */
export function getDateStr(timestampStr?: string): string {
  if (!timestampStr) return '';
  try {
    const date = new Date(timestampStr);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

/**
 * 將 ISO 時間字串轉為台灣常用的友善格式 (例如: 8月19日 17:03)
 */
export function formatTimestamp(timestampStr?: string): string {
  if (!timestampStr) return '';
  try {
    const date = new Date(timestampStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('zh-TW', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return '';
  }
}

/**
 * 決定景點封面圖 (依序：照片 > YouTube 縮圖 > 原生屬性圖 > 預設旅遊圖)
 */
const DEFAULT_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80';

export function getCoverImage(media: MediaItem[], featureProps: any): string {
  // 1. 若有 media 且包含 image，優先使用第一張相片
  const firstImage = media.find(m => m.type === 'image' && m.url);
  if (firstImage) return firstImage.url;

  // 2. 若有 media 且包含 youtube，使用 YouTube 縮圖
  const firstVideo = media.find(m => m.type === 'youtube' && m.url);
  if (firstVideo) {
    const thumb = getYouTubeThumbnail(firstVideo.url);
    if (thumb) return thumb;
  }

  // 3. 原生屬性中的 imageUrl
  if (featureProps?.imageUrl) return featureProps.imageUrl;

  // 4. 原生屬性中的 youtubeId
  if (featureProps?.youtubeId) {
    const thumb = getYouTubeThumbnail(featureProps.youtubeId);
    if (thumb) return thumb;
  }

  // 5. 預設佔位圖
  return DEFAULT_FALLBACK_IMAGE;
}

/**
 * 將單一 GeoJSON 節點與中繼資料 (metadata) 融合為 EnrichedPlace
 */
export function enrichFeatureNode(feature: any, dateToDayMap?: Map<string, number>): EnrichedPlace {
  const props = feature.properties || {};
  const geometry = feature.geometry || {};
  const rawCoordinates = geometry.coordinates;
  const coordinates: [number, number] | null =
    Array.isArray(rawCoordinates) &&
    rawCoordinates.length >= 2 &&
    Number.isFinite(rawCoordinates[0]) &&
    Number.isFinite(rawCoordinates[1])
      ? [rawCoordinates[0], rawCoordinates[1]]
      : null;
  const nodeId = props.id || '';
  const meta: PlaceMetadata | undefined = nodeId ? placesMetadata[nodeId] : undefined;

  const title = meta?.title || props.title || '未命名景點';
  const description = meta?.description || props.description || '';
  const tags = meta?.tags || [];
  const category = meta?.category || props.category || 'other';
  const isHighlight = meta?.isHighlight ?? false;

  let media: MediaItem[] = meta?.media ? [...meta.media] : [];
  if (media.length === 0) {
    if (props.youtubeId) {
      media.push({
        type: 'youtube',
        url: props.youtubeId,
        title: '影片記錄'
      });
    } else if (props.imageUrl) {
      media.push({
        type: 'image',
        url: props.imageUrl,
        title: '景點照片'
      });
    }
  }

  const timestamp = props.timestamp;
  const formattedTime = formatTimestamp(timestamp);
  const coverImageUrl = getCoverImage(media, props);
  const dateStr = getDateStr(timestamp);
  const dayNumber = dateStr && dateToDayMap ? (dateToDayMap.get(dateStr) || 1) : 1;

  return {
    id: nodeId,
    title,
    description,
    tags,
    category,
    isHighlight,
    media,
    coordinates,
    timestamp,
    formattedTime,
    coverImageUrl,
    dayNumber,
    dateStr
  };
}

/**
 * 取得所有豐富化後的景點清單
 * @param sortByHighlight 是否優先將「精選推薦」景點排在前方 (預設 true)
 */
export function getAllEnrichedPlaces(sortByHighlight = true): EnrichedPlace[] {
  const features = (parsedData.features || []) as any[];
  const nodeFeatures = features.filter(f => f.properties?.type === 'video-node');
  
  // 建立不重複且依時序排列的日期映射 Map
  const uniqueDates = Array.from(new Set(
    nodeFeatures
      .map(f => getDateStr(f.properties?.timestamp))
      .filter(Boolean)
  )).sort();

  const dateToDayMap = new Map<string, number>();
  uniqueDates.forEach((d, idx) => {
    dateToDayMap.set(d, idx + 1);
  });

  const enriched = nodeFeatures.map(f => enrichFeatureNode(f, dateToDayMap));

  if (!sortByHighlight) {
    return enriched;
  }

  // 精選景點優先排在前方，各自內部再按時間排序
  return enriched.sort((a, b) => {
    if (a.isHighlight && !b.isHighlight) return -1;
    if (!a.isHighlight && b.isHighlight) return 1;

    // 若精選狀態相同，依時間排序
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return timeA - timeB;
  });
}

/**
 * 取得行程的所有天數摘要資訊 (Day 1 ~ Day N)
 */
export function getDaysSummary(places: EnrichedPlace[]): DaySummary[] {
  const dayMap = new Map<number, {
    day: number;
    dateStr: string;
    places: EnrichedPlace[];
  }>();

  places.forEach(p => {
    const day = p.dayNumber || 1;
    if (!dayMap.has(day)) {
      dayMap.set(day, {
        day,
        dateStr: p.dateStr || '',
        places: []
      });
    }
    dayMap.get(day)!.places.push(p);
  });

  const summaries: DaySummary[] = [];
  Array.from(dayMap.keys()).sort((a, b) => a - b).forEach(day => {
    const info = dayMap.get(day)!;
    const dayPlaces = info.places;
    const times = dayPlaces.map(p => p.timestamp ? new Date(p.timestamp).getTime() : 0).filter(t => t > 0);
    const startTime = times.length > 0 ? Math.min(...times) : 0;
    const endTime = times.length > 0 ? Math.max(...times) : 0;
    
    // 友善日期格式，如 "8月14日"
    let formattedDate = '';
    if (info.dateStr) {
      const parts = info.dateStr.split('-');
      if (parts.length === 3) {
        formattedDate = `${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
      }
    }

    summaries.push({
      day,
      dateStr: info.dateStr,
      formattedDate,
      title: `Day ${day}${formattedDate ? ` (${formattedDate})` : ''}`,
      placeCount: dayPlaces.length,
      startTime,
      endTime
    });
  });

  return summaries;
}

/**
 * 取得所有景點中包含的熱門標籤與統計
 */
export function getUniqueTags(places: EnrichedPlace[]): { tag: string; count: number }[] {
  const tagCountMap = new Map<string, number>();
  places.forEach(p => {
    (p.tags || []).forEach(t => {
      tagCountMap.set(t, (tagCountMap.get(t) || 0) + 1);
    });
  });

  return Array.from(tagCountMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}
