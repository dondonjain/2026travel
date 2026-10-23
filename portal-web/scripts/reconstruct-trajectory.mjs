import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import * as turf from '@turf/turf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Public mapbox publishable token used for frontend/routing
const TOKEN = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

// --- Provisional Engineering Thresholds ---
const THRESHOLDS = {
  MAX_SEGMENT_DISTANCE_KM: 15.0, // Split chunk if consecutive points are > 15km apart
  MAX_SEGMENT_TIME_MS: 3600000 * 2, // Split chunk if gap is > 2 hours
  MAX_CHUNK_POINTS: 95, // Mapbox limits to 100 coords per request
  MIN_MATCHING_POINTS: 3, // At least 3 points needed to form a road-like chunk
  GREAT_CIRCLE_THRESHOLD_KM: 300.0, // > 300km total chunk distance is considered flight
  MIN_CONFIDENCE: 0.5, // Minimum confidence to accept a match
  MIN_COVERAGE: 0.7, // Matched distance must be at least 70% of raw distance
  MAX_DETOUR_RATIO: 1.5, // Matched distance should not exceed 1.5x raw distance
  MIN_DETOUR_RATIO: 0.8, // Matched distance should not be less than 0.8x raw distance (unless highly confident)
  MATCHING_RADIUS: 25 // 25 meters search radius for GPS anchors
};

function getMapMatching(coords) {
  return new Promise((resolve) => {
    const coordStr = coords.map(c => `${c[0]},${c[1]}`).join(';');
    const radiuses = coords.map(() => THRESHOLDS.MATCHING_RADIUS).join(';');
    const url = `https://api.mapbox.com/matching/v5/mapbox/driving/${coordStr}?geometries=geojson&radiuses=${radiuses}&overview=full&access_token=${TOKEN}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch(e) {
          resolve({ code: 'Error', message: e.message });
        }
      });
    }).on('error', (e) => {
      resolve({ code: 'Error', message: e.message });
    });
  });
}

function pathDistance(coords) {
  if (!coords || coords.length < 2) return 0;
  const line = turf.lineString(coords);
  return turf.length(line, { units: 'kilometers' });
}

function interpolateTimes(coords, tStart, tEnd, totalDist) {
  if (coords.length === 1) return [tStart];
  if (totalDist === 0) {
      return coords.map((_, i) => tStart + ((tEnd - tStart) * (i / (coords.length - 1))));
  }
  let times = [tStart];
  let cumulative = 0;
  for(let i=1; i<coords.length; i++) {
    cumulative += pathDistance([coords[i-1], coords[i]]);
    let ratio = cumulative / totalDist;
    if(ratio > 1) ratio = 1;
    times.push(tStart + (tEnd - tStart) * ratio);
  }
  return times;
}

function segmentAnchors(anchors, times) {
  let chunks = [];
  let currentChunk = { anchors: [anchors[0]], times: [times[0]], startIdx: 0 };
  
  for(let i=1; i<anchors.length; i++) {
    const d = pathDistance([anchors[i-1], anchors[i]]);
    const t = times[i] - times[i-1];
    
    if (d > THRESHOLDS.MAX_SEGMENT_DISTANCE_KM || t > THRESHOLDS.MAX_SEGMENT_TIME_MS || currentChunk.anchors.length >= THRESHOLDS.MAX_CHUNK_POINTS) {
      chunks.push(currentChunk);
      chunks.push({ anchors: [anchors[i-1], anchors[i]], times: [times[i-1], times[i]], startIdx: i-1, isGap: true });
      currentChunk = { anchors: [anchors[i]], times: [times[i]], startIdx: i };
    } else {
      currentChunk.anchors.push(anchors[i]);
      currentChunk.times.push(times[i]);
    }
  }
  if (currentChunk.anchors.length > 0) chunks.push(currentChunk);
  return chunks;
}

async function processChunk(chunk) {
  const rawDist = pathDistance(chunk.anchors);
  const elapsedMs = chunk.times[chunk.times.length - 1] - chunk.times[0];
  
  const result = {
    method: 'REJECTED_OR_UNCERTAIN',
    coords: chunk.anchors,
    times: chunk.times,
    rawDist,
    finalDist: rawDist,
    confidence: null,
    reason: ''
  };

  if (chunk.anchors.length < 2) {
    result.method = 'FALLBACK_RAW';
    result.reason = 'Single point';
    return result;
  }

  if (rawDist > THRESHOLDS.GREAT_CIRCLE_THRESHOLD_KM) {
    const arc = turf.greatCircle(turf.point(chunk.anchors[0]), turf.point(chunk.anchors[chunk.anchors.length - 1]), { npoints: 100 });
    result.coords = arc.geometry.coordinates;
    result.finalDist = pathDistance(result.coords);
    result.times = interpolateTimes(result.coords, chunk.times[0], chunk.times[chunk.times.length - 1], result.finalDist);
    result.method = 'GREAT_CIRCLE';
    result.reason = `Distance ${rawDist.toFixed(1)}km > ${THRESHOLDS.GREAT_CIRCLE_THRESHOLD_KM}`;
    return result;
  }

  if (chunk.anchors.length < THRESHOLDS.MIN_MATCHING_POINTS) {
    result.method = 'FALLBACK_RAW';
    result.reason = `Only ${chunk.anchors.length} points`;
    return result;
  }

  // Attempt Map Matching
  const matchResult = await getMapMatching(chunk.anchors);
  if (matchResult.code !== 'Ok' || !matchResult.matchings || matchResult.matchings.length === 0) {
    result.method = 'FALLBACK_RAW';
    result.reason = `API Failure or No Match: ${matchResult.code}`;
    return result;
  }

  let matchedCoords = [];
  let totalConfidence = 0;
  matchResult.matchings.forEach((m) => {
    matchedCoords.push(...m.geometry.coordinates);
    totalConfidence += m.confidence;
  });
  
  const avgConfidence = totalConfidence / matchResult.matchings.length;
  result.confidence = avgConfidence;

  const matchedDist = pathDistance(matchedCoords);
  const coverage = matchedDist / rawDist; 
  const detourRatio = matchedDist / rawDist; 

  if (avgConfidence < THRESHOLDS.MIN_CONFIDENCE) {
    result.method = 'FALLBACK_RAW';
    result.reason = `Low confidence: ${avgConfidence.toFixed(2)}`;
    return result;
  }

  if (detourRatio < THRESHOLDS.MIN_COVERAGE) {
    result.method = 'FALLBACK_RAW';
    result.reason = `Low coverage: matched ${matchedDist.toFixed(1)}km vs raw ${rawDist.toFixed(1)}km`;
    return result;
  }

  if (detourRatio > THRESHOLDS.MAX_DETOUR_RATIO && avgConfidence < 0.8) {
    result.method = 'FALLBACK_RAW';
    result.reason = `Excessive detour: ratio ${detourRatio.toFixed(2)} with conf ${avgConfidence.toFixed(2)}`;
    return result;
  }

  result.coords = matchedCoords;
  result.finalDist = matchedDist;
  result.times = interpolateTimes(result.coords, chunk.times[0], chunk.times[chunk.times.length - 1], result.finalDist);
  result.method = avgConfidence > 0.8 ? 'MATCHED_HIGH_CONFIDENCE' : 'MATCHED_ACCEPTED';
  result.reason = `Accepted with ratio ${detourRatio.toFixed(2)}, conf ${avgConfidence.toFixed(2)}`;
  
  return result;
}

function analyzeAnomalies(coords) {
    let exactAba = 0;
    for(let i = 2; i < coords.length; i++) {
        if(coords[i][0] === coords[i-2][0] && coords[i][1] === coords[i-2][1]) {
            exactAba++;
        }
    }
    let loops = 0;
    for(let i = 10; i < coords.length; i++) {
        for(let j=1; j<=10; j++) {
            if(coords[i][0] === coords[i-j][0] && coords[i][1] === coords[i-j][1]) {
                loops++;
                break;
            }
        }
    }
    return { exactAba, loops };
}

async function main() {
  const parsedPath = path.join(__dirname, '../src/data/parsed-trajectory.json');
  const enrichedPath = path.join(__dirname, '../src/data/enriched-trajectory.json');
  const outPath = path.join(__dirname, '../src/data/enriched-trajectory-v2.candidate.json');
  
  const parsedData = JSON.parse(fs.readFileSync(parsedPath, 'utf8'));
  const anchors = parsedData.features.find(f => f.properties && f.properties.type === 'trajectory').geometry.coordinates;
  const times = parsedData.properties.times;
  
  console.log(`Loaded ${anchors.length} anchors.`);
  
  const chunks = segmentAnchors(anchors, times);
  console.log(`Segmented into ${chunks.length} chunks.`);

  let finalCoords = [];
  let finalTimes = [];
  
  let stats = {
    MATCHED_HIGH_CONFIDENCE: 0,
    MATCHED_ACCEPTED: 0,
    FALLBACK_RAW: 0,
    GREAT_CIRCLE: 0,
    MATCHING_NOT_ELIGIBLE: 0,
    REJECTED_OR_UNCERTAIN: 0,
    totalRawDist: 0,
    totalFinalDist: 0,
    apiFailures: 0
  };

  const chunkReports = [];

  for(let i=0; i<chunks.length; i++) {
    const chunk = chunks[i];
    const res = await processChunk(chunk);
    
    if (res.method === 'FALLBACK_RAW' && chunk.anchors.length < THRESHOLDS.MIN_MATCHING_POINTS) {
      if (chunk.isGap) {
        // Just raw gap
      } else {
        stats.MATCHING_NOT_ELIGIBLE++;
      }
    } else {
      stats[res.method] = (stats[res.method] || 0) + 1;
    }
    
    if (res.reason.includes('API Failure')) stats.apiFailures++;
    stats.totalRawDist += res.rawDist;
    stats.totalFinalDist += res.finalDist;
    
    chunkReports.push({
      index: i,
      startIdx: chunk.startIdx,
      isGap: !!chunk.isGap,
      points: chunk.anchors.length,
      rawDist: res.rawDist,
      method: res.method,
      confidence: res.confidence,
      reason: res.reason
    });
    
    // Stitching logic
    if (finalCoords.length > 0) {
      const lastCoord = finalCoords[finalCoords.length - 1];
      const nextCoord = res.coords[0];
      if (lastCoord[0] === nextCoord[0] && lastCoord[1] === nextCoord[1]) {
        res.coords.shift();
        res.times.shift();
      }
    }
    
    finalCoords.push(...res.coords);
    finalTimes.push(...res.times);
  }

  const oldData = JSON.parse(fs.readFileSync(enrichedPath, 'utf8'));
  const oldLine = oldData.features.find(f => f.geometry.type === 'LineString');
  const oldCoords = oldLine.geometry.coordinates;
  const oldDist = pathDistance(oldCoords);
  const oldAnomalies = analyzeAnomalies(oldCoords);
  const newAnomalies = analyzeAnomalies(finalCoords);

  console.log("\n=================================");
  console.log("Whole-trip QA Report");
  console.log("=================================");
  console.log(`Global:
  - Source Anchors: ${anchors.length}
  - Old Enriched Coords: ${oldCoords.length}
  - V2 Candidate Coords: ${finalCoords.length}
  - Total Raw Distance: ${stats.totalRawDist.toFixed(2)} km
  - Old Enriched Distance: ${oldDist.toFixed(2)} km
  - Candidate Total Distance: ${stats.totalFinalDist.toFixed(2)} km
  - Total Chunks: ${chunks.length}`);
  
  console.log(`\nReconstruction Distribution (excluding pure gaps):
  - MATCHED_HIGH_CONFIDENCE: ${stats.MATCHED_HIGH_CONFIDENCE}
  - MATCHED_ACCEPTED: ${stats.MATCHED_ACCEPTED}
  - FALLBACK_RAW: ${stats.FALLBACK_RAW}
  - GREAT_CIRCLE: ${stats.GREAT_CIRCLE}
  - MATCHING_NOT_ELIGIBLE: ${stats.MATCHING_NOT_ELIGIBLE}
  - REJECTED_OR_UNCERTAIN: ${stats.REJECTED_OR_UNCERTAIN}`);
  
  console.log(`\nMatching Quality:
  - API Failures: ${stats.apiFailures}`);
  
  console.log(`\nGeometry Anomalies (Old vs Candidate):
  - Exact A->B->A: ${oldAnomalies.exactAba} vs ${newAnomalies.exactAba}
  - Suspicious Loops (<=10): ${oldAnomalies.loops} vs ${newAnomalies.loops}`);
  
  // Dump QA report summary to file
  fs.writeFileSync(path.join(__dirname, 'qa-report.json'), JSON.stringify(chunkReports, null, 2));

  // Build candidate JSON
  const candidateJson = JSON.parse(JSON.stringify(oldData));
  const candidateLine = candidateJson.features.find(f => f.geometry.type === 'LineString');
  candidateLine.geometry.coordinates = finalCoords;
  candidateJson.properties.times = finalTimes;
  fs.writeFileSync(outPath, JSON.stringify(candidateJson));
  console.log(`\nWrote candidate to ${outPath}`);
}

main().catch(console.error);
