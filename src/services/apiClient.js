/**
 * Astraea - API Client Service
 * 
 * Provides unified interface to backend serverless functions:
 * - /api/session (monitoring sessions)
 * - /api/location (telemetry streaming)
 * - /api/bolna/call (outbound AI phone calls)
 * - /api/track (public tracking queries)
 * 
 * Includes graceful client-side fallback when running in standalone offline/dev mode.
 */

const API_BASE = '/api';

export const apiClient = {
  /**
   * Syncs active walk/journey session with backend
   */
  async syncSession({ sessionId, userName, destination, status, tier, circleContacts }) {
    try {
      const res = await fetch(`${API_BASE}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userName,
          destination,
          status,
          tier,
          circleContacts
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('apiClient.syncSession fallback (offline/local):', err.message);
      return { success: true, localOnly: true };
    }
  },

  /**
   * Sends latest GPS location coordinate to backend
   */
  async streamLocation({ sessionId, latitude, longitude, speed, accuracy, riskTier }) {
    try {
      const res = await fetch(`${API_BASE}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          latitude,
          longitude,
          speed,
          accuracy,
          riskTier,
          timestamp: Date.now()
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      // Non-blocking telemetry
      return { success: false, offline: true };
    }
  },

  /**
   * Triggers outbound Bolna AI phone call
   */
  async triggerBolnaCall({
    phoneNumber,
    callType = 'checkin', // 'checkin' | 'alert'
    recipientName = 'Rishi',
    trackingUrl = '',
    emergencyReason = 'Missed safety check-in window',
    dryRun = false
  }) {
    try {
      const res = await fetch(`${API_BASE}/bolna/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          callType,
          recipientName,
          trackingUrl,
          emergencyReason,
          dryRun
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      console.error('apiClient.triggerBolnaCall error:', err.message);
      return {
        success: false,
        error: err.message
      };
    }
  },

  /**
   * Fetches public tracking details by ID
   */
  async fetchTrackingData(trackingId) {
    try {
      const res = await fetch(`${API_BASE}/track?id=${encodeURIComponent(trackingId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('apiClient.fetchTrackingData error:', err.message);
      return null;
    }
  }
};
