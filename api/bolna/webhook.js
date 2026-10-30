/**
 * POST /api/bolna/webhook
 *
 * Webhook receiver for Bolna AI call lifecycle & transcript events.
 * Configure it on BOTH Bolna agents (Check-In and Emergency Alert):
 *   https://<your-domain>/api/bolna/webhook?secret=<BOLNA_WEBHOOK_SECRET>
 *
 * What it does:
 * - Optionally authenticates the request with BOLNA_WEBHOOK_SECRET (query `secret`
 *   or `x-webhook-secret` header). If the env var is unset, requests are accepted.
 * - Analyses ONLY the callee's side of the transcript (see api/_callAnalysis.js).
 * - Stores the processed result keyed by execution id and, when the call can be
 *   linked to a session, records a call summary on that session.
 * - Never auto-stands-down an SOS: a spoken "I'm safe" on a phone call can be
 *   coerced, so the safe-word flow in the app remains the only way to stand down.
 * - Transcripts are stored privately (truncated) and never exposed by /api/track.
 */

import crypto from 'node:crypto';
import { store } from '../_store.js';
import { getEnv, parseBody } from '../_env.js';
import { analyzeCall } from '../_callAnalysis.js';

function secretMatches(provided, expected) {
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Webhook-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expectedSecret = getEnv('BOLNA_WEBHOOK_SECRET');
  if (expectedSecret) {
    const provided = (req.query && req.query.secret) || (req.headers && req.headers['x-webhook-secret']);
    if (!secretMatches(provided, expectedSecret)) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }
  }

  try {
    const payload = parseBody(req);

    // Bolna payloads commonly contain: id/execution_id, agent_id, status, transcript,
    // extracted_data, user_data / context_details.recipient_data, conversation_time
    const executionId = payload.execution_id || payload.id || null;
    const agentId = payload.agent_id || null;
    const status = payload.status;
    const callDuration = payload.call_duration ?? payload.conversation_time ?? payload.conversation_duration ?? 0;
    const userData = payload.user_data || payload.context_details?.recipient_data || {};

    console.log(`[BOLNA WEBHOOK] Execution: ${executionId} | Status: ${status}`);

    // Link back to what we dispatched (call type + session), falling back to payload hints
    const dispatched = executionId ? await store.getCallResult(executionId) : null;
    const alertAgentId = getEnv('BOLNA_ALERT_AGENT_ID', 'f2a46049-af9e-4ef3-8021-d42c665046c3');
    const callType =
      dispatched?.callType ||
      userData.call_type ||
      (agentId && agentId === alertAgentId ? 'alert' : 'checkin');
    const sessionId = dispatched?.sessionId || userData.session_id || '';

    const analysis = analyzeCall(payload, callType);

    // Do not let a late "in progress" event overwrite an already-final result
    if (!analysis.terminal && dispatched?.terminal) {
      return res.status(200).json({
        received: true,
        executionId,
        agentId,
        callType,
        analyzedStatus: dispatched.analyzedStatus,
        duration: dispatched.duration || 0,
        timestamp: Date.now()
      });
    }

    const transcriptText = typeof payload.transcript === 'string'
      ? payload.transcript
      : JSON.stringify(payload.transcript || '');

    if (executionId) {
      await store.saveCallResult(executionId, {
        ...(dispatched || {}),
        callType,
        agentId,
        sessionId,
        status: String(status || ''),
        analyzedStatus: analysis.analyzedStatus,
        contactResponse: analysis.contactResponse,
        contactAcknowledged: analysis.contactAcknowledged,
        terminal: analysis.terminal,
        duration: callDuration,
        transcript: transcriptText.slice(0, 4000)
      });
    }

    if (sessionId && analysis.terminal) {
      const summary = {
        executionId,
        callType,
        analyzedStatus: analysis.analyzedStatus,
        at: Date.now()
      };
      await store.createOrUpdateSession(sessionId, {
        lastCall: summary,
        ...(callType === 'alert' && analysis.contactAcknowledged ? { contactAcknowledged: true } : {})
      });
    }

    return res.status(200).json({
      received: true,
      executionId,
      agentId,
      callType,
      analyzedStatus: analysis.analyzedStatus,
      contactResponse: analysis.contactResponse,
      duration: callDuration,
      timestamp: Date.now()
    });
  } catch (err) {
    return res.status(500).json({ error: 'Webhook processing error', details: err.message });
  }
}
