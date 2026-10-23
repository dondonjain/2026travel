const fs = require('fs');
const path = require('path');
const turf = require('@turf/turf');
const https = require('https');

const TOKEN = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

function fetchDirections(coord1, coord2) {
  return new Promise((resolve) => {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coord1[0]},${coord1[1]};${coord2[0]},${coord2[1]}?geometries=geojson&overview=full&access_token=${TOKEN}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.code === 'Ok' && parsed.routes && parsed.routes.length > 0) {
            resolve(parsed.routes[0].geometry.coordinates);
          } else {
            resolve([coord1, coord2]); // fallback
          }
        } catch(e) {
          resolve([coord1, coord2]);
        }
      });
    }).on('error', () => {
      resolve([coord1, coord2]);
    });
  });
}

async function processTrajectory() {
  const inputPath = path.join(__dirname, '..', '..', '..', '..', '..', '..', '..', 'd:', 'AI', 'SynologyDrive', 'travel', 'portal-web', 'src', 'data', 'parsed-trajectory.json');
  const outputPath = path.join(__dirname, '..', '..', '..', '..', '..', '..', '..', 'd:', 'AI', 'SynologyDrive', 'travel', 'portal-web', 'src', 'data', 'enriched-trajectory.json');
  
  // Actually, I can just use absolute paths since I know it
  const absInputPath = 'd:\\AI\\SynologyDrive\\travel\\portal-web\\src\\data\\parsed-trajectory.json';
  const absOutputPath = 'd:\\AI\\SynologyDrive\\travel\\portal-web\\src\\data\\enriched-trajectory.json';
  
  const data = JSON.parse(fs.readFileSync(absInputPath, 'utf8'));
  const originalTimes = data.properties.times;
  
  const lineFeature = data.features.find(f => f.properties.type === 'trajectory');
  const originalCoords = lineFeature.geometry.coordinates;

  let newCoords = [originalCoords[0]];
  let newTimes = [originalTimes[0]];

  console.log(`Processing ${originalCoords.length} points...`);

  for (let i = 0; i < originalCoords.length - 1; i++) {
    const p1 = originalCoords[i];
    const p2 = originalCoords[i+1];
    const t1 = originalTimes[i];
    const t2 = originalTimes[i+1];

    if (p1[0] === p2[0] && p1[1] === p2[1]) {
      newCoords.push(p2);
      newTimes.push(t2);
      continue;
    }

    const dist = turf.distance(turf.point(p1), turf.point(p2), { units: 'kilometers' });

    let segmentCoords = [];

    if (dist > 300) {
      console.log(`Flight detected: ${dist.toFixed(2)} km. Generating Great Circle...`);
      const arc = turf.greatCircle(turf.point(p1), turf.point(p2), { npoints: 100 });
      segmentCoords = arc.geometry.coordinates;
    } else if (dist > 0.5) {
      console.log(`Driving detected: ${dist.toFixed(2)} km. Fetching route...`);
      segmentCoords = await fetchDirections(p1, p2);
      await new Promise(r => setTimeout(r, 200));
    } else {
      segmentCoords = [p1, p2];
    }

    const segmentLine = turf.lineString(segmentCoords);
    const totalSegmentDist = turf.length(segmentLine, { units: 'kilometers' });
    
    let cumulativeDist = 0;
    for (let j = 1; j < segmentCoords.length; j++) {
      const d = turf.distance(turf.point(segmentCoords[j-1]), turf.point(segmentCoords[j]), { units: 'kilometers' });
      cumulativeDist += d;
      let ratio = totalSegmentDist > 0 ? cumulativeDist / totalSegmentDist : 1;
      if (ratio > 1) ratio = 1;
      
      const interpTime = t1 + (t2 - t1) * ratio;
      newCoords.push(segmentCoords[j]);
      newTimes.push(interpTime);
    }
  }

  data.properties.times = newTimes;
  lineFeature.geometry.coordinates = newCoords;

  fs.writeFileSync(absOutputPath, JSON.stringify(data, null, 2));
  console.log(`Done! Original points: ${originalCoords.length}, New points: ${newCoords.length}`);
}

processTrajectory();
