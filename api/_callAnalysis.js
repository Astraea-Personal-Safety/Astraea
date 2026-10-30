/**
 * Astraea Backend - Bolna call transcript analysis (pure functions, unit-tested)
 *
 * Design notes:
 * - Only the *callee's* lines are analysed when the transcript carries speaker
 *   labels. The AI agent's own script says things like "are you safe?" and must
 *   never be mistaken for the user confirming safety.
 * - Distress always wins over reassurance (fail-safe): "I'm safe but please help"
 *   is treated as duress.
 * - Negations ("not safe", "nahi theek") are treated as distress, and
 *   "no need for help" is neutralised before keyword matching.
 */

const AGENT_ROLES = ['assistant', 'agent', 'bot', 'ai', 'system'];
const CALLEE_ROLES = ['user', 'human', 'customer', 'recipient', 'caller', 'callee'];

const DURESS_PATTERNS = [
  /\bhelp\b/, /\bbachao\b/, /\bbachaao\b/, /\bmadad\b/, /\bdanger\b/, /\bunsafe\b/,
  /\bfollowing me\b/, /\bscared\b/, /\bafraid\b/, /\bkidnap\w*\b/, /\battack\w*\b/,
  /\bthreat\w*\b/, /\bdarr\b/, /\bdar lag\b/, /\bpolice\b/,
  /\b(?:not|never|nahi|nahin|n't)\s+(?:\w+\s+)?(?:safe|fine|ok|okay|good|theek|surakshit)\b/
];

const NEUTRALISERS = [
  /\b(?:no|don'?t|do not|doesn'?t|not)\s+(?:need|want|require)\s+(?:for\s+|any\s+)?(?:help|police)\b/g,
  /\bno\s+(?:help|danger|problem)\b/g,
  /\bkoi\s+(?:problem|danger)\s+nahi\b/g,
  /\bmadad\s+ki\s+zaroorat\s+nahi\b/g
];

const SAFE_PATTERNS = [
  /\bsafe\b/, /\bfine\b/, /\bok\b/, /\bokay\b/, /\ball good\b/, /\bi'?m good\b/, /\bi am good\b/,
  /\breached\b/, /\bhome\b/, /\btheek\b/, /\bsurakshit\b/, /\bsab theek\b/
];

const WILL_ASSIST_PATTERNS = [
  /\bon my way\b/, /\bi'?m coming\b/, /\bi am coming\b/, /\bcoming now\b/,
  /\bi(?:'ll| will) (?:go|call|check|reach|find|head)\b/, /\bcalling (?:the )?(?:police|him|her|them)\b/,
  /\bwill call\b/, /\bmain (?:ja|aa|call)\b/, /\bja raha\b/, /\bja rahi\b/, /\bpahunch\b/, /\breaching\b/
];

const ACK_PATTERNS = [/\byes\b/, /\bhaan\b/, /\bha\b/, /\bok\b/, /\bokay\b/, /\bunderstood\b/, /\bgot it\b/, /\btheek hai\b/];

const DECLINE_PATTERNS = [/\bwrong number\b/, /\bcan'?t\b/, /\bcannot\b/, /\bwon'?t\b/, /\bunable\b/, /\bnot able\b/];

const UNREACHED_STATUSES = ['no-answer', 'no_answer', 'busy', 'failed', 'canceled', 'cancelled', 'error', 'balance-low', 'stopped', 'voicemail'];
const ENDED_STATUSES = ['completed', 'done', 'call-disconnected', 'call_disconnected', 'ended'];

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[“”"]/g, ' ')
    .replace(/[^a-z0-9'\sऀ-ॿ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts the text spoken by the person who answered the call.
 * Accepts: plain string, "role: text" multi-line string, or [{ role, content|text|message }].
 * Falls back to the full text when no speaker labels are present.
 */
export function extractCalleeText(transcript) {
  if (transcript == null) return '';

  if (Array.isArray(transcript)) {
    const labelled = transcript
      .map(t => (typeof t === 'string' ? { role: '', text: t } : {
        role: String(t.role || t.speaker || '').toLowerCase(),
        text: t.content ?? t.text ?? t.message ?? ''
      }));
    const callee = labelled.filter(t => CALLEE_ROLES.includes(t.role)).map(t => t.text);
    if (callee.length > 0) return callee.join(' ');
    const unlabelled = labelled.filter(t => !AGENT_ROLES.includes(t.role)).map(t => t.text);
    return unlabelled.join(' ');
  }

  if (typeof transcript === 'object') {
    return extractCalleeText(transcript.messages || transcript.turns || JSON.stringify(transcript));
  }

  const text = String(transcript);
  const lines = text.split(/\r?\n/);
  const roleLine = /^\s*([a-z ]{2,12})\s*:\s*(.*)$/i;
  const hasLabels = lines.some(l => {
    const m = l.match(roleLine);
    return m && [...AGENT_ROLES, ...CALLEE_ROLES].includes(m[1].trim().toLowerCase());
  });
  if (!hasLabels) return text;

  const calleeLines = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(roleLine);
    const role = m ? m[1].trim().toLowerCase() : null;
    if (role && [...AGENT_ROLES, ...CALLEE_ROLES].includes(role)) {
      current = CALLEE_ROLES.includes(role) ? 'callee' : 'agent';
      if (current === 'callee') calleeLines.push(m[2]);
    } else if (current === 'callee') {
      calleeLines.push(line);
    }
  }
  return calleeLines.join(' ');
}

/** Classifies the callee's words: 'DURESS' | 'SAFE' | 'NONE'. */
export function classifySafety(calleeText) {
  let t = normalizeText(calleeText);
  if (!t) return 'NONE';
  for (const re of NEUTRALISERS) t = t.replace(re, ' ');
  if (DURESS_PATTERNS.some(re => re.test(t))) return 'DURESS';
  if (SAFE_PATTERNS.some(re => re.test(t))) return 'SAFE';
  return 'NONE';
}

/** For alert calls to an emergency contact: did they commit to helping? */
export function classifyContactResponse(calleeText) {
  const t = normalizeText(calleeText);
  if (!t) return 'NO_RESPONSE';
  if (WILL_ASSIST_PATTERNS.some(re => re.test(t))) return 'WILL_ASSIST';
  if (DECLINE_PATTERNS.some(re => re.test(t))) return 'DECLINED';
  if (ACK_PATTERNS.some(re => re.test(t))) return 'ACKNOWLEDGED';
  return 'UNCLEAR';
}

export function mapCallStatus(status) {
  const s = String(status || '').toLowerCase();
  if (ENDED_STATUSES.includes(s)) return 'ENDED';
  if (UNREACHED_STATUSES.includes(s)) return 'UNREACHED';
  return 'IN_PROGRESS';
}

/**
 * Turns a raw Bolna webhook payload into a processed result.
 * @param {object} payload   Raw Bolna webhook body
 * @param {string} callType  'checkin' | 'alert'
 */
export function analyzeCall(payload, callType = 'checkin') {
  const lifecycle = mapCallStatus(payload.status);

  if (lifecycle === 'IN_PROGRESS') {
    return { analyzedStatus: 'PENDING', lifecycle, contactResponse: null, contactAcknowledged: false, terminal: false };
  }
  if (lifecycle === 'UNREACHED') {
    return { analyzedStatus: 'CALL_UNANSWERED', lifecycle, contactResponse: 'NO_RESPONSE', contactAcknowledged: false, terminal: true };
  }

  const callee = extractCalleeText(payload.transcript);

  if (callType === 'alert') {
    const contactResponse = classifyContactResponse(callee);
    const contactAcknowledged = contactResponse === 'WILL_ASSIST' || contactResponse === 'ACKNOWLEDGED';
    let analyzedStatus = 'CALL_COMPLETED';
    if (contactResponse === 'WILL_ASSIST') analyzedStatus = 'CONTACT_WILL_ASSIST';
    else if (contactResponse === 'ACKNOWLEDGED') analyzedStatus = 'CONTACT_ACKNOWLEDGED';
    else if (contactResponse === 'NO_RESPONSE') analyzedStatus = 'CALL_UNANSWERED';
    return { analyzedStatus, lifecycle, contactResponse, contactAcknowledged, terminal: true };
  }

  const safety = classifySafety(callee);
  let analyzedStatus = 'CALL_COMPLETED';
  if (safety === 'DURESS') analyzedStatus = 'USER_CONFIRMED_DURESS';
  else if (safety === 'SAFE') analyzedStatus = 'USER_CONFIRMED_SAFE';
  else if (!normalizeText(callee)) analyzedStatus = 'CALL_UNANSWERED';
  return { analyzedStatus, lifecycle, contactResponse: null, contactAcknowledged: false, terminal: true };
}
