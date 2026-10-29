import { useState, useEffect, useRef, useCallback } from 'react';
import {
  calculateHaversineDistanceMeters,
  calculateSpeedKmh,
  determinePaceFromSpeed,
  findNearestFamiliarPlace,
  GPS_STILLNESS_JITTER_METERS,
  FAMILIAR_RADIUS_METERS,
  reverseGeocodeCoords
} from './geoUtils';

/**
 * Custom React Hook for Real Browser Geolocation Signals
 * Derives live Speed, Pace, Stillness, and Route Familiarity from GPS telemetry.
 */
export function useGeolocationSignals({
  manualPace = 'normal',
  manualStillnessSeconds = 0,
  manualRouteFamiliarity = 'familiar',
  savedPlaces = []
}) {
  const [permissionStatus, setPermissionStatus] = useState('prompt'); // 'prompt' | 'granted' | 'denied' | 'unsupported'
  const [coordinates, setCoordinates] = useState(null); // { latitude, longitude, accuracy }
  const [speedKmh, setSpeedKmh] = useState(0);
  const [gpsPace, setGpsPace] = useState('normal');
  const [gpsStillnessSeconds, setGpsStillnessSeconds] = useState(0);
  const [gpsRouteFamiliarity, setGpsRouteFamiliarity] = useState('familiar');
  const [nearestPlaceInfo, setNearestPlaceInfo] = useState(null);
  const [fallbackReason, setFallbackReason] = useState('Live GPS telemetry not started — using manual simulation.');

  const [currentAddress, setCurrentAddress] = useState('Acquiring location...');
  const [routeBreadcrumbs, setRouteBreadcrumbs] = useState([]);
  const [journeyAnomaly, setJourneyAnomaly] = useState(null);

  const watchIdRef = useRef(null);
  const lastPositionRef = useRef(null); // { latitude, longitude, timestamp }
  const lastMovementTimeRef = useRef(0);
  const prevSpeedRef = useRef(0);

  // Stillness timer ticker: continuously accumulates stillness seconds if stationary
  useEffect(() => {
    if (permissionStatus !== 'granted') {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const lastMove = lastMovementTimeRef.current || now;
      const elapsedStillness = Math.floor((now - lastMove) / 1000);
      setGpsStillnessSeconds(elapsedStillness);

      // Anomaly detection: Prolonged stillness (> 50s) while actively traveling
      if (elapsedStillness >= 50) {
        setJourneyAnomaly({
          type: 'prolonged_stillness',
          message: `Stationary for ${elapsedStillness}s in transit — safety check-in advised`
        });
      } else {
        setJourneyAnomaly(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [permissionStatus]);

  // Handle position update from navigator.geolocation.watchPosition
  const handlePositionSuccess = useCallback((position) => {
    const { latitude, longitude, accuracy, speed } = position.coords;
    const now = position.timestamp || Date.now();
    const currentCoords = { latitude, longitude, accuracy };
    setCoordinates(currentCoords);

    // Append to breadcrumb trail (up to 150 points)
    setRouteBreadcrumbs(prev => {
      const lastPoint = prev[prev.length - 1];
      if (lastPoint && calculateHaversineDistanceMeters(lastPoint.latitude, lastPoint.longitude, latitude, longitude) < 4) {
        return prev;
      }
      return [...prev.slice(-149), { latitude, longitude, speed: speed || 0, timestamp: now }];
    });

    // Asynchronously resolve address via Nominatim
    reverseGeocodeCoords(latitude, longitude).then(addr => {
      if (addr) setCurrentAddress(addr);
    }).catch(() => {});

    let calculatedSpeed = 0;

    if (lastPositionRef.current) {
      const distMeters = calculateHaversineDistanceMeters(
        lastPositionRef.current.latitude,
        lastPositionRef.current.longitude,
        latitude,
        longitude
      );

      const timeDeltaSeconds = Math.max(0.5, (now - lastPositionRef.current.timestamp) / 1000);

      // Check if this movement exceeds the GPS noise/jitter threshold
      if (distMeters >= GPS_STILLNESS_JITTER_METERS) {
        // Meaningful position change detected -> Reset stillness timer
        lastMovementTimeRef.current = now;
        setGpsStillnessSeconds(0);
      }

      // Calculate speed from distance/time or use hardware GPS speed if provided
      if (typeof speed === 'number' && !isNaN(speed) && speed >= 0) {
        calculatedSpeed = Math.round(speed * 3.6 * 10) / 10;
      } else {
        calculatedSpeed = calculateSpeedKmh(distMeters, timeDeltaSeconds);
      }
    } else {
      lastMovementTimeRef.current = now;
    }

    setSpeedKmh(calculatedSpeed);

    // Bucket into pace enum
    const derivedPace = determinePaceFromSpeed(calculatedSpeed, prevSpeedRef.current);
    prevSpeedRef.current = calculatedSpeed;
    setGpsPace(derivedPace);

    // Compute route familiarity against saved places
    if (savedPlaces && savedPlaces.length > 0) {
      const { nearestPlace, minDistanceMeters } = findNearestFamiliarPlace(currentCoords, savedPlaces);
      if (nearestPlace && minDistanceMeters !== null) {
        const isWithinPerimeter = minDistanceMeters <= FAMILIAR_RADIUS_METERS;
        setGpsRouteFamiliarity(isWithinPerimeter ? 'familiar' : 'unfamiliar');
        setNearestPlaceInfo({
          name: nearestPlace.name,
          distanceMeters: minDistanceMeters,
          isFamiliar: isWithinPerimeter
        });
      } else {
        setGpsRouteFamiliarity('unfamiliar');
        setNearestPlaceInfo(null);
      }
    } else {
      setGpsRouteFamiliarity(manualRouteFamiliarity);
      setNearestPlaceInfo(null);
    }

    lastPositionRef.current = { latitude, longitude, timestamp: now };
  }, [savedPlaces, manualRouteFamiliarity]);

  const handlePositionError = useCallback((error) => {
    let reason = 'Geolocation unavailable — using manual simulation.';
    if (error.code === 1) { // PERMISSION_DENIED
      reason = 'Location permission denied by user — using manual simulation for pace & stillness.';
      setPermissionStatus('denied');
    } else if (error.code === 2) { // POSITION_UNAVAILABLE
      reason = 'GPS satellite position unavailable — using manual simulation.';
    } else if (error.code === 3) { // TIMEOUT
      reason = 'Location request timed out — using manual simulation.';
    }
    setFallbackReason(reason);
  }, []);

  // Explicit user permission trigger (called after pre-permission explanation)
  const requestPermission = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setPermissionStatus('unsupported');
      setFallbackReason('Geolocation API is not supported by your browser — using manual simulation.');
      return;
    }

    setPermissionStatus('requesting');
    setFallbackReason(null);

    // Request initial position to trigger browser prompt
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPermissionStatus('granted');
        handlePositionSuccess(pos);

        // Start continuous position watcher
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
        watchIdRef.current = navigator.geolocation.watchPosition(
          handlePositionSuccess,
          handlePositionError,
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 3000
          }
        );
      },
      (err) => {
        handlePositionError(err);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [handlePositionSuccess, handlePositionError]);

  // Stop GPS tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setPermissionStatus('prompt');
    setCoordinates(null);
    setSpeedKmh(0);
    setGpsPace('normal');
    setGpsStillnessSeconds(0);
    setGpsRouteFamiliarity('familiar');
    setFallbackReason('Live GPS telemetry paused — using manual simulation.');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const isGeolocationActive = permissionStatus === 'granted';

  return {
    isGeolocationActive,
    permissionStatus,
    requestPermission,
    stopTracking,
    coordinates,
    speedKmh,
    pace: isGeolocationActive ? gpsPace : manualPace,
    stillnessSeconds: isGeolocationActive ? gpsStillnessSeconds : manualStillnessSeconds,
    routeFamiliarity: (isGeolocationActive && savedPlaces.length > 0) ? gpsRouteFamiliarity : manualRouteFamiliarity,
    nearestPlaceInfo,
    fallbackReason,
    FAMILIAR_RADIUS_METERS,
    currentAddress,
    routeBreadcrumbs,
    journeyAnomaly,
    simulatePosition: (lat, lon, spd = 4) => {
      handlePositionSuccess({
        coords: { latitude: lat, longitude: lon, accuracy: 8, speed: spd / 3.6 },
        timestamp: Date.now()
      });
    }
  };
}
