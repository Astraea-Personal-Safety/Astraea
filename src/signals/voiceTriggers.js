/**
 * Astraea - Multi-Language Voice Trigger Dictionary & Classifier
 * 
 * Languages Supported:
 * - English (en-IN / en-US)
 * - Hindi (hi-IN)
 * - Hinglish
 * 
 * Behavior:
 * - URGENT triggers: Spoken words indicating acute danger ("help", "bachao", "madad") -> Immediate Silent Escalation
 * - UNCERTAIN triggers: Spoken phrases indicating elevated unease ("i feel unsafe", "darr lag raha hai") -> Safety Check-In
 */

import { normalizePhrase, levenshteinDistance } from './useSpeechInteraction.js';

export const URGENT_TRIGGERS = [
  // English
  { phrase: 'help me', lang: 'English' },
  { phrase: 'astraea help', lang: 'English' },
  { phrase: 'emergency', lang: 'English' },
  { phrase: 'call for help', lang: 'English' },
  { phrase: 'code red', lang: 'English' },
  // Hindi
  { phrase: 'bachao', lang: 'Hindi' },
  { phrase: 'mujhe bachao', lang: 'Hindi' },
  { phrase: 'madad karo', lang: 'Hindi' },
  { phrase: 'madad chahiye', lang: 'Hindi' },
  // Hinglish
  { phrase: 'urgent help chahiye', lang: 'Hinglish' },
  { phrase: 'emergency hai', lang: 'Hinglish' }
];

export const UNCERTAIN_TRIGGERS = [
  // English
  { phrase: 'i feel unsafe', lang: 'English' },
  { phrase: 'this is not safe', lang: 'English' },
  { phrase: 'someone is following me', lang: 'English' },
  { phrase: 'i am being followed', lang: 'English' },
  { phrase: 'i feel scared', lang: 'English' },
  // Hindi
  { phrase: 'mujhe darr lag raha hai', lang: 'Hindi' },
  { phrase: 'yeh jagah theek nahi hai', lang: 'Hindi' },
  { phrase: 'koi peecha kar raha hai', lang: 'Hindi' },
  { phrase: 'darr lag raha hai', lang: 'Hindi' },
  { phrase: 'khatra lag raha hai', lang: 'Hindi' },
  // Hinglish
  { phrase: 'unsafe feel ho raha hai', lang: 'Hinglish' },
  { phrase: 'yeh area safe nahi lag raha', lang: 'Hinglish' },
  { phrase: 'koi follow kar raha hai', lang: 'Hinglish' }
];

/**
 * Classifies spoken transcript against multi-language safety trigger phrases.
 */
export function classifyVoiceTrigger(spokenTranscript) {
  const normSpoken = normalizePhrase(spokenTranscript);
  if (!normSpoken || normSpoken.length < 3) {
    return { matched: false };
  }

  // 1. Check Urgent triggers first (Priority 1)
  for (const item of URGENT_TRIGGERS) {
    const normTarget = normalizePhrase(item.phrase);
    if (normSpoken.includes(normTarget) || levenshteinDistance(normSpoken, normTarget) <= 1) {
      return {
        matched: true,
        type: 'URGENT',
        matchedPhrase: item.phrase,
        language: item.lang
      };
    }
  }

  // 2. Check Uncertain triggers (Priority 2)
  for (const item of UNCERTAIN_TRIGGERS) {
    const normTarget = normalizePhrase(item.phrase);
    if (normSpoken.includes(normTarget) || levenshteinDistance(normSpoken, normTarget) <= 1) {
      return {
        matched: true,
        type: 'CHECKIN',
        matchedPhrase: item.phrase,
        language: item.lang
      };
    }
  }

  return { matched: false };
}
