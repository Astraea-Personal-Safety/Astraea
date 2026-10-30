/**
 * GET /api/track?id=... OR /api/track/:id
 * 
 * Public sanitized tracking data for emergency contacts.
 * Strips all internal secrets, passwords, and sensitive keys.
 */

import { store } from './_store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query || {};
  if (!id) {
    return res.status(400).json({ error: 'Tracking ID is required' });
  }

  const session = await store.getSession(id);
  const locations = await store.getLocations(id);
  const latestLocation = await store.getLatestLocation(id);

  if (!session && locations.length === 0) {
    return res.status(404).json({ error: 'Tracking link expired or not found' });
  }

  // Mask contact phone numbers for public privacy
  const sanitizedContacts = (session?.circleContacts || []).map(c => ({
    name: c.name || 'Emergency Contact',
    maskedPhone: c.phone ? c.phone.replace(/(\+\d{2})\s?(\d{2})\d+(\d{3})/, '$1 $2*** ***$3') : 'Hidden'
  }));

  return res.status(200).json({
    success: true,
    trackingId: id,
    userName: session?.userName || 'Astraea User',
    status: session?.status || 'ACTIVE',
    riskTier: session?.tier || (latestLocation?.riskTier || 'LOW'),
    destination: session?.destination || null,
    startedAt: session?.startedAt || null,
    lastUpdate: latestLocation?.receivedAt || Date.now(),
    latestLocation: latestLocation ? {
      latitude: latestLocation.latitude,
      longitude: latestLocation.longitude,
      speed: latestLocation.speed,
      accuracy: latestLocation.accuracy,
      timestamp: latestLocation.recordedAt
    } : null,
    locationTrail: locations.slice(-30).map(loc => ({
      latitude: loc.latitude,
      longitude: loc.longitude,
      timestamp: loc.recordedAt
    })),
    contactAcknowledged: Boolean(session?.contactAcknowledged),
    trustedContacts: sanitizedContacts
  });
}
