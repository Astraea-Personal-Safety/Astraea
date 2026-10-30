/**
 * POST /api/dispatch/telegram
 * Body: { messageText }
 *
 * Server-side Telegram relay that uses TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID from the
 * environment, so the bot token never has to live in the browser. The client calls this
 * when the user has not entered their own Telegram credentials in Settings.
 *
 * Abuse guard: max 1 message per 10 seconds, text capped at 1500 characters.
 */

import { store } from '../_store.js';
import { getEnv, parseBody } from '../_env.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messageText } = parseBody(req);
    if (!messageText || typeof messageText !== 'string') {
      return res.status(400).json({ success: false, error: 'messageText is required' });
    }

    const botToken = getEnv('TELEGRAM_BOT_TOKEN');
    const chatId = getEnv('TELEGRAM_CHAT_ID');
    if (!botToken || !chatId) {
      return res.status(503).json({ success: false, configured: false, error: 'Telegram is not configured on the server' });
    }

    if (!(await store.tryAcquire('telegram', 10))) {
      return res.status(429).json({ success: false, error: 'Telegram relay cooldown active (10s)' });
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: messageText.slice(0, 1500) })
    });
    const data = await tgRes.json().catch(() => ({}));

    if (!data.ok) {
      return res.status(502).json({ success: false, error: data.description || `Telegram HTTP ${tgRes.status}` });
    }
    return res.status(200).json({ success: true, gateway: 'telegram' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
