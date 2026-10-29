/**
 * Geolocation & Kinematic Utility Functions
 * Pure mathematical formulas for real-world pace, distance, and stillness analysis.
 */

// Earth radius in meters
const EARTH_RADIUS_METERS = 6371000;

// Named Threshold Constants with Design Rationale
export const GPS_STILLNESS_JITTER_METERS = 10;  // Movements < 10m are considered GPS noise/jitter rather than actual transit
export const PACE_RUNNING_KMH = 11;             // >= 11 km/h corresponds to a sustained sprint or running gait
export const PACE_INCREASING_KMH = 6;           // 6 to 10.9 km/h corresponds to a brisk, evasive, or accelerating walking pace
export const FAMILIAR_RADIUS_METERS = 500;      // 500m perimeter around home/work/campus represents a familiar geofenced safety zone

/**
 * Calculates great-circle distance between two geographic coordinates using the Haversine formula.
 * 
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in meters
 */
export function calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates speed in kilometers per hour from distance and time delta.
 * 
 * @param {number} distanceMeters 
 * @param {number} timeDeltaSeconds 
 * @returns {number} Speed in km/h
 */
export function calculateSpeedKmh(distanceMeters, timeDeltaSeconds) {
  if (timeDeltaSeconds <= 0) return 0;
  const metersPerSec = distanceMeters / timeDeltaSeconds;
  return Math.round(metersPerSec * 3.6 * 10) / 10;
}

/**
 * Buckets real-world speed into the engine's pace enum.
 * 
 * @param {number} currentSpeedKmh 
 * @param {number} previousSpeedKmh 
 * @returns {'normal' | 'increasing' | 'running'}
 */
export function determinePaceFromSpeed(currentSpeedKmh, previousSpeedKmh = 0) {
  if (currentSpeedKmh >= PACE_RUNNING_KMH) {
    return 'running';
  }
  // If moving briskly (>= 6 km/h) or accelerating by more than 2.5 km/h
  if (currentSpeedKmh >= PACE_INCREASING_KMH || (currentSpeedKmh > 4 && currentSpeedKmh - previousSpeedKmh >= 2.5)) {
    return 'increasing';
  }
  return 'normal';
}

/**
 * Finds the minimum distance from live coordinates to any saved familiar place.
 * 
 * @param {{ latitude: number, longitude: number }} currentCoords 
 * @param {Array<{ id: string, name: string, latitude: number, longitude: number }>} savedPlaces 
 * @returns {{ nearestPlace: Object | null, minDistanceMeters: number | null }}
 */
export function findNearestFamiliarPlace(currentCoords, savedPlaces = []) {
  if (!currentCoords || !savedPlaces || savedPlaces.length === 0) {
    return { nearestPlace: null, minDistanceMeters: null };
  }

  let minDistance = Infinity;
  let nearest = null;

  for (const place of savedPlaces) {
    if (typeof place.latitude === 'number' && typeof place.longitude === 'number') {
      const dist = calculateHaversineDistanceMeters(
        currentCoords.latitude,
        currentCoords.longitude,
        place.latitude,
        place.longitude
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearest = place;
      }
    }
  }

  if (nearest === null || minDistance === Infinity) {
    return { nearestPlace: null, minDistanceMeters: null };
  }

  return {
    nearestPlace: nearest,
    minDistanceMeters: Math.round(minDistance)
  };
}

// In-memory cache for reverse geocoding to prevent excessive network calls
const geocodeCache = new Map();

/**
 * Reverse geocodes coordinates to a human-readable street/neighborhood address
 * using OpenStreetMap's free Nominatim API.
 * 
 * @param {number} lat 
 * @param {number} lon 
 * @returns {Promise<string>} Human readable location string
 */
export async function reverseGeocodeCoords(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return 'Coordinates unavailable';
  }

  // Cache key rounded to ~100m precision (3 decimal places)
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      const fallback = `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
      geocodeCache.set(cacheKey, fallback);
      return fallback;
    }

    const data = await res.json();
    const addr = data.address || {};
    
    // Build concise location description: road / neighborhood / suburb / city
    const primary = addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood || addr.amenity || data.name || 'Live Location';
    const secondary = addr.city || addr.town || addr.county || addr.state || '';
    const formatted = secondary ? `${primary}, ${secondary}` : primary;

    geocodeCache.set(cacheKey, formatted);
    return formatted;
  } catch {
    const fallback = `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
    geocodeCache.set(cacheKey, fallback);
    return fallback;
  }
}

