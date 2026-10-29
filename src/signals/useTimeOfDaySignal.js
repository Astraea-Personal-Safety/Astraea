import { useState, useEffect } from 'react';

/**
 * Cutoff Hour Constants for Diurnal Risk Baseline:
 * 06:00 (6 AM) to 19:00 (7 PM) represents daytime daylight hours with higher ambient visibility and bystander baseline.
 * 19:00 (7 PM) to 06:00 (6 AM) represents nighttime with elevated baseline vulnerability.
 */
export const DAY_START_HOUR = 6;  // 6:00 AM
export const DAY_END_HOUR = 19;   // 7:00 PM (19:00)

/**
 * Custom React Hook for Real Browser-Derived Time of Day
 * Fully automatic, zero permissions required.
 * 
 * @returns {{ timeOfDay: 'day' | 'night', formattedTime: string, currentHour: number, isReal: boolean }}
 */
export function useTimeOfDaySignal() {
  const [timeState, setTimeState] = useState(() => {
    const now = new Date();
    const hour = now.getHours();
    const isDay = hour >= DAY_START_HOUR && hour < DAY_END_HOUR;
    return {
      timeOfDay: isDay ? 'day' : 'night',
      currentHour: hour,
      formattedTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isReal: true
    };
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hour = now.getHours();
      const isDay = hour >= DAY_START_HOUR && hour < DAY_END_HOUR;
      setTimeState({
        timeOfDay: isDay ? 'day' : 'night',
        currentHour: hour,
        formattedTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        isReal: true
      });
    };

    // Update every 10 seconds for snappy UI clock and periodic day/night refresh
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  return timeState;
}
