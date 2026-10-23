const fs = require('fs');
const path = require('path');

// 檔案路徑定義
const TRAJECTORY_PATH = path.join(__dirname, '../src/data/parsed-trajectory.json');
const METADATA_PATH = path.join(__dirname, '../src/data/places-metadata.json');

console.log('開始執行自動分類與資料補齊腳本...');

// 1. 讀取現有資料
const trajectoryData = JSON.parse(fs.readFileSync(TRAJECTORY_PATH, 'utf8'));
let metadata = {};
if (fs.existsSync(METADATA_PATH)) {
  metadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8'));
}

// 關鍵字分類規則
const keywordRules = [
  { category: 'transit', keywords: ['站', '車站', '巴士', '機場', '轉乘', '交通', '新幹線', '鐵', '線'] },
  { category: 'food', keywords: ['餐廳', '麵', '飯', '食', '咖啡', '甜點', '居酒屋', '燒肉', '屋', '壽司', '牛', '豚'] },
  { category: 'stay', keywords: ['飯店', '住宿', '旅館', '酒店', 'inn', 'hotel'] }
];

function inferCategory(title) {
  if (!title) return 'spot'; // 預設為景點
  for (const rule of keywordRules) {
    if (rule.keywords.some(kw => title.includes(kw))) {
      return rule.category;
    }
  }
  return 'spot'; // 預設為景點
}

// 2. 掃描所有 video-node
const videoNodes = trajectoryData.features.filter(f => f.properties?.type === 'video-node');
let addedCount = 0;

for (const node of videoNodes) {
  const props = node.properties;
  const nodeId = props.id;
  
  if (!nodeId) continue;

  // 如果已經存在於 metadata，保留不覆蓋（尊重手動編輯的資料）
  if (metadata[nodeId]) {
    continue;
  }

  // 3. 推斷類別與建構基礎資料
  const title = props.title || `未命名景點 (${nodeId})`;
  const category = inferCategory(title);
  
  // 處理預設媒體
  const media = [];
  if (props.youtubeId) {
    media.push({
      type: 'youtube',
      url: props.youtubeId,
      title: '旅程紀錄',
      caption: props.description || ''
    });
  } else if (props.imageUrl) {
    media.push({
      type: 'image',
      url: props.imageUrl,
      title: '景點照片',
      caption: props.description || ''
    });
  }

  // 寫入新的 entry
  metadata[nodeId] = {
    id: nodeId,
    title: title,
    description: props.description || '',
    tags: ['自動分類'], // 標記為自動產生
    category: category,
    isHighlight: false,
    media: media
  };
  
  addedCount++;
  console.log(`已補齊: ${nodeId} -> [${category}] ${title}`);
}

// 4. 寫回檔案 (確保 UTF-8 格式與美觀的縮排)
fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2), 'utf8');

console.log(`\n執行完畢！共補齊了 ${addedCount} 個景點的 metadata。`);
