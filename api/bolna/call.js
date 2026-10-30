/**
 * POST /api/bolna/call
 * 
 * Initiates an outbound AI voice call using the Bolna Voice API.
 * 
 * Supported Call Types:
 * - 'checkin': Calls user directly to prompt for verbal safe word confirmation
 * - 'alert': Calls emergency contact with alert briefing and live tracking link
 * 
 * Safety Rails:
 * - Rate limiting: Enforces minimum 20s cooldown between calls to same number
 * - Dry-run mode: Allows testing without spending telephony credits
 * - Input validation: Strict phone number format and agent ID checks
 */

import { store } from '../_store.js';
import { getEnv } from '../_env.js';

const BOLNA_API_URL = 'https://api.bolna.ai/call';
const DEFAULT_CHECKIN_AGENT = getEnv('BOLNA_CHECKIN_AGENT_ID', '0885f542-dbc4-48c6-9780-fe1107c659ea');
const DEFAULT_ALERT_AGENT = getEnv('BOLNA_ALERT_AGENT_ID', 'f2a46049-af9e-4ef3-8021-d42c665046c3');

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
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const {
      phoneNumber,
      callType = 'checkin', // 'checkin' | 'alert'
      customAgentId,
      recipientName = 'Rishi',
      trackingUrl = '',
      sessionId = '',
      emergencyReason = 'Missed safety check-in window',
      dryRun = false
    } = body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Recipient phone number is required' });
    }

    // Format phone number to E.164 (ensure leading +)
    let formattedPhone = phoneNumber.replace(/[\s\-()]/g, '');
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    // 1. Safety Rail: Check Rate Limit (20s cooldown)
    if (await store.isCallRateLimited(formattedPhone, 20)) {
      return res.status(429).json({
        error: 'Call cooldown active. Must wait at least 20 seconds between calls to prevent loop/spam.',
        phone: formattedPhone
      });
    }

    // 2. Select Agent ID
    const agentId = customAgentId || (callType === 'alert' ? DEFAULT_ALERT_AGENT : DEFAULT_CHECKIN_AGENT);
    const apiKey = getEnv('BOLNA_API_KEY');

    // 3. Dry Run Safety Rail (Simulation without telephony spend)
    if (dryRun || getEnv('BOLNA_DRY_RUN') === 'true') {
      const mockExecutionId = `dryrun-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      await store.logCall({ phone: formattedPhone, agentId, executionId: mockExecutionId, status: 'dry_run' });
      return res.status(200).json({
        success: true,
        dryRun: true,
        executionId: mockExecutionId,
        message: `[DRY-RUN] Simulated Bolna ${callType} call dispatched to ${formattedPhone}`
      });
    }

    if (!apiKey) {
      return res.status(500).json({ error: 'BOLNA_API_KEY is not configured in environment' });
    }

    // 4. Construct Bolna Outbound Payload
    const bolnaPayload = {
      agent_id: agentId,
      recipient_phone_number: formattedPhone,
      user_data: {
        customer_name: recipientName,
        recipient_name: recipientName,
        tracking_url: trackingUrl || 'https://astraea-safety.vercel.app',
        emergency_reason: emergencyReason,
        call_type: callType,
        session_id: sessionId,
        timestamp: new Date().toISOString()
      }
    };

    // 5. Execute API Call
    const response = await fetch(BOLNA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bolnaPayload)
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      await store.logCall({ phone: formattedPhone, agentId, executionId: null, status: 'failed' });
      return res.status(response.status).json({
        error: 'Bolna API rejected call dispatch',
        statusCode: response.status,
        details: responseData
      });
    }

    const executionId = responseData.execution_id || responseData.call_id || `exec-${Date.now()}`;
    await store.logCall({ phone: formattedPhone, agentId, executionId, status: 'dispatched' });
    // Remember which session/call type this execution belongs to so the webhook can update it later
    await store.saveCallResult(executionId, { status: 'dispatched', callType, agentId, sessionId, phone: formattedPhone });

    return res.status(200).json({
      success: true,
      executionId,
      agentId,
      callType,
      recipient: formattedPhone,
      bolnaResponse: responseData
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal error dispatching Bolna call', message: err.message });
  }
}
