import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { Map } from './components/Map';
import { LocationCard } from './components/LocationCard';
import { ReviewModal } from './components/ReviewModal';
import type { Location } from './types';
import { initialLocations } from './data/initialLocations';
import { auth, db } from './lib/firebase';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, addDoc } from 'firebase/firestore';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [currentDay, setCurrentDay] = useState('all');
  const [currentCat, setCurrentCat] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'locations'));
        if (querySnapshot.empty) {
          // If Firestore is empty, fallback to static data temporarily
          console.log("No data in Firestore, showing static data");
          setLocations(initialLocations as Location[]);
        } else {
          const locs: Location[] = [];
          querySnapshot.forEach((doc) => {
            locs.push({ id: doc.id, ...doc.data() } as Location);
          });
          // Sort by day and title or any preferred order
          setLocations(locs);
        }
      } catch (e) {
        console.error("Error fetching locations", e);
        setLocations(initialLocations as Location[]);
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
  }, []);

  const handleMigrateData = async () => {
    if (!window.confirm("確定要將 34 個靜態景點匯入 Firebase 嗎？這通常只需執行一次。")) return;
    try {
      for (const loc of initialLocations) {
        await addDoc(collection(db, 'locations'), loc);
      }
      alert("匯入成功！請重整網頁。");
    } catch (e) {
      console.error("Migration failed", e);
      alert("匯入失敗");
    }
  };

  const filteredLocations = locations.filter(loc => {
    const dayMatch = currentDay === 'all' || loc.day === currentDay;
    const catMatch = currentCat === 'all' || loc.cat === currentCat;
    return dayMatch && catMatch;
  });

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans">
      <Header user={user} />

      <main className="max-w-6xl mx-auto p-4 md:p-6">
        
        {/* Hidden Migration Button for Admin */}
        {locations.length > 0 && !locations[0].id && (
          <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg flex justify-between items-center shadow-sm">
            <span className="text-sm text-yellow-800 font-medium">⚠️ 尚未進行資料轉移，目前無法留言與上傳照片。</span>
            <button onClick={handleMigrateData} className="bg-yellow-400 text-yellow-900 px-4 py-2 rounded text-sm font-bold hover:bg-yellow-500 transition-colors shadow-sm">
              立即執行資料轉移
            </button>
          </div>
        )}

        <Map locations={filteredLocations} />
        
        <FilterBar 
          currentDay={currentDay} 
          currentCat={currentCat} 
          onDayChange={setCurrentDay} 
          onCatChange={setCurrentCat} 
        />

        {loading ? (
          <div className="text-center py-20 text-gray-500">載入中...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLocations.map((loc, idx) => (
              <LocationCard 
                key={loc.id || idx} 
                location={loc} 
                onClick={setSelectedLocation} 
              />
            ))}
          </div>
        )}

        {/* Tips Section */}
        <div className="bg-[#fff8f6] border-l-4 border-[#e06d53] p-6 rounded-r-xl mt-10 shadow-sm">
            <h3 className="text-[#e06d53] text-lg font-bold mb-3 flex items-center gap-2">
              🚗 行程關鍵提醒與自駕小撇步
            </h3>
            <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                <li><b>8/15 (金刀比羅宮)</b>：建議上午 09:00 前抵達爬階梯（共785階），天氣較不炎熱。下午順遊倉敷美觀地區。</li>
                <li><b>8/16 (尾道至廣島)</b>：早起逛千光寺與尾道老街，下午直奔廣島。皮克敏活動點多集中於廣島本通商店街（PARCO周邊）。</li>
                <li><b>8/17 (移動日與宮島潮汐)</b>：嚴島神社安排在上午造訪（大潮期間可看漂浮鳥居，乾潮時可直接走近鳥居）。之後北上經高速公路至松江城，建議雙司機輪替開車。皮克敏專區（宮島SA）平日營業至 18:00，建議 16:30 前抵達。</li>
                <li><b>8/19 (山陰迴歸)</b>：境港海鮮市場中午享用海鮮，飯後開車至鳥取砂丘（約1小時），行經山陽/鳥取自動車道免費段返還岡山。</li>
            </ul>
        </div>
      </main>

      <footer className="text-center p-8 text-gray-500 text-sm mt-8 border-t border-gray-200">
        <p>2026 夏遊岡山・四國・山陰 旅遊地圖 | 點擊卡片可查看/上傳照片與心得</p>
      </footer>

      {selectedLocation && (
        <ReviewModal 
          location={selectedLocation} 
          onClose={() => setSelectedLocation(null)} 
          user={user} 
        />
      )}
    </div>
  );
}

export default App;
