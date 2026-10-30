/**
 * POST /api/dispatch/whatsapp
 * Body: { phone, messageText }
 *
 * Server-side WhatsApp relay using credentials from the environment:
 *   - CallMeBot (free):  CALLMEBOT_API_KEY
 *   - Twilio WhatsApp:   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER
 *                        (falls back to TWILIO_PHONE_NUMBER)
 * CallMeBot is preferred when its key is set.
 *
 * Abuse guards (the endpoint is public, the credentials are yours):
 *   - recipient must be listed in VERIFIED_PHONE_NUMBERS (empty list => nothing is sent)
 *   - max 1 message per recipient per 10 seconds, text capped at 1000 characters
 *
 * Unlike the browser's no-cors CallMeBot call, this reads the real gateway response,
 * so failures (bad API key, unregistered number) are reported instead of hidden.
 */

import { store } from '../_store.js';
import { getEnv, getVerifiedPhones, normalizePhone, parseBody } from '../_env.js';

async function sendViaCallMeBot({ phone, text, apiKey }) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  const body = await res.text().catch(() => '');
  const ok = res.ok && /queued|sent/i.test(body) && !/error|invalid/i.test(body);
  return { ok, status: res.status, detail: body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) };
}

async function sendViaTwilio({ phone, text, accountSid, authToken, from }) {
  const wa = n => (n.startsWith('whatsapp:') ? n : `whatsapp:${n}`);
  const form = new URLSearchParams({ To: wa(phone), From: wa(from), Body: text });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form.toString()
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, detail: data.message || data.status || '' };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = parseBody(req);
    const phone = normalizePhone(body.phone);
    const messageText = body.messageText;

    if (!phone || !messageText || typeof messageText !== 'string') {
      return res.status(400).json({ success: false, error: 'phone and messageText are required' });
    }

    const callMeBotKey = getEnv('CALLMEBOT_API_KEY');
    const twilioSid = getEnv('TWILIO_ACCOUNT_SID');
    const twilioToken = getEnv('TWILIO_AUTH_TOKEN');
    const twilioFrom = getEnv('TWILIO_WHATSAPP_NUMBER') || getEnv('TWILIO_PHONE_NUMBER');
    const twilioReady = Boolean(twilioSid && twilioToken && twilioFrom);

    if (!callMeBotKey && !twilioReady) {
      return res.status(503).json({ success: false, configured: false, error: 'No WhatsApp gateway is configured on the server' });
    }

    if (!getVerifiedPhones().includes(phone)) {
      return res.status(403).json({ success: false, error: 'Recipient is not in VERIFIED_PHONE_NUMBERS' });
    }

    if (!(await store.tryAcquire(`whatsapp:${phone}`, 10))) {
      return res.status(429).json({ success: false, error: 'WhatsApp relay cooldown active (10s)' });
    }

    const text = messageText.slice(0, 1000);
    const result = callMeBotKey
      ? await sendViaCallMeBot({ phone, text, apiKey: callMeBotKey })
      : await sendViaTwilio({ phone, text, accountSid: twilioSid, authToken: twilioToken, from: twilioFrom });

    if (!result.ok) {
      return res.status(502).json({ success: false, gateway: callMeBotKey ? 'callmebot' : 'twilio', error: result.detail || `Gateway HTTP ${result.status}` });
    }
    return res.status(200).json({ success: true, gateway: callMeBotKey ? 'callmebot' : 'twilio', detail: result.detail });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
