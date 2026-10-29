/**
 * Astraea - Security Vault & Anti-Coercion Delay Controller
 * 
 * Features:
 * 1. 6-digit PIN vault authentication (Salted SHA-256 via Web Crypto API).
 * 2. Location-aware security delay (iPhone Stolen Device Protection style):
 *    - Inside trusted locations (<= 500m of saved safe place): Changes apply immediately with PIN.
 *    - Away from trusted locations (> 500m): Initiates a mandatory 2-hour delay (60s in ?dev=1).
 *    - Old phrases and contacts remain active during the delay window.
 *    - Clear countdown and cancellation support.
 */

import { calculateHaversineDistanceMeters } from '../signals/geoUtils.js';

const STORAGE_KEYS = {
  VAULT_PIN_HASH: 'astraea_vault_pin_hash',
  VAULT_PIN_SALT: 'astraea_vault_pin_salt',
  PENDING_SECURITY_CHANGE: 'astraea_pending_security_change'
};

const DEFAULT_SALT = 'astraea-secure-salt-2026';
const DEFAULT_PIN = '123456';
const TRUSTED_RADIUS_METERS = 500;
const SECURITY_DELAY_SECONDS = 2 * 60 * 60; // 2 hours
const DEV_SECURITY_DELAY_SECONDS = 60;       // 60 seconds in ?dev=1

/**
 * Computes a salted SHA-256 hash of a string using Web Crypto API.
 */
export async function hashPin(pin, salt = DEFAULT_SALT) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${pin.trim()}`);
  
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback for test runner environments lacking crypto.subtle
  let hash = 0;
  const str = `${salt}:${pin.trim()}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Verifies if entered PIN matches stored PIN hash.
 */
export async function verifyVaultPin(enteredPin) {
  try {
    const storedHash = localStorage.getItem(STORAGE_KEYS.VAULT_PIN_HASH);
    const storedSalt = localStorage.getItem(STORAGE_KEYS.VAULT_PIN_SALT) || DEFAULT_SALT;

    // If no PIN has been set yet, initialize default PIN
    if (!storedHash) {
      const defaultHash = await hashPin(DEFAULT_PIN, storedSalt);
      localStorage.setItem(STORAGE_KEYS.VAULT_PIN_HASH, defaultHash);
      localStorage.setItem(STORAGE_KEYS.VAULT_PIN_SALT, storedSalt);
      return enteredPin.trim() === DEFAULT_PIN;
    }

    const testHash = await hashPin(enteredPin, storedSalt);
    return testHash === storedHash;
  } catch (err) {
    console.error('Vault PIN verification error:', err);
    return false;
  }
}

/**
 * Updates the 6-digit Vault PIN.
 */
export async function updateVaultPin(newPin, salt = DEFAULT_SALT) {
  if (!/^\d{6}$/.test(newPin.trim())) {
    throw new Error('PIN must be exactly 6 numeric digits');
  }
  const newHash = await hashPin(newPin, salt);
  localStorage.setItem(STORAGE_KEYS.VAULT_PIN_HASH, newHash);
  localStorage.setItem(STORAGE_KEYS.VAULT_PIN_SALT, salt);
  return true;
}

/**
 * Checks if current user GPS location is within 500m of ANY saved trusted place.
 */
export function isUserInTrustedLocation(coords, familiarPlaces = []) {
  if (!coords || !coords.latitude || !coords.longitude || !familiarPlaces || familiarPlaces.length === 0) {
    return false;
  }

  for (const place of familiarPlaces) {
    if (place.latitude && place.longitude) {
      const distance = calculateHaversineDistanceMeters(
        coords.latitude,
        coords.longitude,
        place.latitude,
        place.longitude
      );
      if (distance <= TRUSTED_RADIUS_METERS) {
        return true;
      }
    }
  }

  return false;
}

// Alias for convenience
export const isWithinTrustedLocation = isUserInTrustedLocation;

/**
 * Retrieves pending security change if any is queued.
 */
export function getPendingSecurityChange() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_SECURITY_CHANGE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Queues a pending security change with the appropriate delay.
 */
export function queueSecurityChange(arg1, arg2, arg3) {
  let type, payload, isDevMode;
  if (typeof arg1 === 'object' && arg1 !== null && arg1.type) {
    type = arg1.type;
    payload = arg1.payload;
    isDevMode = arg1.isDevMode || false;
  } else {
    type = arg1;
    payload = arg2;
    isDevMode = arg3 || false;
  }
  const delaySec = isDevMode ? DEV_SECURITY_DELAY_SECONDS : SECURITY_DELAY_SECONDS;
  const now = Date.now();
  const pending = {
    id: `sec-${now}`,
    type,
    payload,
    queuedAt: now,
    delaySeconds: delaySec,
    unlocksAt: now + delaySec * 1000,
    status: 'pending'
  };
  localStorage.setItem(STORAGE_KEYS.PENDING_SECURITY_CHANGE, JSON.stringify(pending));
  return pending;
}

/**
 * Cancels any active pending security change.
 */
export function cancelPendingSecurityChange() {
  localStorage.removeItem(STORAGE_KEYS.PENDING_SECURITY_CHANGE);
}
