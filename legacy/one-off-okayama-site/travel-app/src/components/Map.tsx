import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Location } from '../types';
import { getBadgeColor } from './LocationCard';

// Fix Leaflet's default icon path issues in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapProps {
  locations: Location[];
}

function ChangeView({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [bounds, map]);
  return null;
}

export function Map({ locations }: MapProps) {
  const bounds = locations.length > 0 
    ? L.latLngBounds(locations.map(l => [l.lat, l.lng]))
    : null;

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200 mb-8 h-[400px] md:h-[480px]">
      <MapContainer 
        center={[34.8, 133.2]} 
        zoom={8} 
        scrollWheelZoom={false} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {locations.map((loc, idx) => (
          <Marker key={loc.id || idx} position={[loc.lat, loc.lng]}>
            <Popup>
              <div className="font-sans">
                <span className={`inline-block px-2 py-0.5 rounded text-white text-xs mb-1 ${getBadgeColor(loc.cat)}`}>
                  {loc.cat}
                </span>
                <h4 className="font-bold text-sm mb-1">{loc.title}</h4>
                <p className="text-xs text-gray-600 mb-2">{loc.note}</p>
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.jp || loc.title)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#2b5c8f] hover:underline"
                >
                  開啟 Google 地圖 ➔
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
        <ChangeView bounds={bounds} />
      </MapContainer>
    </div>
  );
}
