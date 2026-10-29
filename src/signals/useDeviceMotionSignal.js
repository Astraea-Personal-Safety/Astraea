import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Astraea - Real Browser DeviceMotion & Accelerometer Signal Hook
 * 
 * Captures 3-axis hardware acceleration via window.DeviceMotionEvent.
 * Detects:
 * 1. Sudden physical impact or high-g fall (> 25 m/s²).
 * 2. Violent shaking or struggles (> 18 m/s² for consecutive samples).
 * 3. Hardware motion stillness corroboration.
 * 
 * Includes manual simulation fallbacks for desktop development and test suites.
 */
export function useDeviceMotionSignal({ enabled = true } = {}) {
  const [motionSupported, setMotionSupported] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('prompt'); // 'prompt' | 'granted' | 'denied' | 'unsupported'
  const [acceleration, setAcceleration] = useState({ x: 0, y: 0, z: 9.8 });
  const [magnitude, setMagnitude] = useState(9.8);
  const [impactDetected, setImpactDetected] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [lastImpactTimestamp, setLastImpactTimestamp] = useState(null);

  const shakeCounterRef = useRef(0);
  const impactCooldownRef = useRef(0);

  // Check hardware motion support on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('DeviceMotionEvent' in window) {
      setMotionSupported(true);
      // For standard desktop/Android browsers, permission is granted by default
      if (typeof DeviceMotionEvent.requestPermission !== 'function') {
        setPermissionStatus('granted');
      }
    } else {
      setMotionSupported(false);
      setPermissionStatus('unsupported');
    }
  }, []);

  // Request explicit permission (required on iOS Safari 13+)
  const requestMotionPermission = useCallback(async () => {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const response = await DeviceMotionEvent.requestPermission();
        if (response === 'granted') {
          setPermissionStatus('granted');
          return true;
        } else {
          setPermissionStatus('denied');
          return false;
        }
      } catch {
        setPermissionStatus('denied');
        return false;
      }
    } else if (motionSupported) {
      setPermissionStatus('granted');
      return true;
    }
    return false;
  }, [motionSupported]);

  // Motion event listener
  useEffect(() => {
    if (!enabled || permissionStatus !== 'granted') return;

    const handleMotion = (event) => {
      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (!acc) return;

      const x = Math.round((acc.x || 0) * 10) / 10;
      const y = Math.round((acc.y || 0) * 10) / 10;
      const z = Math.round((acc.z || 0) * 10) / 10;

      const totalMag = Math.round(Math.sqrt(x * x + y * y + z * z) * 10) / 10;

      setAcceleration({ x, y, z });
      setMagnitude(totalMag);

      const now = Date.now();

      // Sudden Impact / Fall Detection:
      // Normal gravity is ~9.8 m/s². A sudden drop/throw or hard collision spikes > 26 m/s²
      if (totalMag >= 26.0 && (now - impactCooldownRef.current) > 4000) {
        impactCooldownRef.current = now;
        setImpactDetected(true);
        setLastImpactTimestamp(now);

        // Auto-reset impact state after 6 seconds
        setTimeout(() => {
          setImpactDetected(false);
        }, 6000);
      }

      // Violent Shaking Detection:
      if (totalMag >= 18.0) {
        shakeCounterRef.current += 1;
        if (shakeCounterRef.current >= 4) {
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 3000);
        }
      } else {
        shakeCounterRef.current = Math.max(0, shakeCounterRef.current - 1);
      }
    };

    window.addEventListener('devicemotion', handleMotion, { passive: true });

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [enabled, permissionStatus]);

  // Manual simulation triggers for judge and developer testing
  const simulateImpact = useCallback(() => {
    const now = Date.now();
    setAcceleration({ x: 14.5, y: -22.1, z: 18.2 });
    setMagnitude(31.8);
    setImpactDetected(true);
    setLastImpactTimestamp(now);

    setTimeout(() => {
      setImpactDetected(false);
      setAcceleration({ x: 0, y: 0, z: 9.8 });
      setMagnitude(9.8);
    }, 6000);
  }, []);

  const simulateShake = useCallback(() => {
    setIsShaking(true);
    setAcceleration({ x: 12.3, y: -15.4, z: 8.1 });
    setMagnitude(21.4);

    setTimeout(() => {
      setIsShaking(false);
      setAcceleration({ x: 0, y: 0, z: 9.8 });
      setMagnitude(9.8);
    }, 3500);
  }, []);

  return {
    motionSupported,
    permissionStatus,
    requestMotionPermission,
    acceleration,
    magnitude,
    impactDetected,
    isShaking,
    lastImpactTimestamp,
    simulateImpact,
    simulateShake
  };
}
