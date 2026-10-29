/**
 * Astraea - Real-Time Environmental Weather Signal (External REST API)
 * 
 * Powered by Open-Meteo Free Public API (https://open-meteo.com)
 * Fetches real live meteorological conditions using user's actual GPS coordinates:
 * - Visibility in meters (fog / smoke / haze threat factor)
 * - WMO Weather Codes (severe storms, downpours, blizzards)
 * - Ambient Temperature & Wind Speed
 * 
 * No API key required, 100% real network HTTP requests.
 */

import { useState, useEffect, useRef } from 'react';

// WMO Weather Interpretation Codes
export function interpretWmoCode(code) {
  if (code === 0) return { condition: 'Clear Sky', isHazard: false, hazardPoints: 0 };
  if (code >= 1 && code <= 3) return { condition: 'Partly Cloudy', isHazard: false, hazardPoints: 0 };
  if (code === 45 || code === 48) return { condition: 'Dense Fog', isHazard: true, hazardPoints: 8, description: 'Low atmospheric visibility' };
  if (code >= 51 && code <= 55) return { condition: 'Drizzle', isHazard: false, hazardPoints: 0 };
  if (code >= 61 && code <= 65) return { condition: 'Rain Showers', isHazard: true, hazardPoints: 5, description: 'Slippery roads & wet conditions' };
  if (code >= 71 && code <= 77) return { condition: 'Snowfall', isHazard: true, hazardPoints: 8, description: 'Sub-zero freezing precipitation' };
  if (code >= 80 && code <= 82) return { condition: 'Heavy Rain Squall', isHazard: true, hazardPoints: 8, description: 'Torrential downpour' };
  if (code >= 95 && code <= 99) return { condition: 'Severe Thunderstorm', isHazard: true, hazardPoints: 12, description: 'Lightning & severe atmospheric danger' };
  return { condition: 'Overcast', isHazard: false, hazardPoints: 0 };
}

export function useEnvironmentalWeatherSignal(coordinates = null) {
  const [weatherData, setWeatherData] = useState({
    temperature: null,
    weatherCode: 0,
    condition: 'Clear',
    visibilityMeters: 10000,
    windSpeedKmh: 0,
    isAdverseWeather: false,
    hazardDescription: null,
    hazardPoints: 0,
    isRealApi: true,
    apiEndpoint: 'https://api.open-meteo.com/v1/forecast',
    lastFetchedAt: null
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastFetchedCoordsRef = useRef(null);

  useEffect(() => {
    // Default to New Delhi (28.6139, 77.2090) if no coordinates available yet
    const lat = coordinates?.latitude ?? 28.6139;
    const lon = coordinates?.longitude ?? 77.2090;

    // Throttle: don't re-fetch if within ~500m of last fetch within 10 minutes
    if (lastFetchedCoordsRef.current) {
      const dLat = Math.abs(lastFetchedCoordsRef.current.lat - lat);
      const dLon = Math.abs(lastFetchedCoordsRef.current.lon - lon);
      const timeSince = Date.now() - (lastFetchedCoordsRef.current.time || 0);
      if (dLat < 0.005 && dLon < 0.005 && timeSince < 600000) {
        return;
      }
    }

    let isMounted = true;
    const fetchWeather = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,visibility&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Weather API returned ${res.status}`);
        
        const json = await res.json();
        const current = json.current || {};
        const wmo = interpretWmoCode(current.weather_code ?? 0);
        
        const visibility = current.visibility ?? 10000;
        let isLowVisibility = visibility < 1500;
        let hazardPoints = wmo.hazardPoints;
        let hazardDesc = wmo.description;

        if (isLowVisibility && !wmo.isHazard) {
          hazardPoints = 8;
          hazardDesc = `Severely reduced visibility (${Math.round(visibility)}m)`;
        }

        if (isMounted) {
          setWeatherData({
            temperature: current.temperature_2m ?? 24,
            weatherCode: current.weather_code ?? 0,
            condition: wmo.condition,
            visibilityMeters: visibility,
            windSpeedKmh: current.wind_speed_10m ?? 5,
            isAdverseWeather: wmo.isHazard || isLowVisibility,
            hazardDescription: hazardDesc,
            hazardPoints,
            isRealApi: true,
            apiEndpoint: url,
            lastFetchedAt: Date.now()
          });
          lastFetchedCoordsRef.current = { lat, lon, time: Date.now() };
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchWeather();

    return () => {
      isMounted = false;
    };
  }, [coordinates?.latitude, coordinates?.longitude]);

  return {
    ...weatherData,
    loading,
    error
  };
}
