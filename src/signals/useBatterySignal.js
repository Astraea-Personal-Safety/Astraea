import { useState, useEffect, useRef } from 'react';

/**
 * Battery Anomaly Detection Thresholds:
 * - A drop of >= 5% within <= 60 seconds is physically anomalous for normal phone workloads
 *   and strongly suggests hardware tampering, forced discharge, or battery degradation under duress.
 * - Gradual discharge is flagged when the battery reserve drops below 20%.
 */
export const INSTANT_DROP_PERCENT_THRESHOLD = 5;
export const INSTANT_DROP_WINDOW_SECONDS = 60;
export const LOW_BATTERY_THRESHOLD = 20;

/**
 * Custom React Hook for Real Browser Battery Status
 * Uses navigator.getBattery() with graceful fallback for unsupported/restricted browsers.
 */
export function useBatterySignal(manualLevel = 95, manualDropType = 'none') {
  const [batteryState, setBatteryState] = useState({
    batteryLevel: manualLevel,
    batteryDropType: manualDropType,
    isCharging: false,
    isBatterySupported: false,
    fallbackReason: 'Checking browser Battery Status API support...'
  });

  const historyRef = useRef([]); // Stores [{ level, timestamp }]

  useEffect(() => {
    let batteryObj = null;
    let isMounted = true;

    async function initBattery() {
      // Feature detection: Check if navigator.getBattery is available
      if (typeof navigator === 'undefined' || typeof navigator.getBattery !== 'function') {
        if (isMounted) {
          setBatteryState({
            batteryLevel: manualLevel,
            batteryDropType: manualDropType,
            isCharging: false,
            isBatterySupported: false,
            fallbackReason: 'Battery Status API is restricted/unsupported in this browser — using manual simulation.'
          });
        }
        return;
      }

      try {
        batteryObj = await navigator.getBattery();
        if (!isMounted) return;

        const updateBattery = () => {
          const currentLevel = Math.round(batteryObj.level * 100);
          const isCharging = batteryObj.charging;
          const now = Date.now();

          // Add to reading history
          const history = historyRef.current;
          history.push({ level: currentLevel, timestamp: now });

          // Prune history older than 5 minutes
          const cutoff = now - 5 * 60 * 1000;
          historyRef.current = history.filter(item => item.timestamp >= cutoff);

          // Calculate drop type from history
          let dropType = 'none';

          // Check for instant drop anomaly within the last 60 seconds
          const recentThresholdTime = now - INSTANT_DROP_WINDOW_SECONDS * 1000;
          const baselineReading = historyRef.current.find(item => item.timestamp <= recentThresholdTime);

          if (baselineReading && (baselineReading.level - currentLevel) >= INSTANT_DROP_PERCENT_THRESHOLD) {
            dropType = 'instant';
          } else if (!isCharging && currentLevel <= LOW_BATTERY_THRESHOLD) {
            dropType = 'gradual';
          }

          setBatteryState({
            batteryLevel: currentLevel,
            batteryDropType: dropType,
            isCharging,
            isBatterySupported: true,
            fallbackReason: null
          });
        };

        // Initial read
        updateBattery();

        // Listen for browser battery events
        batteryObj.addEventListener('levelchange', updateBattery);
        batteryObj.addEventListener('chargingchange', updateBattery);
      } catch (err) {
        if (isMounted) {
          setBatteryState({
            batteryLevel: manualLevel,
            batteryDropType: manualDropType,
            isCharging: false,
            isBatterySupported: false,
            fallbackReason: `Battery Status API error (${err.message}) — using manual simulation.`
          });
        }
      }
    }

    initBattery();

    return () => {
      isMounted = false;
      if (batteryObj) {
        try {
          batteryObj.removeEventListener('levelchange', () => {});
          batteryObj.removeEventListener('chargingchange', () => {});
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [manualLevel, manualDropType]);

  return batteryState;
}
