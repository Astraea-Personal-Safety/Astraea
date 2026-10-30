/**
 * Astraea Backend - Environment helper
 *
 * Reads from process.env first (Vercel / production), then falls back to a local
 * `.env.local` file (local `vercel dev` / plain Node runs). Secrets are NEVER
 * hard-coded here; this file only knows how to look them up.
 */

import fs from 'node:fs';
import path from 'node:path';

let localEnvCache = null;

function loadLocalEnv() {
  if (localEnvCache) return localEnvCache;
  localEnvCache = {};
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
        if (m) localEnvCache[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // ignore - file may be unreadable in serverless runtimes
  }
  return localEnvCache;
}

export function getEnv(key, fallback = '') {
  if (process.env[key]) return process.env[key];
  const local = loadLocalEnv();
  if (local[key]) return local[key];
  return fallback;
}

/** Comma-separated VERIFIED_PHONE_NUMBERS -> normalized E.164 list ([] if unset). */
export function getVerifiedPhones() {
  return getEnv('VERIFIED_PHONE_NUMBERS')
    .split(',')
    .map(p => normalizePhone(p))
    .filter(Boolean);
}

export function normalizePhone(phone) {
  const cleaned = String(phone || '').replace(/[\s\-()]/g, '');
  if (!cleaned) return '';
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

export function parseBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body || {};
}
