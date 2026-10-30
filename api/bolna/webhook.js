/**
 * POST /api/bolna/webhook
 * 
 * Webhook receiver for Bolna AI Call Lifecycle & Transcription Events.
 * Processes call termination, transcripts, and structured extractions (e.g. user response).
 */

import { store } from '../_store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    
    // Bolna webhook structures commonly contain:
    // event, execution_id, agent_id, status, transcript, extractions, user_data
    const {
      execution_id,
      agent_id,
      status,
      transcript,
      extractions,
      user_data,
      call_duration
    } = payload;

    console.log(`[BOLNA WEBHOOK] Execution: ${execution_id} | Status: ${status}`);

    // If call completed, inspect transcript or extraction for safe-word or distress
    let analyzedStatus = 'PENDING';
    if (status === 'completed' || status === 'done') {
      analyzedStatus = 'CALL_COMPLETED';
      
      const transcriptText = (typeof transcript === 'string' ? transcript : JSON.stringify(transcript || '')).toLowerCase();
      
      // Check if user confirmed safety in the call
      if (transcriptText.includes('safe') || transcriptText.includes('fine') || transcriptText.includes('ok')) {
        analyzedStatus = 'USER_CONFIRMED_SAFE';
      } else if (transcriptText.includes('help') || transcriptText.includes('bachao') || transcriptText.includes('danger')) {
        analyzedStatus = 'USER_CONFIRMED_DURESS';
      }
    }

    return res.status(200).json({
      received: true,
      executionId: execution_id,
      agentId: agent_id,
      analyzedStatus,
      duration: call_duration || 0,
      timestamp: Date.now()
    });
  } catch (err) {
    return res.status(500).json({ error: 'Webhook processing error', details: err.message });
  }
}
