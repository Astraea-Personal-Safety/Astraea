/**
 * POST /api/session
 * GET  /api/session?sessionId=...
 * 
 * Manages active tracking and monitoring sessions.
 */

import { store } from './_store.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const { sessionId } = req.query || {};
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId query parameter required' });
    }
    const session = await store.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    return res.status(200).json({ success: true, session });
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { sessionId, userName, destination, status = 'ACTIVE', tier = 'LOW', circleContacts = [] } = body;

      if (!sessionId) {
        return res.status(400).json({ error: 'Missing sessionId in request body' });
      }

      const session = await store.createOrUpdateSession(sessionId, {
        userName: userName || 'Astraea User',
        destination: destination || null,
        status,
        tier,
        circleContacts,
        startedAt: body.startedAt || Date.now()
      });

      return res.status(200).json({ success: true, session });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to process session', details: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
