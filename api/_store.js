/**
 * Astraea Backend - Serverless Store
 *
 * Two modes, chosen automatically from environment variables:
 *
 * 1. In-memory (default). Works for `npm run dev`, tests and a single Node server.
 *    Methods return plain values (synchronously).
 *
 * 2. Persistent Redis over the Upstash / Vercel KV REST API. Enabled when either
 *      UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *      KV_REST_API_URL        + KV_REST_API_TOKEN          (Vercel KV marketplace names)
 *    are set. Methods return Promises. No extra npm dependency (plain fetch).
 *    If Redis is unreachable we log and fall back to the in-memory copy, so a
 *    storage outage can never block an emergency flow.
 *
 * Callers should always `await` store methods; awaiting a plain value is harmless.
 */

import { getEnv } from './_env.js';

const TTL_SESSION_SECONDS = 24 * 60 * 60;
const TTL_CALL_RESULT_SECONDS = 7 * 24 * 60 * 60;
const MAX_LOCATIONS = 100;
const K = 'astraea:';

// In-memory store (retained across hot lambda invocations; always written as a fallback copy)
const memoryStore = {
  sessions: new Map(),
  locations: new Map(), // sessionId -> Array of { lat, lng, speed, timestamp }
  callLog: [],          // Array of { phone, agentId, timestamp, executionId }
  callResults: new Map(), // executionId -> processed Bolna webhook result
  marks: new Map()      // generic rate-limit marks: key -> timestamp
};

// ---------------------------------------------------------------------------
// Redis (Upstash REST) helpers
// ---------------------------------------------------------------------------

function redisConfig() {
  const url = getEnv('UPSTASH_REDIS_REST_URL') || getEnv('KV_REST_API_URL');
  const token = getEnv('UPSTASH_REDIS_REST_TOKEN') || getEnv('KV_REST_API_TOKEN');
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

export function isPersistent() {
  return redisConfig() !== null;
}

/** Runs a pipeline of Redis commands; returns array of results. Throws on any error. */
async function redis(commands) {
  const cfg = redisConfig();
  const res = await fetch(`${cfg.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commands)
  });
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
  const out = await res.json();
  return out.map(item => {
    if (item.error) throw new Error(`Redis: ${item.error}`);
    return item.result;
  });
}

function parseJson(raw) {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Use Redis when configured, otherwise (or on failure) the in-memory implementation. */
function hybrid(redisImpl, memoryImpl) {
  if (!isPersistent()) return memoryImpl();
  return redisImpl().catch(err => {
    console.warn('[store] Redis unavailable, using in-memory fallback:', err.message);
    return memoryImpl();
  });
}

const cleanPhone = phone => String(phone).replace(/\s+/g, '');

// ---------------------------------------------------------------------------
// Public store API
// ---------------------------------------------------------------------------

export const store = {
  // Session
  createOrUpdateSession(sessionId, data) {
    const memWrite = () => {
      const existing = memoryStore.sessions.get(sessionId) || {};
      const updated = { ...existing, ...data, sessionId, updatedAt: Date.now() };
      memoryStore.sessions.set(sessionId, updated);
      return updated;
    };
    if (!isPersistent()) return memWrite();

    return (async () => {
      const updated = memWrite(); // keeps fallback copy fresh
      try {
        const [raw] = await redis([['GET', `${K}session:${sessionId}`]]);
        const merged = { ...(parseJson(raw) || {}), ...updated };
        await redis([['SET', `${K}session:${sessionId}`, JSON.stringify(merged), 'EX', TTL_SESSION_SECONDS]]);
        return merged;
      } catch (err) {
        console.warn('[store] createOrUpdateSession fallback:', err.message);
        return updated;
      }
    })();
  },

  getSession(sessionId) {
    return hybrid(
      async () => {
        const [raw] = await redis([['GET', `${K}session:${sessionId}`]]);
        return parseJson(raw) || memoryStore.sessions.get(sessionId) || null;
      },
      () => memoryStore.sessions.get(sessionId) || null
    );
  },

  // Location
  addLocation(sessionId, locationData) {
    const item = { ...locationData, receivedAt: Date.now() };
    const list = memoryStore.locations.get(sessionId) || [];
    list.push(item);
    if (list.length > MAX_LOCATIONS) list.shift();
    memoryStore.locations.set(sessionId, list);
    if (!isPersistent()) return item;

    const key = `${K}loc:${sessionId}`;
    return redis([
      ['RPUSH', key, JSON.stringify(item)],
      ['LTRIM', key, -MAX_LOCATIONS, -1],
      ['EXPIRE', key, TTL_SESSION_SECONDS]
    ]).then(() => item).catch(err => {
      console.warn('[store] addLocation fallback:', err.message);
      return item;
    });
  },

  getLocations(sessionId) {
    return hybrid(
      async () => {
        const [rows] = await redis([['LRANGE', `${K}loc:${sessionId}`, 0, -1]]);
        const parsed = (rows || []).map(parseJson).filter(Boolean);
        return parsed.length ? parsed : (memoryStore.locations.get(sessionId) || []);
      },
      () => memoryStore.locations.get(sessionId) || []
    );
  },

  getLatestLocation(sessionId) {
    return hybrid(
      async () => {
        const [rows] = await redis([['LRANGE', `${K}loc:${sessionId}`, -1, -1]]);
        const latest = parseJson(rows && rows[0]);
        if (latest) return latest;
        const list = memoryStore.locations.get(sessionId) || [];
        return list.length > 0 ? list[list.length - 1] : null;
      },
      () => {
        const list = memoryStore.locations.get(sessionId) || [];
        return list.length > 0 ? list[list.length - 1] : null;
      }
    );
  },

  // Bolna Rate Limiting & Safety Rails
  logCall({ phone, agentId, executionId, status = 'success' }) {
    const entry = {
      phone: cleanPhone(phone),
      agentId,
      executionId,
      status,
      timestamp: Date.now()
    };
    memoryStore.callLog.push(entry);
    if (memoryStore.callLog.length > 200) memoryStore.callLog.shift();
    if (!isPersistent()) return entry;

    return redis([['SET', `${K}lastcall:${entry.phone}`, JSON.stringify(entry), 'EX', 300]])
      .then(() => entry)
      .catch(err => {
        console.warn('[store] logCall fallback:', err.message);
        return entry;
      });
  },

  getRecentCalls(phone, windowSeconds = 60) {
    const p = cleanPhone(phone);
    const cutoff = Date.now() - (windowSeconds * 1000);
    const fromMemory = () => memoryStore.callLog.filter(c => c.phone === p && c.timestamp >= cutoff);
    return hybrid(
      async () => {
        const [raw] = await redis([['GET', `${K}lastcall:${p}`]]);
        const last = parseJson(raw);
        const recent = last && last.timestamp >= cutoff ? [last] : [];
        return recent.length ? recent : fromMemory();
      },
      fromMemory
    );
  },

  // Call Cooldown Check: Enforces >= 20 seconds between calls to same number
  isCallRateLimited(phone, cooldownSeconds = 20) {
    const recent = this.getRecentCalls(phone, cooldownSeconds);
    if (recent && typeof recent.then === 'function') {
      return recent.then(list => list.length > 0);
    }
    return recent.length > 0;
  },

  /**
   * Generic cooldown gate for non-call channels (Telegram / WhatsApp relays).
   * Returns true if the action is allowed (and records it), false if still cooling down.
   */
  tryAcquire(key, cooldownSeconds = 20) {
    const memTry = () => {
      const last = memoryStore.marks.get(key) || 0;
      if (Date.now() - last < cooldownSeconds * 1000) return false;
      memoryStore.marks.set(key, Date.now());
      return true;
    };
    if (!isPersistent()) return memTry();

    return redis([['SET', `${K}mark:${key}`, '1', 'NX', 'EX', cooldownSeconds]])
      .then(([result]) => result === 'OK')
      .catch(err => {
        console.warn('[store] tryAcquire fallback:', err.message);
        return memTry();
      });
  },

  // Bolna webhook results (keyed by execution id)
  saveCallResult(executionId, result) {
    if (!executionId) return null;
    const entry = { ...result, executionId, savedAt: Date.now() };
    memoryStore.callResults.set(executionId, entry);
    if (memoryStore.callResults.size > 200) {
      memoryStore.callResults.delete(memoryStore.callResults.keys().next().value);
    }
    if (!isPersistent()) return entry;

    return redis([['SET', `${K}exec:${executionId}`, JSON.stringify(entry), 'EX', TTL_CALL_RESULT_SECONDS]])
      .then(() => entry)
      .catch(err => {
        console.warn('[store] saveCallResult fallback:', err.message);
        return entry;
      });
  },

  getCallResult(executionId) {
    return hybrid(
      async () => {
        const [raw] = await redis([['GET', `${K}exec:${executionId}`]]);
        return parseJson(raw) || memoryStore.callResults.get(executionId) || null;
      },
      () => memoryStore.callResults.get(executionId) || null
    );
  }
};
