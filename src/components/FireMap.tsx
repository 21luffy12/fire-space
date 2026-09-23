import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet.heat';
import { Compass, Globe, ZoomIn, ZoomOut, Maximize2, Flame, Zap, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { FireCluster, FireObservation } from '../types';

interface FireMapProps {
  clusters: FireCluster[];
  observations: FireObservation[];
  selectedClusterId: string | null;
  onSelectCluster: (clusterId: string) => void;
  onSelectObservation?: (obs: FireObservation) => void;
}

export const FireMap: React.FC<FireMapProps> = ({
  clusters,
  observations,
  selectedClusterId,
  onSelectCluster
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Layer references
  const canvasRendererRef = useRef<L.Canvas | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const labelLayerRef = useRef<L.TileLayer | null>(null);
  const heatLayerRef = useRef<any>(null);
  const hotspotsLayerRef = useRef<L.LayerGroup | null>(null);
  const perimetersLayerRef = useRef<L.LayerGroup | null>(null);
  const projectionsLayerRef = useRef<L.LayerGroup | null>(null);
  const vectorsLayerRef = useRef<L.LayerGroup | null>(null);

  // Map settings
  const [mapStyle, setMapStyle] = useState<'carto-dark' | 'satellite-contrast' | 'satellite-clarity' | 'night' | 'topo'>('carto-dark');
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showPerimeters, setShowPerimeters] = useState(true);
  const [showProjections, setShowProjections] = useState(true);
  const [showVectors, setShowVectors] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [heatRadius, setHeatRadius] = useState<number>(24);
  const [heatIntensity, setHeatIntensity] = useState<number>(0.85);
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);

  // Track map viewport zoom & bounds in state
  const [zoomLevel, setZoomLevel] = useState<number>(3);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);

  // Initialize Leaflet map with peak performance settings
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // High-performance canvas renderer with optimal padding to prevent clipping on pan
    const canvasRenderer = L.canvas({ padding: 0.25, tolerance: 3 });
    canvasRendererRef.current = canvasRenderer;

    const map = L.map(mapContainerRef.current, {
      center: [20.0, 0.0],
      zoom: 3,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      renderer: canvasRenderer,
      zoomAnimation: true,
      zoomAnimationThreshold: 8,
      fadeAnimation: true, // Smooth subtle fade for seamless tile transitions
      markerZoomAnimation: true,
      zoomSnap: 0.25, // Enables silky fractional zoom levels
      zoomDelta: 0.5, // Gentle, granular zoom stepping
      wheelPxPerZoomLevel: 180, // Much smoother and gradual mousewheel zooming
      wheelDebounceTime: 25,
      inertia: true,
      inertiaDeceleration: 2600, // Natural fluid gliding deceleration
      inertiaMaxSpeed: 1800,
      easeLinearity: 0.2, // Smooth cubic bezier easing
      worldCopyJump: true
    });

    // Default: High-performance Dark Canvas (Clean & watermark-free, no API key required)
    const baseTile = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        maxNativeZoom: 16,
        attribution: 'Esri, HERE, Garmin',
        updateWhenIdle: false,
        updateWhenZooming: true, // Seamless during zoom animations
        keepBuffer: 6, // Keeps surrounding tiles in memory for instantaneous pan response
        tileSize: 256
      }
    );
    baseTile.addTo(map);
    tileLayerRef.current = baseTile;

    // Dark Reference labels overlay (Clean, no watermark)
    const labelTile = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        maxNativeZoom: 16,
        zIndex: 600,
        updateWhenIdle: false,
        updateWhenZooming: true,
        keepBuffer: 6
      }
    );
    labelTile.addTo(map);
    labelLayerRef.current = labelTile;

    // Initialize layer groups
    perimetersLayerRef.current = L.layerGroup().addTo(map);
    projectionsLayerRef.current = L.layerGroup().addTo(map);
    vectorsLayerRef.current = L.layerGroup().addTo(map);
    hotspotsLayerRef.current = L.layerGroup().addTo(map);

    // Track zoom and bounds on moveend
    const updateViewport = () => {
      setZoomLevel(map.getZoom());
      setMapBounds(map.getBounds());
    };

    map.on('moveend', updateViewport);
    map.on('zoomend', updateViewport);

    // Initial viewport
    updateViewport();
    mapRef.current = map;

    return () => {
      map.off('moveend', updateViewport);
      map.off('zoomend', updateViewport);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle Base Map Tile Switcher
  useEffect(() => {
    if (!mapRef.current) return;

    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    if (labelLayerRef.current) {
      mapRef.current.removeLayer(labelLayerRef.current);
      labelLayerRef.current = null;
    }

    let url = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
    let subdomains = '';
    let maxZoom = 19;
    let maxNativeZoom: number | undefined = 16;
    let labelUrl: string | null = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
    let isHighContrast = false;

    if (mapStyle === 'carto-dark') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
      subdomains = '';
      labelUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
      maxZoom = 19;
      maxNativeZoom = 16;
    } else if (mapStyle === 'satellite-contrast') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      subdomains = '';
      labelUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
      maxZoom = 19;
      maxNativeZoom = 18;
      isHighContrast = true;
    } else if (mapStyle === 'satellite-clarity') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      subdomains = '';
      labelUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
      maxZoom = 19;
      maxNativeZoom = 18;
    } else if (mapStyle === 'night') {
      url = 'https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_Black_Marble/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg';
      subdomains = '';
      labelUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
      maxZoom = 8;
      maxNativeZoom = 8;
    } else if (mapStyle === 'topo') {
      url = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      subdomains = 'abc';
      labelUrl = null;
      maxZoom = 17;
      maxNativeZoom = 17;
    }

    const newLayer = L.tileLayer(url, {
      maxZoom,
      maxNativeZoom,
      subdomains,
      className: isHighContrast ? 'satellite-high-contrast' : '',
      updateWhenIdle: false,
      updateWhenZooming: true,
      keepBuffer: 6
    });
    newLayer.addTo(mapRef.current);
    tileLayerRef.current = newLayer;

    if (showLabels && labelUrl) {
      const labels = L.tileLayer(labelUrl, {
        subdomains: subdomains || '',
        maxZoom,
        maxNativeZoom,
        zIndex: 600,
        opacity: 0.85,
        updateWhenIdle: false,
        updateWhenZooming: true,
        keepBuffer: 6
      });
      labels.addTo(mapRef.current);
      labelLayerRef.current = labels;
    }
  }, [mapStyle, showLabels]);

  // Memoized heat points for optimal rendering
  const heatPoints = useMemo(() => {
    if (observations.length === 0) return [];
    return observations.map(o => {
      const intensity = Math.min(1.0, Math.max(0.25, (o.fireRadiativePower / 75) * heatIntensity));
      return [o.latitude, o.longitude, intensity] as [number, number, number];
    });
  }, [observations, heatIntensity]);

  // Render Continuous Heatmap Layer
  useEffect(() => {
    if (!mapRef.current) return;

    if (heatLayerRef.current) {
      mapRef.current.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (!showHeatmap || heatPoints.length === 0) return;

    try {
      // @ts-ignore
      const heat = L.heatLayer(heatPoints, {
        radius: heatRadius,
        blur: 15,
        maxZoom: 14,
        max: 1.0,
        minOpacity: 0.28,
        gradient: {
          0.2: '#1e3a8a',
          0.35: '#06b6d4',
          0.5: '#10b981',
          0.65: '#facc15',
          0.8: '#f97316',
          0.92: '#ef4444',
          1.0: '#ffffff'
        }
      });

      heat.addTo(mapRef.current);
      heatLayerRef.current = heat;
    } catch (e) {
      console.warn('Leaflet heat layer initialization note:', e);
    }
  }, [heatPoints, showHeatmap, heatRadius]);

  // Viewport-culled and zoom-adaptive observations list:
  // With generous 40% margin beyond viewport so panning never pops in points abruptly
  const visibleObservations = useMemo(() => {
    if (!showHotspots || observations.length === 0) return [];

    let inView = observations;
    if (mapBounds) {
      const padBounds = mapBounds.pad(0.4); // 40% margin beyond screen edges for silky seamless panning
      inView = observations.filter(o => padBounds.contains([o.latitude, o.longitude]));
    }

    // Adapt point count to current zoom level for 60 FPS fluidity
    if (zoomLevel <= 3.5) {
      // Planetary view: top 250 highest FRP points
      return inView.slice(0, 250);
    } else if (zoomLevel <= 5.5) {
      return inView.slice(0, 500);
    } else if (zoomLevel <= 7.5) {
      return inView.slice(0, 850);
    }
    // Zoomed in: render all visible in-bounds points
    return inView;
  }, [observations, showHotspots, mapBounds, zoomLevel]);

  // Render Geospatial Vectors, Perimeters and Hotspot markers
  useEffect(() => {
    if (!mapRef.current) return;
    const renderer = canvasRendererRef.current || undefined;

    // Clear previous layers
    hotspotsLayerRef.current?.clearLayers();
    perimetersLayerRef.current?.clearLayers();
    projectionsLayerRef.current?.clearLayers();
    vectorsLayerRef.current?.clearLayers();

    // 1. Render Clustered Perimeters and 6-hour Projections
    clusters.forEach(c => {
      const isSelected = c.clusterId === selectedClusterId;

      // Draw 6-Hour Projected Region (Dashed boundary cone)
      if (showProjections && c.spreadPrediction && projectionsLayerRef.current) {
        const coneCoords = c.spreadPrediction.projectedGeometry.coordinates[0];
        const latLngs = coneCoords.map(pt => [pt[1], pt[0]] as [number, number]);

        const projectionPolygon = L.polygon(latLngs, {
          renderer,
          color: isSelected ? '#38bdf8' : '#ea580c',
          weight: isSelected ? 2.5 : 1.5,
          dashArray: '5, 5',
          fillColor: '#f97316',
          fillOpacity: isSelected ? 0.3 : 0.12
        });

        // Use standard Leaflet popup on click for zero hover overhead
        projectionPolygon.bindPopup(
          `<div class="p-1 font-mono text-[11px]">
            <div class="text-amber-400 font-bold">6-Hour Projection Zone</div>
            <div>Expansion: +${c.spreadPrediction.estimatedDistanceKm} km</div>
            <div>Heading: ${c.spreadPrediction.directionDegrees}°</div>
          </div>`
        );

        projectionPolygon.on('click', () => onSelectCluster(c.clusterId));
        projectionsLayerRef.current.addLayer(projectionPolygon);
      }

      // Draw Cluster Estimated Perimeter (Solid boundary polygon)
      if (showPerimeters && c.perimeter && perimetersLayerRef.current) {
        const polyCoords = c.perimeter.coordinates[0];
        const latLngs = polyCoords.map(pt => [pt[1], pt[0]] as [number, number]);

        const perimeterPolygon = L.polygon(latLngs, {
          renderer,
          color: isSelected ? '#38bdf8' : c.riskLevel === 'CRITICAL' ? '#ef4444' : '#f59e0b',
          weight: isSelected ? 2.8 : 1.6,
          fillColor: c.riskLevel === 'CRITICAL' ? '#dc2626' : '#d97706',
          fillOpacity: isSelected ? 0.38 : 0.2
        });

        perimeterPolygon.bindPopup(
          `<div class="p-1.5 font-mono text-xs">
            <div class="font-bold text-amber-300 flex items-center justify-between gap-2">
              <span>${c.name}</span>
              <span class="text-[10px] px-1 py-0.5 bg-amber-500/20 rounded text-amber-300 border border-amber-500/40">${c.clusterId}</span>
            </div>
            <div class="mt-1 text-slate-200">Avg FRP: <span class="text-rose-400 font-bold">${c.averageFRP} MW</span> · Area: ${c.perimeter.areaKm2} km²</div>
            <div class="text-[10px] text-slate-400 font-bold tracking-wider mt-0.5">${c.riskLevel} RISK CLASSIFICATION</div>
          </div>`
        );

        perimeterPolygon.on('click', () => onSelectCluster(c.clusterId));
        perimetersLayerRef.current.addLayer(perimeterPolygon);
      }

      // Draw Spread Direction Vector Arrow
      if (showVectors && c.spreadPrediction && vectorsLayerRef.current) {
        const centerLat = c.center.latitude;
        const centerLon = c.center.longitude;
        const distKm = c.spreadPrediction.estimatedDistanceKm;
        const deg = c.spreadPrediction.directionDegrees;

        const rad = (deg * Math.PI) / 180.0;
        const cosLat = Math.max(Math.cos((centerLat * Math.PI) / 180), 0.01);
        const endLat = centerLat + (distKm * Math.cos(rad)) / 111.32;
        const endLon = centerLon + (distKm * Math.sin(rad)) / (111.32 * cosLat);

        const vectorLine = L.polyline(
          [[centerLat, centerLon], [endLat, endLon]],
          {
            renderer,
            color: '#38bdf8',
            weight: 2,
            dashArray: '4, 4'
          }
        );

        const headMarker = L.circleMarker([endLat, endLon], {
          renderer,
          radius: 4,
          color: '#38bdf8',
          fillColor: '#38bdf8',
          fillOpacity: 1
        });

        vectorsLayerRef.current.addLayer(vectorLine);
        vectorsLayerRef.current.addLayer(headMarker);
      }
    });

    // 2. Render Satellite Radiometric Hotspots
    if (showHotspots && hotspotsLayerRef.current) {
      visibleObservations.forEach(obs => {
        const isSelected = obs.clusterId === selectedClusterId;
        const radius = Math.min(10, Math.max(3.5, 3 + Math.sqrt(obs.fireRadiativePower) * 0.6));

        let fillColor = '#f59e0b';
        let strokeColor = '#b45309';

        if (obs.fireRadiativePower >= 120) {
          fillColor = '#ffffff';
          strokeColor = '#ef4444';
        } else if (obs.fireRadiativePower >= 60) {
          fillColor = '#ef4444';
          strokeColor = '#991b1b';
        } else if (obs.fireRadiativePower >= 25) {
          fillColor = '#f97316';
          strokeColor = '#c2410c';
        }

        const circle = L.circleMarker([obs.latitude, obs.longitude], {
          renderer,
          radius,
          fillColor,
          color: isSelected ? '#38bdf8' : strokeColor,
          weight: isSelected ? 2.5 : 1,
          opacity: 1,
          fillOpacity: 0.92
        });

        // Use popup instead of tooltip so mouse movement across 1000 points doesn't trigger layout recalcs
        circle.bindPopup(
          `<div class="p-1 font-mono text-[11px] leading-tight">
            <div class="font-bold text-amber-400 flex items-center justify-between gap-2">
              <span>Radiometric Hotspot</span>
              <span class="text-[9px] px-1 py-0.2 bg-slate-800 rounded text-slate-300 font-normal">${obs.satellite}</span>
            </div>
            <div class="mt-1">FRP: <span class="font-bold text-rose-400">${obs.fireRadiativePower} MW</span></div>
            <div>Brightness Temp: <span class="text-amber-200">${obs.brightnessTemperature} K</span></div>
            <div>Location: ${obs.latitude.toFixed(3)}°, ${obs.longitude.toFixed(3)}°</div>
            <div>Time: ${obs.acquisitionDate} ${obs.acquisitionTime} UTC</div>
          </div>`
        );

        circle.on('click', () => {
          if (obs.clusterId) onSelectCluster(obs.clusterId);
        });

        hotspotsLayerRef.current?.addLayer(circle);
      });
    }
  }, [clusters, visibleObservations, selectedClusterId, showHotspots, showPerimeters, showProjections, showVectors, onSelectCluster]);

  // Center on selected cluster with cinematic smooth flyTo
  useEffect(() => {
    if (!mapRef.current || !selectedClusterId) return;
    const cluster = clusters.find(c => c.clusterId === selectedClusterId);
    if (cluster) {
      const targetZoom = Math.max(mapRef.current.getZoom(), 8.5);
      mapRef.current.flyTo([cluster.center.latitude, cluster.center.longitude], targetZoom, {
        animate: true,
        duration: 1.2,
        easeLinearity: 0.15
      });
    }
  }, [selectedClusterId, clusters]);

  // Zoom control helpers with smooth animation
  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn(0.5, { animate: true });
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut(0.5, { animate: true });
  }, []);

  const handleResetView = useCallback(() => {
    if (clusters.length > 0 && mapRef.current) {
      const bounds = L.latLngBounds(clusters.map(c => [c.center.latitude, c.center.longitude]));
      mapRef.current.flyToBounds(bounds, {
        padding: [50, 50],
        duration: 1.4,
        easeLinearity: 0.2
      });
    } else {
      mapRef.current?.flyTo([20.0, 0.0], 3, {
        duration: 1.4,
        easeLinearity: 0.2
      });
    }
  }, [clusters]);

  const [activeRegion, setActiveRegion] = useState<string>('GLOBAL');

  const handleGlobalPlanetaryView = useCallback(() => {
    setActiveRegion('GLOBAL');
    mapRef.current?.flyTo([20.0, 0.0], 3, {
      duration: 1.4,
      easeLinearity: 0.2
    });
  }, []);

  const handleFlyToRegion = useCallback((regionKey: string) => {
    setActiveRegion(regionKey);
    if (!mapRef.current) return;

    if (regionKey === 'GLOBAL') {
      handleGlobalPlanetaryView();
      return;
    }

    if (regionKey === 'INDIA') {
      const indiaClusters = clusters.filter(c => c.region.toLowerCase().includes('india'));
      if (indiaClusters.length > 0) {
        const bounds = L.latLngBounds(indiaClusters.map(c => [c.center.latitude, c.center.longitude]));
        mapRef.current.flyToBounds(bounds, { padding: [60, 60], maxZoom: 7.5, duration: 1.4, easeLinearity: 0.2 });
      } else {
        mapRef.current.flyTo([22.5, 79.5], 5.0, { duration: 1.4, easeLinearity: 0.2 });
      }
      return;
    }

    if (regionKey === 'ASIA') {
      const asiaClusters = clusters.filter(c => c.region.toLowerCase().includes('asia') || c.region.toLowerCase().includes('india'));
      if (asiaClusters.length > 0) {
        const bounds = L.latLngBounds(asiaClusters.map(c => [c.center.latitude, c.center.longitude]));
        mapRef.current.flyToBounds(bounds, { padding: [60, 60], maxZoom: 6.5, duration: 1.4, easeLinearity: 0.2 });
      } else {
        mapRef.current.flyTo([24.0, 102.0], 4.0, { duration: 1.4, easeLinearity: 0.2 });
      }
      return;
    }

    if (regionKey === 'NORTH_AMERICA') {
      const naClusters = clusters.filter(c => c.region.toLowerCase().includes('north america'));
      if (naClusters.length > 0) {
        const bounds = L.latLngBounds(naClusters.map(c => [c.center.latitude, c.center.longitude]));
        mapRef.current.flyToBounds(bounds, { padding: [60, 60], maxZoom: 6, duration: 1.4, easeLinearity: 0.2 });
      } else {
        mapRef.current.flyTo([42.0, -100.0], 4.0, { duration: 1.4, easeLinearity: 0.2 });
      }
      return;
    }

    if (regionKey === 'SOUTH_AMERICA') {
      const saClusters = clusters.filter(c => c.region.toLowerCase().includes('south america'));
      if (saClusters.length > 0) {
        const bounds = L.latLngBounds(saClusters.map(c => [c.center.latitude, c.center.longitude]));
        mapRef.current.flyToBounds(bounds, { padding: [60, 60], maxZoom: 6, duration: 1.4, easeLinearity: 0.2 });
      } else {
        mapRef.current.flyTo([-15.0, -60.0], 4.0, { duration: 1.4, easeLinearity: 0.2 });
      }
      return;
    }

    if (regionKey === 'EUROPE') {
      const euClusters = clusters.filter(c => c.region.toLowerCase().includes('europe'));
      if (euClusters.length > 0) {
        const bounds = L.latLngBounds(euClusters.map(c => [c.center.latitude, c.center.longitude]));
        mapRef.current.flyToBounds(bounds, { padding: [60, 60], maxZoom: 6, duration: 1.4, easeLinearity: 0.2 });
      } else {
        mapRef.current.flyTo([48.0, 16.0], 4.5, { duration: 1.4, easeLinearity: 0.2 });
      }
      return;
    }

    if (regionKey === 'AUSTRALIA') {
      const auClusters = clusters.filter(c => c.region.toLowerCase().includes('australia'));
      if (auClusters.length > 0) {
        const bounds = L.latLngBounds(auClusters.map(c => [c.center.latitude, c.center.longitude]));
        mapRef.current.flyToBounds(bounds, { padding: [60, 60], maxZoom: 6, duration: 1.4, easeLinearity: 0.2 });
      } else {
        mapRef.current.flyTo([-25.0, 134.0], 4.2, { duration: 1.4, easeLinearity: 0.2 });
      }
      return;
    }
  }, [clusters, handleGlobalPlanetaryView]);

  return (
    <div className="relative w-full h-full min-h-[460px] bg-[#05070c] border border-[#1e293b] rounded-lg overflow-hidden shadow-2xl">
      {/* Map DOM Target */}
      <div ref={mapContainerRef} className="w-full h-full z-0 select-none" />

      {/* Floating HUD Controls - Top Left */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 max-w-[calc(100%-4rem)]">
        {/* Basemap Selector */}
        <div className="bg-[#0b0f19]/90 backdrop-blur-md border border-[#1e293b] p-1 rounded-md flex items-center gap-1 shadow-2xl overflow-x-auto max-w-full">
          <button
            onClick={() => setMapStyle('carto-dark')}
            className={`px-2.5 py-1 text-xs font-mono rounded transition-all flex items-center gap-1.5 whitespace-nowrap ${
              mapStyle === 'carto-dark'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🌑 Tactical Dark</span>
          </button>
          <button
            onClick={() => setMapStyle('satellite-contrast')}
            className={`px-2.5 py-1 text-xs font-mono rounded transition-all flex items-center gap-1.5 whitespace-nowrap ${
              mapStyle === 'satellite-contrast'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🛰️ High-Contrast Sat</span>
          </button>
          <button
            onClick={() => setMapStyle('satellite-clarity')}
            className={`px-2 py-1 text-xs font-mono rounded transition-all whitespace-nowrap ${
              mapStyle === 'satellite-clarity' ? 'bg-[#1e293b] text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Clarity Sat
          </button>
          <button
            onClick={() => setMapStyle('night')}
            className={`px-2 py-1 text-xs font-mono rounded transition-all whitespace-nowrap ${
              mapStyle === 'night' ? 'bg-[#1e293b] text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            NASA Night
          </button>
          <button
            onClick={() => setMapStyle('topo')}
            className={`px-2 py-1 text-xs font-mono rounded transition-all whitespace-nowrap ${
              mapStyle === 'topo' ? 'bg-[#1e293b] text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Topography
          </button>
        </div>

        {/* Geographic Region Jump Bar */}
        <div className="bg-[#0b0f19]/90 backdrop-blur-md border border-[#1e293b] p-1 rounded-md flex items-center gap-1 shadow-2xl overflow-x-auto max-w-full text-xs font-mono">
          <span className="text-[10px] text-slate-500 font-bold uppercase px-1.5 flex items-center gap-1">
            <Compass className="w-3 h-3 text-amber-400" />
            Region:
          </span>
          <button
            onClick={() => handleFlyToRegion('GLOBAL')}
            className={`px-2 py-0.5 rounded text-[11px] transition-all whitespace-nowrap ${
              activeRegion === 'GLOBAL' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🌍 Global
          </button>
          <button
            onClick={() => handleFlyToRegion('INDIA')}
            className={`px-2 py-0.5 rounded text-[11px] transition-all whitespace-nowrap flex items-center gap-1 font-semibold ${
              activeRegion === 'INDIA' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/30'
            }`}
            title="Focus on India (Indo-Gangetic, Central Deciduous, Western Ghats)"
          >
            <span>🇮🇳</span> India
          </button>
          <button
            onClick={() => handleFlyToRegion('ASIA')}
            className={`px-2 py-0.5 rounded text-[11px] transition-all whitespace-nowrap flex items-center gap-1 font-semibold ${
              activeRegion === 'ASIA' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 border border-cyan-500/30'
            }`}
            title="Focus on Asia (South, Southeast, & East Asia)"
          >
            <span>🌏</span> Asia
          </button>
          <button
            onClick={() => handleFlyToRegion('NORTH_AMERICA')}
            className={`px-2 py-0.5 rounded text-[11px] transition-all whitespace-nowrap ${
              activeRegion === 'NORTH_AMERICA' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🌲 N. America
          </button>
          <button
            onClick={() => handleFlyToRegion('SOUTH_AMERICA')}
            className={`px-2 py-0.5 rounded text-[11px] transition-all whitespace-nowrap ${
              activeRegion === 'SOUTH_AMERICA' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🌴 S. America
          </button>
          <button
            onClick={() => handleFlyToRegion('EUROPE')}
            className={`px-2 py-0.5 rounded text-[11px] transition-all whitespace-nowrap ${
              activeRegion === 'EUROPE' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🏛️ Europe
          </button>
          <button
            onClick={() => handleFlyToRegion('AUSTRALIA')}
            className={`px-2 py-0.5 rounded text-[11px] transition-all whitespace-nowrap ${
              activeRegion === 'AUSTRALIA' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🦘 Australia
          </button>
        </div>

        {/* Collapsible Telemetry Overlays Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsTelemetryOpen(!isTelemetryOpen)}
            className="bg-[#0b0f19]/90 hover:bg-[#131b2e] backdrop-blur-md border border-[#1e293b] hover:border-amber-500/50 px-3 py-1.5 rounded-md flex items-center justify-between gap-2.5 text-xs font-mono text-slate-200 shadow-2xl transition-all cursor-pointer select-none"
            title="Toggle Telemetry Overlays & Filter Controls"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold text-[11px] tracking-wide">Telemetry Overlays</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                {visibleObservations.length}
              </span>
              {isTelemetryOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </div>
          </button>

          {/* Collapsible Dropdown Content */}
          {isTelemetryOpen && (
            <div className="absolute top-full left-0 mt-1.5 bg-[#0b0f19]/95 backdrop-blur-md border border-[#1e293b] p-3 rounded-md flex flex-col gap-2.5 text-[11px] font-mono text-slate-300 shadow-2xl w-64 z-30 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex items-center justify-between px-1 pb-1.5 border-b border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  Active Layer Toggles
                </span>
                <button
                  onClick={() => setIsTelemetryOpen(false)}
                  className="text-[10px] text-slate-400 hover:text-amber-400 cursor-pointer"
                >
                  Close
                </button>
              </div>

              {/* Continuous Heatmap Toggle */}
              <label className="flex items-center justify-between px-1 cursor-pointer hover:text-slate-100 bg-slate-900/60 p-1.5 rounded border border-amber-500/20">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showHeatmap}
                    onChange={e => setShowHeatmap(e.target.checked)}
                    className="accent-amber-500 rounded"
                  />
                  <span className="text-amber-300 font-semibold flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    Thermal Heatmap
                  </span>
                </div>
                <span className="text-[9px] text-emerald-400 font-bold">SMOOTH</span>
              </label>

              {/* Heatmap Tuning Sliders */}
              {showHeatmap && (
                <div className="px-2 py-1.5 bg-slate-950/70 rounded border border-slate-800 flex flex-col gap-1.5 text-[10px]">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Heat Radius:</span>
                    <span className="text-amber-400">{heatRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="50"
                    step="2"
                    value={heatRadius}
                    onChange={e => setHeatRadius(parseInt(e.target.value))}
                    className="accent-amber-500 h-1 bg-slate-800 rounded cursor-pointer"
                  />

                  <div className="flex items-center justify-between text-slate-400 mt-0.5">
                    <span>Thermal Intensity:</span>
                    <span className="text-orange-400">{Math.round(heatIntensity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="1.5"
                    step="0.05"
                    value={heatIntensity}
                    onChange={e => setHeatIntensity(parseFloat(e.target.value))}
                    className="accent-orange-500 h-1 bg-slate-800 rounded cursor-pointer"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 px-1 cursor-pointer hover:text-slate-100">
                <input
                  type="checkbox"
                  checked={showHotspots}
                  onChange={e => setShowHotspots(e.target.checked)}
                  className="accent-amber-500 rounded"
                />
                <span>Hotspot Radiance Halos</span>
              </label>
              <label className="flex items-center gap-2 px-1 cursor-pointer hover:text-slate-100">
                <input
                  type="checkbox"
                  checked={showPerimeters}
                  onChange={e => setShowPerimeters(e.target.checked)}
                  className="accent-amber-500 rounded"
                />
                <span>DBSCAN Fire Perimeters</span>
              </label>
              <label className="flex items-center gap-2 px-1 cursor-pointer hover:text-slate-100">
                <input
                  type="checkbox"
                  checked={showProjections}
                  onChange={e => setShowProjections(e.target.checked)}
                  className="accent-orange-500 rounded"
                />
                <span>6-Hour Spread Cones</span>
              </label>
              <label className="flex items-center gap-2 px-1 cursor-pointer hover:text-slate-100">
                <input
                  type="checkbox"
                  checked={showVectors}
                  onChange={e => setShowVectors(e.target.checked)}
                  className="accent-cyan-500 rounded"
                />
                <span>Atmospheric Wind Vectors</span>
              </label>
              <label className="flex items-center gap-2 px-1 cursor-pointer hover:text-slate-100">
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={e => setShowLabels(e.target.checked)}
                  className="accent-slate-400 rounded"
                />
                <span>Geographic Place Labels</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Map Zoom & Bounds HUD - Top Right */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-[#0b0f19]/90 hover:bg-[#1e293b] text-slate-200 border border-[#1e293b] rounded transition-all shadow-lg cursor-pointer hover:border-amber-500/50 active:scale-95"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-[#0b0f19]/90 hover:bg-[#1e293b] text-slate-200 border border-[#1e293b] rounded transition-all shadow-lg cursor-pointer hover:border-amber-500/50 active:scale-95"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleGlobalPlanetaryView}
          className="p-2 bg-[#0b0f19]/90 hover:bg-[#1e293b] text-amber-400 border border-[#1e293b] rounded transition-all shadow-lg cursor-pointer hover:border-amber-500/50 active:scale-95"
          title="Global World View"
        >
          <Compass className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetView}
          className="p-2 bg-[#0b0f19]/90 hover:bg-[#1e293b] text-slate-200 border border-[#1e293b] rounded transition-all shadow-lg cursor-pointer hover:border-amber-500/50 active:scale-95"
          title="Fit All Monitored Fire Clusters"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Map Legend Overlay - Bottom Left */}
      <div className="absolute bottom-3 left-3 z-10 bg-[#0b0f19]/90 backdrop-blur-md border border-[#1e293b] px-3.5 py-2 rounded-md text-[11px] font-mono text-slate-300 shadow-2xl flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-2 rounded bg-gradient-to-r from-blue-700 via-emerald-500 via-yellow-400 via-orange-500 to-rose-600 border border-slate-700" />
          <span className="text-[10px] text-amber-300">Heatmap Density</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
          <span>Nominal (&lt;25MW)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
          <span>Elevated (25-60MW)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.9)] animate-pulse" />
          <span>Severe (&gt;60MW)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-white border border-rose-500 shadow-[0_0_14px_rgba(255,255,255,1)]" />
          <span>Mega-Fire (&gt;120MW)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-2 border border-dashed border-orange-400 bg-orange-500/20" />
          <span>6h Spread Cone</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-cyan-400" />
          <span>Wind Vector</span>
        </div>
      </div>
    </div>
  );
};
