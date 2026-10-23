"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Map, { Marker, MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  MapPin,
  Navigation,
  Compass,
  Maximize2,
  Minimize2,
  Layers,
  Sparkles
} from 'lucide-react';
import { CMSVisit } from '@/lib/cms/types';

interface ContextualMapProps {
  visit: CMSVisit | null;
  visits?: CMSVisit[];
  onSelectVisit?: (visitId: string) => void;
  className?: string;
  centerTrigger?: number;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function ContextualMap({
  visit,
  visits = [],
  onSelectVisit,
  className = '',
  centerTrigger = 0
}: ContextualMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [pulseActive, setPulseActive] = useState(false);

  // Active coordinate (fallback to Okayama center if null)
  const activeCoord: [number, number] = useMemo(() => {
    if (visit?.coordinate) return visit.coordinate;
    if (visits.length > 0 && visits[0].coordinate) return visits[0].coordinate;
    return [133.917733, 34.666121];
  }, [visit, visits]);

  // Fly to coordinate and fire pulse feedback when active visit changes or centerTrigger fires
  useEffect(() => {
    if (mapRef.current && activeCoord) {
      mapRef.current.flyTo({
        center: activeCoord,
        zoom: 14.5,
        duration: 800
      });
    }

    // Trigger visual feedback pulse
    setPulseActive(true);
    const timer = setTimeout(() => {
      setPulseActive(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, [activeCoord, centerTrigger]);

  // SVG Fallback Canvas calculation: map coordinates to 2D viewbox
  const svgData = useMemo(() => {
    const validVisits = visits.filter(v => v.coordinate !== null);
    if (validVisits.length === 0) return null;

    const lngs = validVisits.map(v => v.coordinate![0]);
    const lats = validVisits.map(v => v.coordinate![1]);

    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    const pad = 40;
    const width = 600;
    const height = 400;

    const scaleX = (lng: number) => {
      if (maxLng === minLng) return width / 2;
      return pad + ((lng - minLng) / (maxLng - minLng)) * (width - pad * 2);
    };

    const scaleY = (lat: number) => {
      if (maxLat === minLat) return height / 2;
      // Latitude is inverted in SVG y-coords
      return height - (pad + ((lat - minLat) / (maxLat - minLat)) * (height - pad * 2));
    };

    const points = validVisits.map(v => ({
      visit: v,
      x: scaleX(v.coordinate![0]),
      y: scaleY(v.coordinate![1]),
      isActive: v.id === visit?.id
    }));

    const pathD = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');

    return { points, pathD, width, height };
  }, [visits, visit]);

  const mapContent = (
    <div className={`relative w-full h-full flex flex-col bg-slate-900 text-white overflow-hidden select-none ${className}`}>
      {/* Top Map Chrome / Status Bar */}
      <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900/85 backdrop-blur-md border border-white/10 text-xs shadow-md pointer-events-auto">
          <Compass className="w-3.5 h-3.5 text-blue-400 animate-spin-slow" />
          <span className="font-semibold text-zinc-200">
            {visit ? visit.title : '空間脈絡總覽'}
          </span>
          {visit?.coordinate && (
            <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">
              [{visit.coordinate[1].toFixed(4)}, {visit.coordinate[0].toFixed(4)}]
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsFullScreen(!isFullScreen)}
          className="p-1.5 rounded-lg bg-zinc-900/85 hover:bg-zinc-800 backdrop-blur-md border border-white/10 text-zinc-300 hover:text-white transition-colors shadow-md cursor-pointer pointer-events-auto"
          title={isFullScreen ? '退出全螢幕地圖' : '放大全螢幕檢視'}
        >
          {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Map Surface */}
      <div className="flex-1 w-full h-full relative">
        {MAPBOX_TOKEN ? (
          <Map
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={{
              longitude: activeCoord[0],
              latitude: activeCoord[1],
              zoom: 13.5
            }}
            mapStyle="mapbox://styles/mapbox/dark-v11"
            style={{ width: '100%', height: '100%' }}
          >
            {visits.map((v, i) => {
              if (!v.coordinate) return null;
              const isSelected = v.id === visit?.id;
              return (
                <Marker
                  key={v.id}
                  longitude={v.coordinate[0]}
                  latitude={v.coordinate[1]}
                  anchor="bottom"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    if (onSelectVisit) onSelectVisit(v.id);
                  }}
                >
                  <div className="flex flex-col items-center group cursor-pointer">
                    {isSelected && (
                      <div className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-md shadow-lg mb-1 whitespace-nowrap animate-in fade-in">
                        {v.title}
                      </div>
                    )}
                    <div
                      className={`rounded-full flex items-center justify-center font-bold text-[10px] transition-transform ${
                        isSelected
                          ? 'w-7 h-7 bg-blue-500 border-2 border-white shadow-blue-500/50 shadow-lg scale-110 text-white'
                          : 'w-5 h-5 bg-zinc-800/90 border border-white/40 text-zinc-300 hover:scale-125'
                      }`}
                    >
                      {i + 1}
                    </div>
                  </div>
                </Marker>
              );
            })}
          </Map>
        ) : (
          /* High-Fidelity SVG Spatial Topology View when Mapbox token is not set */
          <div className="w-full h-full relative flex items-center justify-center bg-radial from-slate-900 to-zinc-950 p-2">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 opacity-15 bg-[linear-gradient(to_right,#38bdf815_1px,transparent_1px),linear-gradient(to_bottom,#38bdf815_1px,transparent_1px)] bg-[size:24px_24px]" />

            {svgData ? (
              <svg
                viewBox={`0 0 ${svgData.width} ${svgData.height}`}
                className="w-full h-full max-h-[92%] object-contain relative z-0"
              >
                {/* Route Path Line */}
                <path
                  d={svgData.pathD}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeDasharray="4 4"
                  className="opacity-70"
                />

                {/* Waypoint Nodes */}
                {svgData.points.map((pt, idx) => (
                  <g
                    key={pt.visit.id}
                    className="cursor-pointer group"
                    onClick={() => onSelectVisit && onSelectVisit(pt.visit.id)}
                  >
                    {/* Pulsing halo if active */}
                    {pt.isActive && (
                      <>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={pulseActive ? 26 : 16}
                          fill="#38bdf8"
                          className={pulseActive ? 'animate-ping opacity-60' : 'animate-pulse opacity-30'}
                        />
                        {pulseActive && (
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={36}
                            fill="#38bdf8"
                            className="animate-ping opacity-30"
                          />
                        )}
                      </>
                    )}

                    {/* Outer circle */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={pt.isActive ? 11 : 7}
                      fill={pt.isActive ? '#0284c7' : '#1e293b'}
                      stroke={pt.isActive ? '#ffffff' : '#94a3b8'}
                      strokeWidth={pt.isActive ? 2.5 : 1.5}
                      className="transition-all duration-200 group-hover:scale-125"
                    />

                    {/* Index text */}
                    <text
                      x={pt.x}
                      y={pt.y + 3.5}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={pt.isActive ? '10' : '8'}
                      fontWeight="bold"
                      className="pointer-events-none select-none font-mono"
                    >
                      {idx + 1}
                    </text>

                    {/* Label */}
                    <text
                      x={pt.x}
                      y={pt.y - 13}
                      textAnchor="middle"
                      fill={pt.isActive ? '#38bdf8' : '#94a3b8'}
                      fontSize={pt.isActive ? '11' : '9'}
                      fontWeight={pt.isActive ? 'bold' : 'normal'}
                      className="pointer-events-none select-none drop-shadow-md"
                    >
                      {pt.visit.title}
                    </text>
                  </g>
                ))}
              </svg>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-4 text-zinc-500">
                <MapPin className="w-8 h-8 opacity-40 mb-2 text-blue-400" />
                <p className="text-xs">尚無足夠的坐標點可供地圖渲染</p>
              </div>
            )}

            {/* Bottom info banner */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] text-zinc-400 bg-zinc-950/80 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-white/5">
              <span>常駐空間畫布（已對齊當前造訪）</span>
              {visit && (
                <span className="font-semibold text-blue-400 truncate max-w-[140px]">
                  {visit.title} ({visit.startTime})
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // If Fullscreen is activated, render in a modal portal overlay
  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-6 animate-in fade-in">
        <div className="w-full h-full max-w-6xl rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
          {mapContent}
        </div>
      </div>
    );
  }

  // Default: Embedded directly in page layout
  return mapContent;
}
