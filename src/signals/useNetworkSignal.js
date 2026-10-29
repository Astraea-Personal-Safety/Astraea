import { useState, useEffect } from 'react';

/**
 * Astraea - Network Connectivity Signal Hook
 * 
 * Tracks real online/offline status and network connection telemetry.
 * If offline during an active journey, risk engine flags communication vulnerability.
 */
export function useNetworkSignal() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [networkInfo, setNetworkInfo] = useState(() => {
    if (typeof navigator !== 'undefined' && navigator.connection) {
      return {
        effectiveType: navigator.connection.effectiveType || '4g',
        downlink: navigator.connection.downlink || 10,
        rtt: navigator.connection.rtt || 50,
        saveData: navigator.connection.saveData || false
      };
    }
    return {
      effectiveType: 'unknown',
      downlink: null,
      rtt: null,
      saveData: false
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let connectionObj = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    const handleConnectionChange = () => {
      if (connectionObj) {
        setNetworkInfo({
          effectiveType: connectionObj.effectiveType || '4g',
          downlink: connectionObj.downlink || 10,
          rtt: connectionObj.rtt || 50,
          saveData: connectionObj.saveData || false
        });
      }
    };

    if (connectionObj) {
      connectionObj.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connectionObj) {
        connectionObj.removeEventListener('change', handleConnectionChange);
      }
    };
  }, []);

  return {
    isOnline,
    networkInfo,
    isConnectionWeak: !isOnline || networkInfo.effectiveType === '2g' || networkInfo.effectiveType === 'slow-2g'
  };
}
