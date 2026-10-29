import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook to manage the Screen Wake Lock API.
 * Keeps phone screen awake while Astraea Safety Monitoring or Live Walk is active.
 */
export function useScreenWakeLock({ enabled = true } = {}) {
  const [isLocked, setIsLocked] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const wakeLockRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'wakeLock' in navigator) {
      setIsSupported(true);
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (typeof window === 'undefined' || !('wakeLock' in navigator)) return false;

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsLocked(true);

      wakeLockRef.current.addEventListener('release', () => {
        setIsLocked(false);
        wakeLockRef.current = null;
      });
      return true;
    } catch (err) {
      console.warn('Wake Lock request error:', err.message);
      setIsLocked(false);
      return false;
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {}
      wakeLockRef.current = null;
    }
    setIsLocked(false);
  }, []);

  useEffect(() => {
    if (enabled && isSupported) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled && isSupported) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [enabled, isSupported, requestWakeLock, releaseWakeLock]);

  return {
    isLocked,
    isSupported,
    requestWakeLock,
    releaseWakeLock
  };
}
