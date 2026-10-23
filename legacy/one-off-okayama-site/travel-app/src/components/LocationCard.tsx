import type { Location } from '../types';
import { MessageSquare, MapPin } from 'lucide-react';

interface LocationCardProps {
  location: Location;
  onClick: (loc: Location) => void;
}

export function getBadgeColor(cat: string) {
  switch(cat) {
      case '景點': return 'bg-blue-500';
      case '美食': return 'bg-orange-500';
      case '住宿': return 'bg-purple-500';
      case '交通': return 'bg-cyan-500';
      case '停車': return 'bg-slate-500';
      case '購物': return 'bg-emerald-500';
      default: return 'bg-blue-500';
  }
}

export function LocationCard({ location, onClick }: LocationCardProps) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.jp || location.title)}`;

  return (
    <div 
      className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 hover:-translate-y-1 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
      onClick={() => onClick(location)}
    >
      <div>
        <div className="flex justify-between items-start mb-3">
          <span className="text-xs font-bold text-[#2b5c8f] bg-[#eef4fb] px-2 py-1 rounded-md">
            {location.day}
          </span>
          <span className={`text-xs font-medium text-white px-2.5 py-1 rounded-full ${getBadgeColor(location.cat)}`}>
            {location.cat}
          </span>
        </div>
        <h3 className="text-lg font-bold mb-1">{location.title}</h3>
        <div className="text-xs text-gray-500 mb-2">{location.jp}</div>
        <p className="text-sm text-gray-700 mb-4">{location.note}</p>
      </div>
      
      <div className="flex justify-between items-center border-t border-gray-100 pt-3 mt-auto">
        <a 
          href={mapsUrl} 
          target="_blank" 
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()} // Prevent opening modal when clicking maps link
          className="inline-flex items-center gap-1 text-[#2b5c8f] text-sm font-medium hover:text-[#e06d53] transition-colors"
        >
          <MapPin size={14} /> Google 導航
        </a>
        <button 
          className="inline-flex items-center gap-1 text-gray-500 hover:text-[#2b5c8f] text-sm transition-colors"
        >
          <MessageSquare size={14} /> 照片/心得
        </button>
      </div>
    </div>
  );
}
