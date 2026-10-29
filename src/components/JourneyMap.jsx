import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './JourneyMap.css';

/**
 * Custom pulsing radar marker for user position
 */
const createRadarIcon = (pace = 'normal') => {
  const colorClass = pace === 'running' ? 'pace-running' : pace === 'increasing' ? 'pace-increasing' : 'pace-normal';
  return L.divIcon({
    className: 'astraea-map-marker-container',
    html: `
      <div class="radar-marker-pulse ${colorClass}">
        <div class="radar-ping"></div>
        <div class="radar-core"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

/**
 * Custom geofence icon for saved familiar places
 */
const createPlaceIcon = (name) => {
  return L.divIcon({
    className: 'astraea-place-marker',
    html: `
      <div class="place-marker-bubble">
        <span class="place-icon">🏡</span>
        <span class="place-label">${name}</span>
      </div>
    `,
    iconSize: [80, 28],
    iconAnchor: [40, 14]
  });
};

export default function JourneyMap({
  coordinates = null,
  breadcrumbs = [],
  savedPlaces = [],
  currentAddress = 'Acquiring GPS fix...',
  speedKmh = 0,
  pace = 'normal',
  stillnessSeconds = 0,
  isTracking = true,
  onRecenter = () => {}
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userMarkerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const routePolylineRef = useRef(null);
  const geofenceLayersRef = useRef([]);

  const [mapReady, setMapReady] = useState(false);
  const [autoCenter, setAutoCenter] = useState(true);

  // Default coordinate if none acquired yet: New Delhi (28.6139, 77.2090) or user coordinate
  const defaultLat = coordinates ? coordinates.latitude : 28.6139;
  const defaultLng = coordinates ? coordinates.longitude : 77.2090;

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false
    });

    // Dark-mode styled OpenStreetMap CartoDB Positron / OSM tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    // Zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Attribution
    L.control.attribution({
      position: 'bottomleft',
      prefix: '© OpenStreetMap contributors • Astraea Live'
    }).addTo(map);

    mapInstanceRef.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Render and Update User Marker & Breadcrumbs
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const currentLat = coordinates ? coordinates.latitude : defaultLat;
    const currentLng = coordinates ? coordinates.longitude : defaultLng;
    const currentPos = [currentLat, currentLng];

    // User Position Marker
    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker(currentPos, {
        icon: createRadarIcon(pace),
        zIndexOffset: 1000
      }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng(currentPos);
      userMarkerRef.current.setIcon(createRadarIcon(pace));
    }

    // Accuracy Circle
    const accuracyRadius = coordinates?.accuracy || 12;
    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = L.circle(currentPos, {
        radius: Math.min(100, Math.max(8, accuracyRadius)),
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
        weight: 1.5,
        dashArray: '4, 4'
      }).addTo(map);
    } else {
      accuracyCircleRef.current.setLatLng(currentPos);
      accuracyCircleRef.current.setRadius(Math.min(100, Math.max(8, accuracyRadius)));
    }

    // Breadcrumbs Route Polyline
    const latLngPoints = breadcrumbs.map(b => [b.latitude, b.longitude]);
    if (latLngPoints.length > 0) {
      if (!routePolylineRef.current) {
        routePolylineRef.current = L.polyline(latLngPoints, {
          color: '#2563eb',
          weight: 4,
          opacity: 0.85,
          lineJoin: 'round',
          lineCap: 'round',
          dashArray: pace === 'running' ? '6, 6' : undefined
        }).addTo(map);
      } else {
        routePolylineRef.current.setLatLngs(latLngPoints);
      }
    }

    if (autoCenter) {
      map.panTo(currentPos, { animate: true, duration: 0.8 });
    }
  }, [mapReady, coordinates, breadcrumbs, pace, autoCenter]);

  // 3. Render Geofenced Saved Places (500m Green Safe Zones)
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear existing geofence layers
    geofenceLayersRef.current.forEach(layer => map.removeLayer(layer));
    geofenceLayersRef.current = [];

    savedPlaces.forEach(place => {
      if (typeof place.latitude === 'number' && typeof place.longitude === 'number') {
        const placePos = [place.latitude, place.longitude];

        // 500m radius circle
        const circle = L.circle(placePos, {
          radius: 500,
          color: '#059669',
          fillColor: '#10b981',
          fillOpacity: 0.12,
          weight: 1.5
        }).addTo(map);

        circle.bindPopup(`<strong>Safe Zone: ${place.name}</strong><br>500m perimeter comfort boundary`);

        // Marker label
        const marker = L.marker(placePos, {
          icon: createPlaceIcon(place.name)
        }).addTo(map);

        geofenceLayersRef.current.push(circle, marker);
      }
    });
  }, [mapReady, savedPlaces]);

  const handleCenterClick = () => {
    setAutoCenter(true);
    if (mapInstanceRef.current) {
      const lat = coordinates ? coordinates.latitude : defaultLat;
      const lng = coordinates ? coordinates.longitude : defaultLng;
      mapInstanceRef.current.flyTo([lat, lng], 17, { animate: true, duration: 0.8 });
    }
    onRecenter();
  };

  return (
    <div className="journey-map-wrapper" id="live-journey-map">
      {/* Top Address & Telemetry Header Bar */}
      <div className="map-hud-header">
        <div className="hud-location-block">
          <span className="location-pin-icon">📍</span>
          <div className="hud-address-text">
            <span className="hud-address-title">{currentAddress}</span>
            <span className="hud-coords-sub">
              {coordinates ? `${coordinates.latitude.toFixed(5)}° N, ${coordinates.longitude.toFixed(5)}° E (±${Math.round(coordinates.accuracy || 8)}m)` : 'Simulated GPS Lock'}
            </span>
          </div>
        </div>

        <div className="hud-speed-pill">
          <span className="hud-speed-val">{speedKmh} km/h</span>
          <span className="hud-pace-tag">{pace.toUpperCase()}</span>
        </div>
      </div>

      {/* Map Viewport Container */}
      <div ref={mapContainerRef} className="leaflet-map-canvas" />

      {/* Floating Map Controls & Overlays */}
      <div className="map-floating-controls">
        <button
          type="button"
          className={`btn-map-control ${autoCenter ? 'active' : ''}`}
          onClick={handleCenterClick}
          title="Center map on my live location"
        >
          🎯 <span className="btn-control-label">Center Me</span>
        </button>

        <div className="map-legend-pill">
          <span className="legend-dot user-dot" /> Live You
          <span className="legend-dot geofence-dot" /> 500m Safe Zone
        </div>
      </div>

      {/* Stillness / Status Footer Ribbon */}
      {stillnessSeconds > 15 && (
        <div className="map-stillness-banner">
          <span className="stillness-pulse-dot" />
          <span>Stationary for <strong>{stillnessSeconds}s</strong> in current area</span>
        </div>
      )}
    </div>
  );
}
