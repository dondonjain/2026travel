import type { Location } from "../types";

export const initialLocations: Omit<Location, 'id'>[] = [
    // Day 1
    { day: "Day 1", title: "桃園國際機場", jp: "Taiwan Taoyuan International Airport", cat: "交通", lat: 25.0797, lng: 121.2342, note: "11:10 虎航起飛" },
    { day: "Day 1", title: "岡山桃太郎機場", jp: "Okayama Airport", cat: "交通", lat: 34.7570, lng: 133.8553, note: "14:35 抵達岡山，搭機場巴士前往岡山車站" },
    { day: "Day 1", title: "岡山車站", jp: "Okayama Station", cat: "交通", lat: 34.6664, lng: 133.9186, note: "交通與周邊商圈樞紐" },
    { day: "Day 1", title: "AEON MALL 岡山", jp: "AEON MALL Okayama", cat: "購物", lat: 34.6622, lng: 133.9175, note: "適合採買日常食品、飲料、零食與逛街" },
    { day: "Day 1", title: "麵屋匠 岡山站店", jp: "麵屋 匠 岡山駅", cat: "美食", lat: 34.6664, lng: 133.9186, note: "岡山車站內好吃拉麵與餃子" },
    { day: "Day 1", title: "東橫INN 岡山站西口右", jp: "Toyoko Inn Okayama-eki Nishi-guchi Migi", cat: "住宿", lat: 34.6680, lng: 133.9150, note: "Day 1 住宿" },

    // Day 2
    { day: "Day 2", title: "瀨戶大橋", jp: "Seto Ohashi Bridge", cat: "景點", lat: 34.3994, lng: 133.8080, note: "自駕行經瀨戶內海跨海大橋" },
    { day: "Day 2", title: "琴平町營停車場", jp: "琴平町営駐車場", cat: "停車", lat: 34.1932, lng: 133.8204, note: "導航至琴平町営駐車場或こんぴら参道駐車場" },
    { day: "Day 2", title: "金刀比羅宮", jp: "Kotohira-gu", cat: "景點", lat: 34.1932, lng: 133.8204, note: "參拜785階石階、逛表參道 (預留 2-3 小時)" },
    { day: "Day 2", title: "讚岐烏龍麵 (琴平町)", jp: "讃岐うどん 琴平", cat: "美食", lat: 34.1900, lng: 133.8180, note: "金刀比羅宮表參道周邊午餐推薦" },
    { day: "Day 2", title: "倉敷市中央停車場", jp: "倉敷市中央駐車場", cat: "停車", lat: 34.5940, lng: 133.7722, note: "倉敷美觀地區建議停車場" },
    { day: "Day 2", title: "倉敷美觀地區", jp: "Kurashiki Bikan Historical Quarter", cat: "景點", lat: 34.5959, lng: 133.7722, note: "下午漫步古色古香運河老街" },
    { day: "Day 2", title: "超級酒店 Inn 倉敷水島", jp: "Super Hotel Inn Kurashiki Mizushima", cat: "住宿", lat: 34.5320, lng: 133.7485, note: "Day 2 住宿 (含天然溫泉)" },

    // Day 3
    { day: "Day 3", title: "尾道市政廳 (頂樓展望台)", jp: "Onomichi City Hall", cat: "景點", lat: 34.4087, lng: 133.2050, note: "免費進入頂樓360度展望露台" },
    { day: "Day 3", title: "千光寺公園 / 千光寺", jp: "Senkoji Temple Onomichi", cat: "景點", lat: 34.4111, lng: 133.1970, note: "尾道經典景點，眺望港口美景" },
    { day: "Day 3", title: "尾道拉麵 谷 (たに)", jp: "Onomichi Ramen Tani", cat: "美食", lat: 34.4053, lng: 133.1930, note: "JR尾道站1樓極方便，清爽甘甜湯頭" },
    { day: "Day 3", title: "尾道拉麵 喰海", jp: "Onomichi Ramen Kuukai", cat: "美食", lat: 34.4053, lng: 133.1945, note: "海岸線旁，知名鹽味檸檬拉麵" },
    { day: "Day 3", title: "廣島和平紀念公園 / 原爆圓頂館", jp: "Hiroshima Peace Memorial Park", cat: "景點", lat: 34.3955, lng: 132.4536, note: "廣島歷史地標公園 (導航：平和公園駐車場)" },
    { day: "Day 3", title: "はぜや (Hazeya 廣島燒)", jp: "Hazeya Hiroshima", cat: "美食", lat: 34.3910, lng: 132.4550, note: "和平公園步行7分鐘在地隱藏版廣島燒名店" },
    { day: "Day 3", title: "廣島本通商店街 (PARCO)", jp: "Hiroshima Hondori Shotengai", cat: "景點", lat: 34.3920, lng: 132.4590, note: "廣島熱鬧商店街，皮克敏活動點多集中於此" },
    { day: "Day 3", title: "廣島超級酒店", jp: "Super Hotel Hiroshima", cat: "住宿", lat: 34.3892, lng: 132.4690, note: "Day 3 住宿" },

    // Day 4
    { day: "Day 4", title: "宮島口停車場", jp: "Miyajimaguchi Parking Lot", cat: "停車", lat: 34.3120, lng: 132.3020, note: "搭乘渡輪前往宮島之停車場" },
    { day: "Day 4", title: "嚴島神社 / 海上大鳥居", jp: "Itsukushima Shrine", cat: "景點", lat: 34.2960, lng: 132.3198, note: "清晨遊客少，漲潮看漂浮鳥居、乾潮可走近鳥居" },
    { day: "Day 4", title: "皮克敏露臺 宮島SA (下行)", jp: "Miyajima SA Downbound", cat: "景點", lat: 34.3315, lng: 132.3020, note: "高速公路休息站皮克敏公園專區" },
    { day: "Day 4", title: "松江城", jp: "Matsue Castle", cat: "景點", lat: 35.4753, lng: 133.0506, note: "日本國寶12現存天守之一" },
    { day: "Day 4", title: "松江 Universal Hotel", jp: "Matsue Universal Hotel", cat: "住宿", lat: 35.4637, lng: 133.0638, note: "Day 4 & Day 5 住宿 (兩連泊)" },

    // Day 5
    { day: "Day 5", title: "松江花鳥園", jp: "Matsue Vogel Park", cat: "景點", lat: 35.4800, lng: 132.9680, note: "一畑電車沿線溫室花卉與鳥類主題公園" },
    { day: "Day 5", title: "出雲大社神門通商店街", jp: "Shinmon Dori Izumo", cat: "美食", lat: 35.3980, lng: 132.6855, note: "神門通商店街午餐、知名出雲割子蕎麥麵" },
    { day: "Day 5", title: "出雲大社", jp: "Izumo Taisha", cat: "景點", lat: 35.4020, lng: 132.6855, note: "日本結緣名神社 (使用出雲大社免費駐車場)" },
    { day: "Day 5", title: "稻佐之濱", jp: "Inasa Beach", cat: "景點", lat: 35.3970, lng: 132.6710, note: "出雲大社附近神聖海灘，傍晚欣賞絕美日落" },

    // Day 6
    { day: "Day 6", title: "江島大橋", jp: "Eshima Ohashi Bridge", cat: "景點", lat: 35.5193, lng: 133.1818, note: "宛如雲霄飛車般陡峭的跨海大橋" },
    { day: "Day 6", title: "境港海鮮市場", jp: "Sakaiminato Seafood Market", cat: "美食", lat: 35.5475, lng: 133.2305, note: "高CP值海鮮午餐" },
    { day: "Day 6", title: "水木茂大道", jp: "Mizuki Shigeru Road", cat: "景點", lat: 35.5450, lng: 133.2300, note: "鬼太郎作者故鄉，170多尊妖怪青銅像快閃打卡" },
    { day: "Day 6", title: "鳥取砂丘", jp: "Tottori Sand Dunes", cat: "景點", lat: 35.5390, lng: 134.2325, note: "日本最大天然海岸砂丘壯麗景緻" },
    { day: "Day 6", title: "蒜山高原服務區 (SA)", jp: "Hiruzen Kogen SA", cat: "景點", lat: 35.3080, lng: 133.6840, note: "推薦蒜山濃郁牛奶霜淇淋/起司蛋糕" },
    { day: "Day 6", title: "東橫INN 岡山站東口", jp: "Toyoko Inn Okayama-eki Higashi-guchi", cat: "住宿", lat: 34.6675, lng: 133.9210, note: "Day 6 住宿 (岡山還車)" },

    // Day 7
    { day: "Day 7", title: "岡山後樂園", jp: "Okayama Korakuen Garden", cat: "景點", lat: 34.6670, lng: 133.9360, note: "日本三大名園之一 (08:00前往)" },
    { day: "Day 7", title: "岡山城", jp: "Okayama Castle", cat: "景點", lat: 34.6655, lng: 133.9360, note: "烏城 (10:00參觀)" }
];
