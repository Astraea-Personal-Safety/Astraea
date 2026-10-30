/**
 * Astraea Backend - Global Serverless In-Memory / Storage Store
 * Provides ephemeral state for active sessions, locations, and call rate limiting.
 */

// In-memory store (retained across hot lambda invocations)
const memoryStore = {
  sessions: new Map(),
  locations: new Map(), // sessionId -> Array of { lat, lng, speed, timestamp }
  callLog: []           // Array of { phone, agentId, timestamp, executionId }
};

export const store = {
  // Session
  createOrUpdateSession(sessionId, data) {
    const existing = memoryStore.sessions.get(sessionId) || {};
    const updated = {
      ...existing,
      ...data,
      sessionId,
      updatedAt: Date.now()
    };
    memoryStore.sessions.set(sessionId, updated);
    return updated;
  },

  getSession(sessionId) {
    return memoryStore.sessions.get(sessionId) || null;
  },

  // Location
  addLocation(sessionId, locationData) {
    const list = memoryStore.locations.get(sessionId) || [];
    const item = {
      ...locationData,
      receivedAt: Date.now()
    };
    list.push(item);
    // Keep last 100 locations
    if (list.length > 100) list.shift();
    memoryStore.locations.set(sessionId, list);
    return item;
  },

  getLocations(sessionId) {
    return memoryStore.locations.get(sessionId) || [];
  },

  getLatestLocation(sessionId) {
    const list = memoryStore.locations.get(sessionId) || [];
    return list.length > 0 ? list[list.length - 1] : null;
  },

  // Bolna Rate Limiting & Safety Rails
  logCall({ phone, agentId, executionId, status = 'success' }) {
    const entry = {
      phone: String(phone).replace(/\s+/g, ''),
      agentId,
      executionId,
      status,
      timestamp: Date.now()
    };
    memoryStore.callLog.push(entry);
    if (memoryStore.callLog.length > 200) memoryStore.callLog.shift();
    return entry;
  },

  getRecentCalls(phone, windowSeconds = 60) {
    const cleanPhone = String(phone).replace(/\s+/g, '');
    const cutoff = Date.now() - (windowSeconds * 1000);
    return memoryStore.callLog.filter(c => c.phone === cleanPhone && c.timestamp >= cutoff);
  },

  // Call Cooldown Check: Enforces >= 20 seconds between calls to same number
  isCallRateLimited(phone, cooldownSeconds = 20) {
    const recent = this.getRecentCalls(phone, cooldownSeconds);
    return recent.length > 0;
  }
};
