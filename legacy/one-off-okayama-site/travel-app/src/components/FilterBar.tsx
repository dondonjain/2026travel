

interface FilterBarProps {
  currentDay: string;
  currentCat: string;
  onDayChange: (day: string) => void;
  onCatChange: (cat: string) => void;
}

export function FilterBar({ currentDay, currentCat, onDayChange, onCatChange }: FilterBarProps) {
  const days = ['all', 'Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
  const categories = [
    { id: 'all', label: '全部分類' },
    { id: '景點', label: '🏯 景點' },
    { id: '美食', label: '🍜 美食' },
    { id: '住宿', label: '🏨 住宿' },
    { id: '停車', label: '🅿️ 停車' },
    { id: '交通', label: '✈️ 交通' },
    { id: '購物', label: '🛍️ 購物' },
  ];

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 mb-6">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="font-bold text-[#2b5c8f] min-w-[60px]">日期：</span>
        {days.map(day => (
          <button
            key={day}
            onClick={() => onDayChange(day)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              currentDay === day 
                ? 'bg-[#2b5c8f] text-white border-[#2b5c8f]' 
                : 'bg-[#eef2f7] text-gray-700 border-transparent hover:bg-gray-200'
            }`}
          >
            {day === 'all' ? '全部天數' : day}
          </button>
        ))}
      </div>
      
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-[#2b5c8f] min-w-[60px]">類別：</span>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => onCatChange(cat.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              currentCat === cat.id 
                ? 'bg-[#2b5c8f] text-white border-[#2b5c8f]' 
                : 'bg-[#eef2f7] text-gray-700 border-transparent hover:bg-gray-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
}
