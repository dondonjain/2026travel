import { CMSTrip } from './types';
import { RECONSTRUCTED_SUMMER_TRIP } from './summer-fixture';

export { RECONSTRUCTED_SUMMER_TRIP };

export function getCmsTrip(slug?: string | null): CMSTrip {
  if (slug === 'japan-sanin-2026') {
    return INITIAL_TRIP_FIXTURE;
  }
  return RECONSTRUCTED_SUMMER_TRIP;
}

export const INITIAL_TRIP_FIXTURE: CMSTrip = {
  id: 'trip-japan-sanin-2026',
  slug: 'japan-sanin-2026',
  title: '2026 日本山陰山陽七日遊',
  startDate: '2026-08-14',
  endDate: '2026-08-20',
  publicationStatus: 'draft',
  usableTrajectory: true,
  days: [
    { dayNumber: 1, date: '2026-08-14', label: 'Day 1 (8/14)', subtitle: '岡山抵達 & 市區商圈' },
    { dayNumber: 2, date: '2026-08-15', label: 'Day 2 (8/15)', subtitle: '琴平烏龍麵 & 倉敷水島' },
    { dayNumber: 3, date: '2026-08-16', label: 'Day 3 (8/16)', subtitle: '尾道老街 & 廣島市區' },
    { dayNumber: 4, date: '2026-08-17', label: 'Day 4 (8/17)', subtitle: '廣島至松江山區行' },
    { dayNumber: 5, date: '2026-08-18', label: 'Day 5 (8/18)', subtitle: '出雲大社 & 松江城下町' },
    { dayNumber: 6, date: '2026-08-19', label: 'Day 6 (8/19)', subtitle: '境港水木茂 & 岡山返程' },
    { dayNumber: 7, date: '2026-08-20', label: 'Day 7 (8/20)', subtitle: '岡山機場回程' }
  ],
  visits: [
    // --- Day 1 (8/14) ---
    {
      id: 'visit-1',
      dayNumber: 1,
      title: '岡山車站 (JR Okayama Station)',
      placeName: '岡山車站',
      placeCategory: '交通',
      startTime: '17:00',
      endTime: '18:30',
      durationMinutes: 90,
      coordinate: [133.917733, 34.666121],
      reviewStatus: 'confirmed',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 463,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-14T17:03:52.000+09:00',
        rawGeo: [133.917733, 34.666121],
        candidateProbability: 0.96,
        topCandidateName: 'JR 岡山駅'
      }
    },
    {
      id: 'visit-2',
      dayNumber: 1,
      title: 'AEON MALL 岡山',
      placeName: 'AEON MALL 岡山',
      placeCategory: '購物',
      startTime: '18:40',
      endTime: '09:10',
      durationMinutes: 870,
      coordinate: [133.917628, 34.661996],
      reviewStatus: 'confirmed',
      visibility: 'public',
      issues: [],
      subVenues: [
        {
          title: 'AEON 內部美食專櫃',
          placeID: 'ChIJGfLII7MHVDURLji-tzvVC_0',
          hierarchyLevel: 1,
          durationMinutes: 21,
          flattenReason: 'HIERARCHY_LEVEL_1_NESTED_IN_LEVEL_0'
        }
      ],
      evidence: {
        sourceIndex: 464,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-14T18:37:38.055+09:00',
        rawGeo: [133.917628, 34.661996],
        candidateProbability: 0.81,
        topCandidateName: 'イオンモール岡山'
      }
    },

    // --- Day 2 (8/15) ---
    {
      id: 'visit-3',
      dayNumber: 2,
      title: '岡山車站 (出發)',
      placeName: '岡山車站',
      placeCategory: '交通',
      startTime: '09:20',
      endTime: '09:40',
      durationMinutes: 20,
      coordinate: [133.917733, 34.666121],
      reviewStatus: 'confirmed',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 467,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-15T09:18:23.000+09:00',
        rawGeo: [133.917733, 34.666121],
        candidateProbability: 0.89,
        topCandidateName: 'JR 岡山駅'
      }
    },
    {
      id: 'visit-4',
      dayNumber: 2,
      title: '讚岐烏龍麵 (琴平町)',
      placeName: '琴平町烏龍麵本館',
      placeCategory: '美食',
      startTime: '11:10',
      endTime: '14:20',
      durationMinutes: 190,
      coordinate: [133.817855, 34.188691],
      reviewStatus: 'confirmed',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 469,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-15T11:06:08.206+09:00',
        rawGeo: [133.817855, 34.188691],
        candidateProbability: 0.78,
        topCandidateName: 'こんぴら 讃岐うどん'
      }
    },
    {
      id: 'visit-5',
      dayNumber: 2,
      title: '水島休息點',
      placeName: '水島港灣休歇站',
      placeCategory: '休歇',
      startTime: '16:00',
      endTime: '16:10',
      durationMinutes: 10,
      coordinate: [133.743184, 34.539073],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 471,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-15T16:00:51.402+09:00',
        rawGeo: [133.743184, 34.539073],
        candidateProbability: 0.71,
        topCandidateName: '水島パーキング'
      }
    },
    {
      id: 'visit-6',
      dayNumber: 2,
      title: '倉敷美觀地區',
      placeName: '倉敷美觀地區 (歷史街道)',
      placeCategory: '景點',
      startTime: '17:00',
      endTime: '19:20',
      durationMinutes: 140,
      coordinate: [133.761495, 34.603587],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 473,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-15T16:57:40.296+09:00',
        rawGeo: [133.761495, 34.603587],
        candidateProbability: 0.85,
        topCandidateName: '倉敷美観地区'
      }
    },
    {
      id: 'visit-7',
      dayNumber: 2,
      title: '倉敷私人旅宿',
      placeName: '倉敷私人民宿 (夜間住宿)',
      placeCategory: '住宿',
      startTime: '20:30',
      endTime: '08:30',
      durationMinutes: 720,
      coordinate: [133.768964, 34.596808],
      reviewStatus: 'confirmed',
      visibility: 'private', // Confirmed + Private test case as required by CP1!
      issues: [],
      evidence: {
        sourceIndex: 475,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-15T20:33:28.000+09:00',
        rawGeo: [133.768964, 34.596808],
        candidateProbability: 0.92,
        topCandidateName: 'Private Residence'
      }
    },

    // --- Day 3 (8/16) ---
    {
      id: 'visit-8',
      dayNumber: 3,
      title: '超級酒店 Inn 倉敷水島',
      placeName: '超級酒店 Inn 倉敷水島',
      placeCategory: '住宿',
      startTime: '08:30',
      endTime: '11:50',
      durationMinutes: 200,
      coordinate: [133.743184, 34.539073],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 477,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-16T08:25:46.535+09:00',
        rawGeo: [133.743184, 34.539073],
        candidateProbability: 0.83,
        topCandidateName: 'スーパーホテルInn倉敷水島'
      }
    },
    {
      id: 'visit-9',
      dayNumber: 3,
      title: '山陽自動車道休息站',
      placeName: '福山服務區 (SA)',
      placeCategory: '休歇',
      startTime: '12:20',
      endTime: '13:00',
      durationMinutes: 40,
      coordinate: [133.515810, 34.498857],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [
        {
          id: 'issue-visit-9-place',
          type: 'place',
          severity: 'required',
          message: 'GPS 漂移導致地點置信度偏低 (44%)，請確認是否為福山服務區',
          recommendation: '核對高速公路休息區地點'
        }
      ],
      evidence: {
        sourceIndex: 479,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-16T12:18:08.304+09:00',
        rawGeo: [133.515810, 34.498857],
        candidateProbability: 0.44,
        topCandidateName: '山陽自動車道 福山SA'
      }
    },
    {
      id: 'visit-10',
      dayNumber: 3,
      title: '尾道市政廳 (頂樓展望台)',
      placeName: '尾道市政廳',
      placeCategory: '景點',
      startTime: '14:10',
      endTime: '15:20',
      durationMinutes: 70,
      coordinate: [133.203953, 34.408820],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 481,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-16T14:14:05.135+09:00',
        rawGeo: [133.203953, 34.408820],
        candidateProbability: 0.77,
        topCandidateName: '尾道市役所'
      }
    },
    {
      id: 'visit-11',
      dayNumber: 3,
      title: 'はぜや (Hazeya 廣島燒抵達)',
      placeName: 'はぜや 廣島燒',
      placeCategory: '美食',
      startTime: '17:30',
      endTime: '17:50',
      durationMinutes: 20,
      coordinate: [132.454985, 34.388138],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 483,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-16T17:30:40.096+09:00',
        rawGeo: [132.454985, 34.388138],
        candidateProbability: 0.69,
        topCandidateName: 'お好み焼き はぜや'
      }
    },
    {
      id: 'visit-12',
      dayNumber: 3,
      title: 'はぜや (廣島燒用餐)',
      placeName: 'はぜや 廣島燒內堂',
      placeCategory: '美食',
      startTime: '17:50',
      endTime: '18:10',
      durationMinutes: 20,
      coordinate: [132.452201, 34.392687],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 485,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-16T17:47:53.000+09:00',
        rawGeo: [132.452201, 34.392687],
        candidateProbability: 0.72,
        topCandidateName: 'お好み焼き はぜや'
      }
    },
    {
      id: 'visit-13',
      dayNumber: 3,
      title: '廣島超級酒店',
      placeName: '廣島天然溫泉超級酒店',
      placeCategory: '住宿',
      startTime: '18:20',
      endTime: '08:30',
      durationMinutes: 850,
      coordinate: [132.465982, 34.388284],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 487,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-16T18:16:02.229+09:00',
        rawGeo: [132.465982, 34.388284],
        candidateProbability: 0.88,
        topCandidateName: 'スーパーホテル広島'
      }
    },

    // --- Day 4 (8/17) ---
    {
      id: 'visit-14',
      dayNumber: 4,
      title: '山區公路休息點',
      placeName: '安芸高田公路休息站',
      placeCategory: '休歇',
      startTime: '11:50',
      endTime: '12:10',
      durationMinutes: 20,
      coordinate: [132.580608, 34.582064],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 489,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-17T11:49:06.218+09:00',
        rawGeo: [132.580608, 34.582064],
        candidateProbability: 0.65,
        topCandidateName: '道の駅 三矢の里あきたかた'
      }
    },
    {
      id: 'visit-15',
      dayNumber: 4,
      title: '三次市區休歇',
      placeName: '三次市交流中心',
      placeCategory: '休歇',
      startTime: '12:20',
      endTime: '13:30',
      durationMinutes: 70,
      coordinate: [132.673833, 34.647823],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      subVenues: [
        {
          title: '三次交流中心內部特產店',
          placeID: 'ChIJKdzUEVyGUDURCr6XKJM4RYA',
          hierarchyLevel: 1,
          durationMinutes: 41,
          flattenReason: 'HIERARCHY_LEVEL_1_NESTED_IN_LEVEL_0'
        }
      ],
      evidence: {
        sourceIndex: 491,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-17T12:20:04.177+09:00',
        rawGeo: [132.673833, 34.647823],
        candidateProbability: 0.73,
        topCandidateName: '三次市交流施設'
      }
    },
    {
      id: 'visit-16',
      dayNumber: 4,
      title: '公路中繼停靠',
      placeName: '國道 54 號線中繼加油休歇點',
      placeCategory: '休歇',
      startTime: '13:30',
      endTime: '13:50',
      durationMinutes: 20,
      coordinate: [132.676746, 34.650681],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 494,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-17T13:34:32.236+09:00',
        rawGeo: [132.676746, 34.650681],
        candidateProbability: 0.60,
        topCandidateName: '国道54号 休憩所'
      }
    },
    {
      id: 'visit-17',
      dayNumber: 4,
      title: '道之驛 奧出雲交流館',
      placeName: '道之驛 奧出雲交流館',
      placeCategory: '景點',
      startTime: '14:50',
      endTime: '15:20',
      durationMinutes: 30,
      coordinate: [132.830135, 35.166989],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      subVenues: [
        {
          title: '內部酒藏交流特產店',
          placeID: 'ChIJ3QhqSTZKVzURLH5aMl64vG8',
          hierarchyLevel: 1,
          durationMinutes: 28,
          flattenReason: 'SAME_OR_NEAR_TIMESTAMP_CLASH_0S'
        }
      ],
      evidence: {
        sourceIndex: 496,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-17T14:54:28.277+09:00',
        rawGeo: [132.830135, 35.166989],
        candidateProbability: 0.94,
        topCandidateName: '道の駅 酒蔵奥出雲交流館'
      }
    },
    {
      id: 'visit-18',
      dayNumber: 4,
      title: '松江 Universal Hotel (報到)',
      placeName: '松江 Universal Hotel 本館',
      placeCategory: '住宿',
      startTime: '16:20',
      endTime: '18:10',
      durationMinutes: 110,
      coordinate: [133.062605, 35.463204],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 499,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-17T16:19:39.258+09:00',
        rawGeo: [133.062605, 35.463204],
        candidateProbability: 0.87,
        topCandidateName: '松江ユニバーサルホテル'
      }
    },
    {
      id: 'visit-19',
      dayNumber: 4,
      title: '松江市區夜間住宿',
      placeName: '松江 Universal Hotel',
      placeCategory: '住宿',
      startTime: '18:20',
      endTime: '08:10',
      durationMinutes: 830,
      coordinate: [133.069376, 35.463685],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 501,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-17T18:23:11.999+09:00',
        rawGeo: [133.069376, 35.463685],
        candidateProbability: 0.85,
        topCandidateName: '松江ユニバーサルホテル'
      }
    },

    // --- Day 5 (8/18) ---
    {
      id: 'visit-20',
      dayNumber: 5,
      title: '出雲市區停留',
      placeName: '出雲大社參道前駐留區',
      placeCategory: '景點',
      startTime: '09:20',
      endTime: '11:50',
      durationMinutes: 150,
      coordinate: [132.748663, 35.396882],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 503,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-18T09:21:25.247+09:00',
        rawGeo: [132.748663, 35.396882],
        candidateProbability: 0.76,
        topCandidateName: '出雲大社周辺'
      }
    },
    {
      id: 'visit-21',
      dayNumber: 5,
      title: '出雲大社神門通商店街',
      placeName: '神門通美食商店街',
      placeCategory: '美食',
      startTime: '11:50',
      endTime: '12:10',
      durationMinutes: 20,
      coordinate: [132.686374, 35.396705],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 505,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-18T11:51:50.999+09:00',
        rawGeo: [132.686374, 35.396705],
        candidateProbability: 0.88,
        topCandidateName: '出雲大社 神門通り'
      }
    },
    {
      id: 'visit-22',
      dayNumber: 5,
      title: '松江城 (國寶天守)',
      placeName: '松江城天守閣',
      placeCategory: '景點',
      startTime: '16:00',
      endTime: '16:30',
      durationMinutes: 30,
      coordinate: [133.050379, 35.475734],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 507,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-18T16:00:16.999+09:00',
        rawGeo: [133.050379, 35.475734],
        candidateProbability: 0.95,
        topCandidateName: '国宝 松江城'
      }
    },
    {
      id: 'visit-23',
      dayNumber: 5,
      title: '松江城下町散策',
      placeName: '鹽見繩手 武家屋敷通',
      placeCategory: '休歇',
      startTime: '16:30',
      endTime: '18:10',
      durationMinutes: 100,
      coordinate: [133.059350, 35.469390],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [
        {
          id: 'issue-visit-23-time',
          type: 'time',
          severity: 'required',
          message: '散策結束時間 (18:10) 與後續松江車站抵達 (18:06) 存在 4 分鐘交錯重疊',
          recommendation: '建議調整結束時間為 18:00'
        }
      ],
      evidence: {
        sourceIndex: 509,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-18T16:31:38.197+09:00',
        rawGeo: [133.059350, 35.469390],
        candidateProbability: 0.74,
        topCandidateName: '塩見縄手'
      }
    },
    {
      id: 'visit-24',
      dayNumber: 5,
      title: 'JR 松江車站',
      placeName: 'JR 松江車站商場',
      placeCategory: '購物',
      startTime: '18:10',
      endTime: '19:00',
      durationMinutes: 50,
      coordinate: [133.069376, 35.463685],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      subVenues: [
        {
          title: '站內 Shamine 松江商場店鋪',
          placeID: 'ChIJTX2sRPAEVzURxIHtTShTUJg',
          hierarchyLevel: 1,
          durationMinutes: 52,
          flattenReason: 'SAME_OR_NEAR_TIMESTAMP_CLASH_0S'
        }
      ],
      evidence: {
        sourceIndex: 510,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-18T18:06:36.791+09:00',
        rawGeo: [133.069376, 35.463685],
        candidateProbability: 0.86,
        topCandidateName: 'JR 松江駅'
      }
    },
    {
      id: 'visit-25',
      dayNumber: 5,
      title: '松江 Universal Hotel (連泊)',
      placeName: '松江 Universal Hotel 本館',
      placeCategory: '住宿',
      startTime: '19:50',
      endTime: '08:50',
      durationMinutes: 780,
      coordinate: [133.062605, 35.463204],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 513,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-18T19:48:16.965+09:00',
        rawGeo: [133.062605, 35.463204],
        candidateProbability: 0.91,
        topCandidateName: '松江ユニバーサルホテル'
      }
    },

    // --- Day 6 (8/19) ---
    {
      id: 'visit-26',
      dayNumber: 6,
      title: '境港海鮮市場周邊',
      placeName: '水木茂大道 & 境港海鮮市場',
      placeCategory: '景點',
      startTime: '09:50',
      endTime: '10:10',
      durationMinutes: 20,
      coordinate: [133.306437, 35.562282],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 515,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-19T09:45:54.269+09:00',
        rawGeo: [133.306437, 35.562282],
        candidateProbability: 0.82,
        topCandidateName: '境港水木しげるロード'
      }
    },
    {
      id: 'visit-27',
      dayNumber: 6,
      title: '山陽公路休息區 (返程)',
      placeName: '吉備服務區 (SA)',
      placeCategory: '休歇',
      startTime: '14:50',
      endTime: '16:00',
      durationMinutes: 70,
      coordinate: [133.875517, 34.699869],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 517,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-19T14:45:19.259+09:00',
        rawGeo: [133.875517, 34.699869],
        candidateProbability: 0.79,
        topCandidateName: '吉備SA 下り'
      }
    },
    {
      id: 'visit-28',
      dayNumber: 6,
      title: '岡山站前短暫停靠',
      placeName: '岡山車站西口接送區',
      placeCategory: '交通',
      startTime: '17:00',
      endTime: '17:10',
      durationMinutes: 10,
      coordinate: [133.910332, 34.670554],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 519,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-19T17:03:02.258+09:00',
        rawGeo: [133.910332, 34.670554],
        candidateProbability: 0.68,
        topCandidateName: '岡山駅西口'
      }
    },
    {
      id: 'visit-29',
      dayNumber: 6,
      title: '東橫INN 岡山站西口右',
      placeName: '東橫INN 岡山站西口右',
      placeCategory: '住宿',
      startTime: '17:10',
      endTime: '09:20',
      durationMinutes: 970,
      coordinate: [133.916076, 34.666512],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 521,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-19T17:13:36.215+09:00',
        rawGeo: [133.916076, 34.666512],
        candidateProbability: 0.94,
        topCandidateName: '東横INN岡山駅西口右'
      }
    },

    // --- Day 7 (8/20) ---
    {
      id: 'visit-30',
      dayNumber: 7,
      title: '岡山桃太郎機場 (回程出境)',
      placeName: '岡山桃太郎機場',
      placeCategory: '交通',
      startTime: '10:00',
      endTime: '13:00',
      durationMinutes: 180,
      coordinate: [133.855210, 34.757820],
      reviewStatus: 'pending',
      visibility: 'public',
      issues: [],
      evidence: {
        sourceIndex: 523,
        hierarchyLevel: 0,
        rawTimestamp: '2026-08-20T10:05:00.000+09:00',
        rawGeo: [133.855210, 34.757820],
        candidateProbability: 0.98,
        topCandidateName: '岡山桃太郎空港'
      }
    }
  ]
};
