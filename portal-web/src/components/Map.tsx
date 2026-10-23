"use client";
/* eslint-disable react-hooks/set-state-in-effect -- playback transitions are timer-driven state-machine edges. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Layer, Marker, Source } from 'react-map-gl/mapbox';
import type { LayerProps, MapMouseEvent, MapRef } from 'react-map-gl/mapbox';
import { Image as ImageIcon, Pause, Play, Sparkles, Video, X } from 'lucide-react';
import MapboxLanguage from '@mapbox/mapbox-gl-language';
import 'mapbox-gl/dist/mapbox-gl.css';
import CruiseController from './CruiseController';
import OptimizedImage from './OptimizedImage';
import {
  buildNarrativePlaybackTimeline,
  getCruiseVisualDay,
  getMovementCameraAction,
  getRoutePartEndElapsedMs,
  getScopedNarrativePlaybackTimeline,
  interpolateNarrativeMovement,
  MVP_CAMERA,
  NARRATIVE_DWELL_FALLBACK_MS,
  REDACTION_GAP_TRANSITION_MS,
  shouldFollowMovementCamera,
  type NarrativeMovementMode,
  type PublicTrajectorySegment
} from '@/lib/narrative-playback';
import { getDaysSummary } from '@/lib/places';
import type { EnrichedPlace, MediaItem } from '@/types/itinerary';

type MappableEnrichedPlace = EnrichedPlace & { coordinates: [number, number] };
function hasCoordinates(place: EnrichedPlace): place is MappableEnrichedPlace { return place.coordinates !== null; }

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const lineLayer: LayerProps = { id: 'trajectory-line', type: 'line', paint: { 'line-color': '#3b82f6', 'line-width': 4, 'line-opacity': 0.8 } };
const pointLayer: LayerProps = { id: 'visit-node', type: 'circle', filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': 6, 'circle-color': '#ef4444', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } };
const clusterLayer: LayerProps = { id: 'clusters', type: 'circle', filter: ['has', 'point_count'], paint: { 'circle-color': '#ef4444', 'circle-radius': ['step', ['get', 'point_count'], 10, 5, 15, 10, 20], 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } };
const clusterCountLayer: LayerProps = { id: 'cluster-count', type: 'symbol', filter: ['has', 'point_count'], layout: { 'text-field': '{point_count_abbreviated}', 'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'], 'text-size': 10 }, paint: { 'text-color': '#ffffff' } };
type ExtendedMapMouseEvent = MapMouseEvent & { features?: Array<{ properties?: { visitId?: string }; layer: { id: string } }> };

export interface TrajectoryMapProps {
  places?: EnrichedPlace[];
  trajectorySegments?: PublicTrajectorySegment[];
  targetPlace?: EnrichedPlace | null;
  onClearTarget?: () => void;
  selectedDay?: number | 'all';
  onSelectDay?: (day: number | 'all') => void;
}

function MiniCarAvatar() { return <div className="w-7 h-12 rounded-[45%] bg-gradient-to-b from-red-400 via-red-600 to-red-900 border-2 border-red-950 shadow-xl before:block before:w-4 before:h-5 before:mx-auto before:mt-2 before:rounded-md before:bg-slate-800" />; }
function MiniPlaneAvatar() { return <div className="w-10 h-10 flex items-center justify-center text-2xl drop-shadow-xl">✈</div>; }
function MiniPositionAvatar() { return <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-lg" />; }
function avatarForMode(mode: NarrativeMovementMode) { return mode === 'plane' ? <MiniPlaneAvatar /> : mode === 'car' ? <MiniCarAvatar /> : <MiniPositionAvatar />; }

export default function TrajectoryMap({
  places = [], trajectorySegments = [], targetPlace, onClearTarget, selectedDay = 'all', onSelectDay
}: TrajectoryMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [popupPlace, setPopupPlace] = useState<MappableEnrichedPlace | null>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [isCruising, setIsCruising] = useState(false);
  const [isDwelling, setIsDwelling] = useState(false);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [isHoverPaused, setIsHoverPaused] = useState(false);
  const [isManualCruisePaused, setIsManualCruisePaused] = useState(false);
  const [cruiseStopIndex, setCruiseStopIndex] = useState(0);
  const [activeMovementIndex, setActiveMovementIndex] = useState(0);
  const [activePartIndex, setActivePartIndex] = useState(0);
  const [movementElapsedMs, setMovementElapsedMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGapTransition, setIsGapTransition] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const dwellPausedRef = useRef(false);
  const playingRef = useRef(false);
  const lastAnimationTimeRef = useRef(0);
  const previousSelectedDayRef = useRef(selectedDay);
  const framedMovementKeyRef = useRef<string | null>(null);

  const fullTimeline = useMemo(() => buildNarrativePlaybackTimeline(places, trajectorySegments), [places, trajectorySegments]);
  const allChronologicalPlaces = fullTimeline.visits;
  const timeline = useMemo(() => getScopedNarrativePlaybackTimeline(fullTimeline, selectedDay, trajectorySegments), [fullTimeline, selectedDay, trajectorySegments]);
  const chronologicalPlaces = timeline.visits;
  const daysSummary = useMemo(() => getDaysSummary(allChronologicalPlaces), [allChronologicalPlaces]);
  const activeMovement = timeline.movements[activeMovementIndex];
  const activeFrame = useMemo(() => !activeMovement || isGapTransition ? null : interpolateNarrativeMovement(activeMovement, activePartIndex, movementElapsedMs), [activeMovement, activePartIndex, isGapTransition, movementElapsedMs]);
  const activeVisitDwellMs = chronologicalPlaces[cruiseStopIndex]?.narrativeDwellMs ?? NARRATIVE_DWELL_FALLBACK_MS;
  const visualActiveDay = getCruiseVisualDay(selectedDay, isCruising, chronologicalPlaces[cruiseStopIndex]?.dayNumber);
  const visitSourceData = useMemo(() => ({ type: 'FeatureCollection' as const, features: allChronologicalPlaces.map((place) => ({ type: 'Feature' as const, properties: { visitId: place.id }, geometry: { type: 'Point' as const, coordinates: place.coordinates } })) }), [allChronologicalPlaces]);
  // Every rendered feature is an API-returned safe segment. They are never joined across a redaction gap.
  const progressiveLineData = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: timeline.movements.flatMap((movement, movementIndex) => movement.routeParts.flatMap((part, partIndex) => {
      if (movementIndex > activeMovementIndex || (movementIndex === activeMovementIndex && partIndex > activePartIndex)) return [];
      const coordinates = movementIndex === activeMovementIndex && partIndex === activePartIndex
        ? (isGapTransition ? part.coordinates : activeFrame?.visibleCoordinates)
        : part.coordinates;
      return coordinates && coordinates.length >= 2 ? [{ type: 'Feature' as const, properties: { segmentIndex: part.segmentIndex }, geometry: { type: 'LineString' as const, coordinates } }] : [];
    }))
  }), [activeFrame, activeMovementIndex, activePartIndex, isGapTransition, timeline.movements]);
  const getCameraPadding = useCallback(() => isMobile ? { left: 0, top: 70, right: 0, bottom: 200 } : { left: 360, top: 0, right: 0, bottom: 0 }, [isMobile]);
  const activateSpot = useCallback((place: MappableEnrichedPlace) => {
    setPopupPlace(place); setActiveMediaIndex(0); setIsSheetExpanded(false);
    mapRef.current?.easeTo({ center: place.coordinates, zoom: MVP_CAMERA.focus.zoom, pitch: MVP_CAMERA.focus.pitch, padding: getCameraPadding(), duration: MVP_CAMERA.focus.durationMs });
  }, [getCameraPadding]);
  const arriveAtStop = useCallback((stopIndex: number) => {
    const place = chronologicalPlaces[Math.min(stopIndex, chronologicalPlaces.length - 1)];
    if (!place) { setIsCruising(false); setIsPlaying(false); return; }
    framedMovementKeyRef.current = null;
    setCruiseStopIndex(Math.min(stopIndex, chronologicalPlaces.length - 1)); setIsPlaying(false); setIsDwelling(true); setDwellProgress(0); activateSpot(place);
  }, [activateSpot, chronologicalPlaces]);
  const startNextMovement = useCallback(() => {
    const nextIndex = Math.max(activeMovementIndex, cruiseStopIndex);
    if (nextIndex >= timeline.movements.length) {
      if (cruiseStopIndex < chronologicalPlaces.length - 1) {
        // A published Visit may have no corresponding public line.  Advance only
        // to its already-public location; do not invent a route or an avatar.
        arriveAtStop(cruiseStopIndex + 1);
        return;
      }
      setIsCruising(false); setIsPlaying(false); setIsDwelling(false); return;
    }
    setActiveMovementIndex(nextIndex); setActivePartIndex(0); setMovementElapsedMs(0); setIsDwelling(false); setDwellProgress(0); setIsHoverPaused(false); setIsManualCruisePaused(false); setIsGapTransition(false); setIsPlaying(true);
  }, [activeMovementIndex, arriveAtStop, chronologicalPlaces.length, cruiseStopIndex, timeline.movements.length]);

  useEffect(() => { dwellPausedRef.current = isHoverPaused || isManualCruisePaused; }, [isHoverPaused, isManualCruisePaused]);
  useEffect(() => { playingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { const checkMobile = () => setIsMobile(window.innerWidth < 640); checkMobile(); window.addEventListener('resize', checkMobile); return () => window.removeEventListener('resize', checkMobile); }, []);
  useEffect(() => { framedMovementKeyRef.current = null; setCruiseStopIndex(0); setActiveMovementIndex(0); setActivePartIndex(0); setMovementElapsedMs(0); setIsPlaying(false); setIsDwelling(false); setDwellProgress(0); setIsGapTransition(false); setIsHoverPaused(false); setIsManualCruisePaused(false); }, [selectedDay, timeline.movements.length]);
  useEffect(() => {
    const dayScopeChanged = previousSelectedDayRef.current !== selectedDay;
    previousSelectedDayRef.current = selectedDay;
    if (!dayScopeChanged) return;
    const firstScopedPlace = chronologicalPlaces[0];
    if (firstScopedPlace) activateSpot(firstScopedPlace);
    else setPopupPlace(null);
  }, [activateSpot, chronologicalPlaces, selectedDay]);
  useEffect(() => {
    if (!isCruising || !isDwelling) { setDwellProgress(0); return; }
    const interval = window.setInterval(() => { if (!dwellPausedRef.current) setDwellProgress((previous) => Math.min(100, previous + 100 / (activeVisitDwellMs / 100))); }, 100);
    return () => window.clearInterval(interval);
  }, [activeVisitDwellMs, isCruising, isDwelling]);
  useEffect(() => { if (dwellProgress >= 100 && isDwelling) startNextMovement(); }, [dwellProgress, isDwelling, startNextMovement]);
  useEffect(() => {
    if (!isPlaying || isDwelling || isGapTransition || !activeMovement) return;
    let frameId = 0;
    const tick = (now: number) => { if (!lastAnimationTimeRef.current) lastAnimationTimeRef.current = now; const delta = now - lastAnimationTimeRef.current; lastAnimationTimeRef.current = now; if (playingRef.current) setMovementElapsedMs((previous) => Math.min(activeMovement.durationMs, previous + delta)); frameId = window.requestAnimationFrame(tick); };
    frameId = window.requestAnimationFrame(tick);
    return () => { window.cancelAnimationFrame(frameId); lastAnimationTimeRef.current = 0; };
  }, [activeMovement, isDwelling, isGapTransition, isPlaying]);
  useEffect(() => {
    if (!activeMovement) return;
    const activePart = activeMovement.routeParts[activePartIndex];
    const nextPart = activeMovement.routeParts[activePartIndex + 1];
    if (activePart && nextPart && movementElapsedMs >= getRoutePartEndElapsedMs(activeMovement, activePartIndex)) {
      if (!activePart.hasHiddenGapAfter) { setActivePartIndex((index) => index + 1); return; }
      const nextPosition = nextPart.coordinates[0];
      framedMovementKeyRef.current = null;
      setIsGapTransition(true); setIsPlaying(false);
      if (nextPosition) mapRef.current?.easeTo({ center: nextPosition, zoom: 8, pitch: 20, padding: getCameraPadding(), duration: REDACTION_GAP_TRANSITION_MS });
      return;
    }
    if (movementElapsedMs >= activeMovement.durationMs) arriveAtStop(activeMovementIndex + 1);
  }, [activeMovement, activeMovementIndex, activePartIndex, arriveAtStop, getCameraPadding, movementElapsedMs]);
  useEffect(() => {
    if (!isGapTransition) return;
    const timeout = window.setTimeout(() => { setActivePartIndex((index) => index + 1); setIsGapTransition(false); setIsPlaying(true); }, REDACTION_GAP_TRANSITION_MS);
    return () => window.clearTimeout(timeout);
  }, [isGapTransition]);
  useEffect(() => {
    if (!activeFrame?.position || !activeMovement || !shouldFollowMovementCamera(isPlaying, isDwelling, isGapTransition, movementElapsedMs, activeMovement.durationMs)) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const action = getMovementCameraAction(activeMovement, activeFrame.position, true, framedMovementKeyRef.current, map.isEasing());
    if (action?.kind === 'frame') {
      framedMovementKeyRef.current = action.movementKey;
      map.easeTo({ center: action.center, zoom: action.framing.zoom, pitch: action.framing.pitch, duration: action.framing.durationMs, easing: (t: number) => t * (2 - t) });
    } else if (action?.kind === 'follow') {
      map.setCenter(action.center);
    }
  }, [activeFrame, activeMovement, isGapTransition, isPlaying, isDwelling, movementElapsedMs]);
  useEffect(() => {
    if (!targetPlace) return;
    if (!hasCoordinates(targetPlace)) { onClearTarget?.(); return; }
    framedMovementKeyRef.current = null; setIsCruising(false); setIsPlaying(false); setIsDwelling(false); setPopupPlace(targetPlace); setActiveMediaIndex(0); setIsSheetExpanded(false);
    mapRef.current?.flyTo({ center: targetPlace.coordinates, zoom: MVP_CAMERA.cardTarget.zoom, pitch: MVP_CAMERA.cardTarget.pitch, padding: getCameraPadding(), duration: MVP_CAMERA.cardTarget.durationMs, essential: true });
    onClearTarget?.();
  }, [getCameraPadding, onClearTarget, targetPlace]);

  const handleStartCruise = useCallback(() => {
    if (!chronologicalPlaces.length) return;
    framedMovementKeyRef.current = null; setIsCruising(true); setIsPlaying(false); setIsGapTransition(false); setActiveMovementIndex(0); setActivePartIndex(0); setMovementElapsedMs(0); setCruiseStopIndex(0); setIsDwelling(true); setDwellProgress(0); activateSpot(chronologicalPlaces[0]);
  }, [activateSpot, chronologicalPlaces]);
  const handlePauseResumeCruise = useCallback(() => { if (isDwelling) setIsManualCruisePaused((paused) => !paused); else setIsPlaying((playing) => !playing); }, [isDwelling]);
  const selectCruiseStop = useCallback((next: number) => {
    const place = chronologicalPlaces[next]; if (!place || next === cruiseStopIndex) return;
    setIsPlaying(false); setIsGapTransition(false); setIsDwelling(true); setDwellProgress(0); setCruiseStopIndex(next); setActiveMovementIndex(Math.min(next, Math.max(0, timeline.movements.length - 1))); setActivePartIndex(0); setMovementElapsedMs(0); activateSpot(place);
  }, [activateSpot, chronologicalPlaces, cruiseStopIndex, timeline.movements.length]);
  const handleExitCruise = useCallback(() => { framedMovementKeyRef.current = null; setIsCruising(false); setIsPlaying(false); setIsDwelling(false); setDwellProgress(0); setIsGapTransition(false); }, []);
  const onMapLoad = (event: { target: { addControl: (control: MapboxLanguage) => void } }) => { event.target.addControl(new MapboxLanguage({ defaultLanguage: 'zh-Hant' })); };
  const onClick = (event: MapMouseEvent) => {
    const typedEvent = event as ExtendedMapMouseEvent;
    const feature = typedEvent.features?.[0]; if (feature?.layer.id !== 'visit-node' || !feature.properties?.visitId) return;
    const place = allChronologicalPlaces.find((candidate) => candidate.id === feature.properties?.visitId); if (!place) return;
    if (isCruising) { setIsPlaying(false); setIsManualCruisePaused(true); } activateSpot(place);
  };
  const popupMedia: MediaItem | undefined = popupPlace?.media[activeMediaIndex];

  return <div className="w-full h-full relative">
    <Map ref={mapRef} initialViewState={{ longitude: 120.231151, latitude: 22.995147, zoom: 5 }} mapStyle="mapbox://styles/mapbox/outdoors-v12" onLoad={onMapLoad} mapboxAccessToken={MAPBOX_TOKEN} interactiveLayerIds={['visit-node']} onClick={onClick}>
      <Source id="public-trajectory-data" type="geojson" data={progressiveLineData}><Layer {...lineLayer} /></Source>
      <Source id="public-visit-data" type="geojson" data={visitSourceData} cluster clusterMaxZoom={14} clusterRadius={50}><Layer {...clusterLayer} /><Layer {...clusterCountLayer} /><Layer {...pointLayer} /></Source>
      {activeFrame?.position && !isGapTransition && avatarForMode(activeMovement?.mode || 'unknown') && <Marker longitude={activeFrame.position[0]} latitude={activeFrame.position[1]} anchor="center"><div className="pointer-events-none transition-opacity duration-300" style={{ transform: `rotate(${activeFrame.bearing}deg)` }}>{avatarForMode(activeMovement?.mode || 'unknown')}</div></Marker>}
      {allChronologicalPlaces.filter((place) => place.isHighlight).map((place) => <Marker key={place.id} longitude={place.coordinates[0]} latitude={place.coordinates[1]} anchor="bottom" onClick={(event) => { event.originalEvent.stopPropagation(); activateSpot(place); }}><div className="relative cursor-pointer"><div className="absolute -inset-2 bg-amber-400 rounded-full blur-md opacity-40" /><div className="relative w-8 h-8 bg-amber-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white"><Sparkles size={16} /></div></div></Marker>)}
      {popupPlace && <Marker longitude={popupPlace.coordinates[0]} latitude={popupPlace.coordinates[1]} anchor="center"><div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-lg animate-pulse" /></Marker>}
    </Map>
    <CruiseController isCruising={isCruising} isDwelling={isDwelling} isHoverPaused={isHoverPaused} dwellProgress={dwellProgress} currentStopIndex={cruiseStopIndex} totalStops={chronologicalPlaces.length} currentPlaceTitle={chronologicalPlaces[cruiseStopIndex]?.title || ''} onStartCruise={handleStartCruise} onPauseResumeCruise={handlePauseResumeCruise} isPaused={isDwelling ? isManualCruisePaused || isHoverPaused : !isPlaying} onNextStop={() => selectCruiseStop(Math.min(cruiseStopIndex + 1, chronologicalPlaces.length - 1))} onPrevStop={() => selectCruiseStop(Math.max(0, cruiseStopIndex - 1))} onExitCruise={handleExitCruise} days={daysSummary} selectedDay={selectedDay} activeDay={visualActiveDay} onSelectDay={onSelectDay} />
    {popupPlace && <aside onMouseEnter={() => isCruising && isDwelling && setIsHoverPaused(true)} onMouseLeave={() => isCruising && isDwelling && setIsHoverPaused(false)} className={`z-20 bg-white/95 backdrop-blur-md overflow-hidden sm:absolute sm:top-4 sm:left-4 sm:w-[350px] sm:max-h-[calc(100%-140px)] sm:rounded-2xl sm:shadow-2xl sm:border sm:border-zinc-200/90 max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:rounded-t-3xl max-sm:shadow-2xl ${isSheetExpanded ? 'max-sm:h-[72vh]' : 'max-sm:h-[132px]'}`}>
      <button type="button" className="sm:hidden w-full py-2 text-zinc-400" onClick={() => setIsSheetExpanded((expanded) => !expanded)}>⌃</button><div className="p-4 overflow-y-auto h-full"><button type="button" onClick={() => { setPopupPlace(null); setIsHoverPaused(false); }} className="float-right p-1 text-zinc-400 hover:text-zinc-800" aria-label="關閉景點資訊"><X size={16} /></button><p className="text-xs text-blue-600 font-semibold">{popupPlace.dayNumber ? `Day ${popupPlace.dayNumber}` : '公開造訪'}</p><h2 className="text-lg font-bold text-zinc-900 pr-7">{popupPlace.title}</h2>{popupPlace.formattedTime && <p className="text-xs text-zinc-500 mt-1">{popupPlace.formattedTime}</p>}{popupPlace.description && <p className="text-sm text-zinc-700 mt-3 leading-6">{popupPlace.description}</p>}{popupPlace.tags.length > 0 && <div className="flex flex-wrap gap-1.5 mt-3">{popupPlace.tags.map((tag) => <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700">#{tag}</span>)}</div>}{popupMedia && <div className="mt-4">{popupMedia.type === 'image' ? <OptimizedImage src={popupMedia.url} alt={popupMedia.title || popupPlace.title} className="w-full rounded-xl" /> : <a className="flex gap-2 items-center text-sm text-blue-700 hover:underline" href={popupMedia.url} target="_blank" rel="noreferrer">{popupMedia.type === 'youtube' ? <Video size={16} /> : <ImageIcon size={16} />}{popupMedia.title || '查看媒體'}</a>}{popupPlace.media.length > 1 && <div className="flex gap-1 mt-2">{popupPlace.media.map((_, index) => <button key={index} type="button" aria-label={`媒體 ${index + 1}`} onClick={() => setActiveMediaIndex(index)} className={`w-2 h-2 rounded-full ${index === activeMediaIndex ? 'bg-blue-600' : 'bg-zinc-300'}`} />)}</div>}</div>}</div>
    </aside>}
    {timeline.movements.length > 0 && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-full bg-zinc-950/85 px-4 py-2 text-xs text-white backdrop-blur-md"><button type="button" onClick={() => setIsPlaying((playing) => !playing)} className="p-1 hover:text-blue-300" aria-label={isPlaying ? '暫停公開路段播放' : '播放公開路段'}>{isPlaying ? <Pause size={15} /> : <Play size={15} />}</button><span>{isGapTransition ? '未公開路段：鏡頭轉場中' : '依公開路段的敘事節奏播放'}</span></div>}
  </div>;
}
