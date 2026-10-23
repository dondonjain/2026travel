const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../src/data/raw/Timeline.json');
const outputPath = path.join(__dirname, '../src/data/parsed-trajectory.json');

console.log('開始讀取 Timeline.json...');
const rawData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

// 目標：2026年8月 14~21日
const targetYear = 2026;
const targetMonth = 8;
const targetStartDay = 14;
const targetEndDay = 21;

const parseGeo = (geoStr) => {
  if (!geoStr || !geoStr.startsWith('geo:')) return null;
  const parts = geoStr.replace('geo:', '').split(',');
  return [parseFloat(parts[1]), parseFloat(parts[0])];
};

const coordinates = [];
const times = [];
const nodes = [];
let nodeCounter = 1;

console.log(`正在過濾 ${targetYear}/${targetMonth}/${targetStartDay} 到 ${targetEndDay} 的資料...`);

rawData.forEach(item => {
  if (!item.startTime) return;
  const startDate = new Date(item.startTime);
  
  if (
    startDate.getFullYear() === targetYear && 
    startDate.getMonth() + 1 === targetMonth &&
    startDate.getDate() >= targetStartDay &&
    startDate.getDate() <= targetEndDay
  ) {
    if (item.activity) {
      if (item.activity.start) {
        const coord = parseGeo(item.activity.start);
        if (coord) { coordinates.push(coord); times.push(item.startTime); }
      }
      if (item.activity.end) {
        const coord = parseGeo(item.activity.end);
        if (coord) { coordinates.push(coord); times.push(item.endTime || item.startTime); }
      }
    }
    
    if (item.timelinePath && Array.isArray(item.timelinePath)) {
      item.timelinePath.forEach(tp => {
        const coord = parseGeo(tp.point);
        const offset = parseInt(tp.durationMinutesOffsetFromStartTime || 0);
        const ptTime = new Date(startDate.getTime() + offset * 60000).toISOString();
        if (coord) { coordinates.push(coord); times.push(ptTime); }
      });
    }
    
    if (item.visit && item.visit.topCandidate && item.visit.topCandidate.placeLocation) {
      const coord = parseGeo(item.visit.topCandidate.placeLocation);
      if (coord) {
        coordinates.push(coord);
        times.push(item.startTime);
        
        nodes.push({
          type: 'Feature',
          properties: {
            id: `node-${nodeCounter}`,
            type: 'video-node',
            title: `旅程景點 ${nodeCounter}`,
            description: `抵達時間：${startDate.toLocaleString('zh-TW')}。`,
            youtubeId: 'jNQXAC9IVRw', 
            timestamp: item.startTime
          },
          geometry: {
            type: 'Point',
            coordinates: coord
          }
        });
        nodeCounter++;
      }
    }
  }
});

// 將所有軌跡點依照時間排序
const merged = coordinates.map((coord, i) => ({ coord, time: times[i] }));
merged.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

const sortedCoords = merged.map(m => m.coord);
const sortedTimes = merged.map(m => new Date(m.time).getTime());

const geojson = {
  type: 'FeatureCollection',
  properties: {
    startTime: sortedTimes[0] || null,
    endTime: sortedTimes[sortedTimes.length - 1] || null,
    times: sortedTimes
  },
  features: []
};

if (sortedCoords.length > 1) {
  geojson.features.push({
    type: 'Feature',
    properties: {
      id: 'real-trajectory-line',
      type: 'trajectory'
    },
    geometry: {
      type: 'LineString',
      coordinates: sortedCoords
    }
  });
}

geojson.features.push(...nodes);

fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
console.log(`轉換完成！提取了 ${sortedCoords.length} 個軌跡點，以及 ${nodes.length} 個景點。`);
