/**
 * POST /api/location
 * GET  /api/location?sessionId=...
 * 
 * Ingests live telemetry coordinates from active journey.
 */

import { store } from './_store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const { sessionId } = req.query || {};
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }
    const latest = await store.getLatestLocation(sessionId);
    const history = await store.getLocations(sessionId);
    return res.status(200).json({ success: true, latest, count: history.length });
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { sessionId, latitude, longitude, speed = 0, accuracy = 10, riskTier = 'LOW' } = body;

      if (!sessionId || latitude == null || longitude == null) {
        return res.status(400).json({ error: 'sessionId, latitude, and longitude are required' });
      }

      const recorded = await store.addLocation(sessionId, {
        latitude: Number(latitude),
        longitude: Number(longitude),
        speed: Number(speed),
        accuracy: Number(accuracy),
        riskTier,
        recordedAt: body.timestamp || Date.now()
      });

      return res.status(200).json({ success: true, location: recorded });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to record location', details: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
