import { useState } from 'react';
import { useApp } from '../state/useApp';
import { sendTelegramAlert, sendDirectWhatsAppAlert } from '../engine/deliveryService';
import './TrustedCircleManager.css';

export default function TrustedCircleManager() {
  const {
    trustedCircle,
    setTrustedCircle,
    mode,
    setMode,
    webhookUrl,
    setWebhookUrl,
    telegramConfig,
    setTelegramConfig,
    whatsappConfig,
    setWhatsAppConfig,
    triggerTestAlert
  } = useApp();

  const [contacts, setContacts] = useState(
    trustedCircle.length > 0 ? trustedCircle : [
      { id: '1', name: '', phone: '', relationship: 'Family', channels: ['sms'] },
      { id: '2', name: '', phone: '', relationship: 'Friend', channels: ['sms'] }
    ]
  );

  const [inputWebhook, setInputWebhook] = useState(webhookUrl || '');
  const [inputTelegram, setInputTelegram] = useState(telegramConfig || { botToken: '', chatId: '', enabled: false });
  const [inputWhatsApp, setInputWhatsApp] = useState(whatsappConfig || {
    enabled: false,
    gatewayType: 'callmebot',
    apiKey: '',
    accountSid: '',
    authToken: '',
    fromNumber: '',
    endpointUrl: ''
  });
  const [telegramTestStatus, setTelegramTestStatus] = useState(null);
  const [whatsAppTestStatus, setWhatsAppTestStatus] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleContactChange = (index, field, value) => {
    setContacts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddContact = () => {
    if (contacts.length >= 5) return;
    setContacts(prev => [
      ...prev,
      { id: `${Date.now()}`, name: '', phone: '', relationship: 'Contact', channels: ['sms'] }
    ]);
  };

  const handleRemoveContact = (index) => {
    setContacts(prev => prev.filter((_, i) => i !== index));
  };

  const handleTestTelegram = async () => {
    if (!inputTelegram.botToken || !inputTelegram.chatId) {
      setTelegramTestStatus({ ok: false, msg: 'Please enter Bot Token & Chat ID' });
      return;
    }
    setTelegramTestStatus({ ok: true, msg: 'Calling Telegram API...' });
    const res = await sendTelegramAlert({
      botToken: inputTelegram.botToken,
      chatId: inputTelegram.chatId,
      messageText: '🚨 <b>ASTRAEA TEST DISPATCH</b>\nLive integration verified with Telegram Bot REST API!'
    });
    if (res.success) {
      setTelegramTestStatus({ ok: true, msg: '✓ Message received on Telegram!' });
    } else {
      setTelegramTestStatus({ ok: false, msg: `✕ Error: ${res.error || 'Check bot permissions'}` });
    }
  };

  const handleTestWhatsApp = async () => {
    const testPhone = contacts[0]?.phone || '';
    if (!testPhone && !inputWhatsApp.endpointUrl) {
      setWhatsAppTestStatus({ ok: false, msg: 'Please enter a phone number in contact #1 or custom endpoint' });
      return;
    }
    setWhatsAppTestStatus({ ok: true, msg: 'Calling WhatsApp Gateway API...' });
    const res = await sendDirectWhatsAppAlert({
      phone: testPhone,
      messageText: '🚨 *ASTRAEA DIRECT EMERGENCY ALERT*\nAutomated crisis dispatch verified without user tapping Send!',
      gatewayType: inputWhatsApp.gatewayType,
      apiKey: inputWhatsApp.apiKey,
      accountSid: inputWhatsApp.accountSid,
      authToken: inputWhatsApp.authToken,
      fromNumber: inputWhatsApp.fromNumber,
      endpointUrl: inputWhatsApp.endpointUrl
    });
    if (res.success) {
      setWhatsAppTestStatus({ ok: true, msg: `✓ Automated alert sent to ${testPhone || 'endpoint'}!` });
    } else {
      setWhatsAppTestStatus({ ok: false, msg: `✕ Error: ${res.error || 'Failed to dispatch'}` });
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    const valid = contacts.filter(c => c.name.trim());
    setTrustedCircle(valid);
    setWebhookUrl(inputWebhook.trim());
    setTelegramConfig(inputTelegram);
    setWhatsAppConfig(inputWhatsApp);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="circle-manager-card" id="trusted-circle-manager">
      <div className="circle-manager-header">
        <span className="circle-manager-icon">👥</span>
        <div>
          <h3>Trusted Circle & Emergency Recipients</h3>
          <p>Manage emergency contacts who receive live transit updates and SOS broadcasts</p>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="sharing-mode-toggle-block">
        <label>Sharing Mode Profile:</label>
        <div className="mode-toggle-segmented">
          <button
            type="button"
            className={`btn-mode-seg ${mode === 'Solo' ? 'active' : ''}`}
            onClick={() => setMode('Solo')}
          >
            👤 Solo Mode (Strict On-Device)
          </button>
          <button
            type="button"
            className={`btn-mode-seg ${mode === 'Connected' ? 'active' : ''}`}
            onClick={() => setMode('Connected')}
          >
            👥 Connected Mode (Circle Active)
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="circle-contacts-form">
        <div className="contacts-list-container">
          <div className="contacts-list-header">
            <h4>Trusted Contacts ({contacts.filter(c => c.name.trim()).length}/5)</h4>
            <button
              type="button"
              className="btn-add-contact"
              onClick={handleAddContact}
              disabled={contacts.length >= 5}
            >
              + Add Contact
            </button>
          </div>

          {contacts.map((contact, idx) => (
            <div key={contact.id || idx} className="contact-edit-card">
              <div className="contact-row-top">
                <span className="contact-number-pill">#{idx + 1}</span>
                <input
                  type="text"
                  placeholder="Contact Name (e.g. Maya)"
                  value={contact.name}
                  onChange={(e) => handleContactChange(idx, 'name', e.target.value)}
                  className="contact-name-field"
                  required={idx === 0}
                />
                <select
                  value={contact.relationship || 'Family'}
                  onChange={(e) => handleContactChange(idx, 'relationship', e.target.value)}
                  className="contact-relation-select"
                >
                  <option value="Family">Family / Parent</option>
                  <option value="Partner">Partner / Spouse</option>
                  <option value="Friend">Close Friend</option>
                  <option value="Colleague">Colleague / Roommate</option>
                </select>
                {contacts.length > 1 && (
                  <button
                    type="button"
                    className="btn-remove-contact"
                    onClick={() => handleRemoveContact(idx)}
                    title="Remove contact"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="contact-row-sub">
                <input
                  type="tel"
                  placeholder="Phone number (+91 / +1...)"
                  value={contact.phone}
                  onChange={(e) => handleContactChange(idx, 'phone', e.target.value)}
                  className="contact-phone-field"
                />
                <span className="channel-pill">SMS & WhatsApp</span>
              </div>
            </div>
          ))}
        </div>

        {/* Webhook Configuration for developers / custom integrations */}
        <div className="webhook-config-block">
          <label htmlFor="webhook-url-input">Custom Webhook Dispatch URL (Optional):</label>
          <p className="webhook-hint">
            Astraea sends a POST JSON payload to this endpoint on every SOS trigger (compatible with Zapier, Twilio Functions, or Slack).
          </p>
          <input
            id="webhook-url-input"
            type="url"
            placeholder="https://your-api.com/webhook/astraea-sos"
            value={inputWebhook}
            onChange={(e) => setInputWebhook(e.target.value)}
            className="webhook-input-field"
          />
        </div>

        {/* Telegram Bot Direct Dispatch REST API */}
        <div className="webhook-config-block" style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <label htmlFor="telegram-token-input" style={{ margin: 0, fontWeight: 600 }}>
              ✈️ Direct Telegram Bot REST API Dispatch:
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={inputTelegram.enabled}
                onChange={(e) => setInputTelegram(prev => ({ ...prev, enabled: e.target.checked }))}
              />
              Enable Telegram Alerts
            </label>
          </div>
          <p className="webhook-hint">
            Astraea sends real-time emergency notifications directly to your phone via Telegram Bot API (<code>api.telegram.org</code>).
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
            <input
              id="telegram-token-input"
              type="password"
              placeholder="Telegram Bot Token (e.g. 123456:ABC-DEF1234...)"
              value={inputTelegram.botToken}
              onChange={(e) => setInputTelegram(prev => ({ ...prev, botToken: e.target.value }))}
              className="webhook-input-field"
            />
            <input
              id="telegram-chat-input"
              type="text"
              placeholder="Chat ID (e.g. 987654321)"
              value={inputTelegram.chatId}
              onChange={(e) => setInputTelegram(prev => ({ ...prev, chatId: e.target.value }))}
              className="webhook-input-field"
            />
          </div>
          <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn-test-alert"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
              onClick={handleTestTelegram}
            >
              Test Telegram API Ping
            </button>
            {telegramTestStatus && (
              <span style={{ fontSize: '0.8rem', color: telegramTestStatus.ok ? '#10b981' : '#ef4444' }}>
                {telegramTestStatus.msg}
              </span>
            )}
          </div>
        </div>

        {/* Direct Automated WhatsApp Dispatch REST API (Zero User Interaction) */}
        <div className="webhook-config-block" style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <label style={{ margin: 0, fontWeight: 600, color: '#25d366' }}>
              💬 Direct Automated WhatsApp Dispatch (Zero-Tap Cloud Gateway):
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={inputWhatsApp.enabled}
                onChange={(e) => setInputWhatsApp(prev => ({ ...prev, enabled: e.target.checked }))}
              />
              Enable Direct WhatsApp
            </label>
          </div>
          <p className="webhook-hint">
            <strong>CRITICAL CRISIS DEFENSE:</strong> In a real emergency or coercion event, the victim cannot safely unlock their phone and press 'Send' in WhatsApp. With this enabled, Astraea dispatches emergency alerts <strong>directly and silently to your circle's WhatsApp</strong> via Cloud Gateway API without opening any app.
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginTop: '0.5rem' }}>
            <select
              value={inputWhatsApp.gatewayType}
              onChange={(e) => setInputWhatsApp(prev => ({ ...prev, gatewayType: e.target.value }))}
              className="webhook-input-field"
            >
              <option value="callmebot">CallMeBot Gateway (Free)</option>
              <option value="twilio">Twilio WhatsApp API</option>
              <option value="custom">Custom Webhook / Meta API</option>
            </select>

            {inputWhatsApp.gatewayType === 'callmebot' && (
              <input
                type="password"
                placeholder="CallMeBot WhatsApp API Key (Free from callmebot.com)"
                value={inputWhatsApp.apiKey}
                onChange={(e) => setInputWhatsApp(prev => ({ ...prev, apiKey: e.target.value }))}
                className="webhook-input-field"
              />
            )}

            {inputWhatsApp.gatewayType === 'twilio' && (
              <input
                type="text"
                placeholder="Twilio Account SID"
                value={inputWhatsApp.accountSid}
                onChange={(e) => setInputWhatsApp(prev => ({ ...prev, accountSid: e.target.value }))}
                className="webhook-input-field"
              />
            )}

            {inputWhatsApp.gatewayType === 'custom' && (
              <input
                type="url"
                placeholder="https://your-api.com/whatsapp/send-alert"
                value={inputWhatsApp.endpointUrl}
                onChange={(e) => setInputWhatsApp(prev => ({ ...prev, endpointUrl: e.target.value }))}
                className="webhook-input-field"
              />
            )}
          </div>

          {inputWhatsApp.gatewayType === 'twilio' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
              <input
                type="password"
                placeholder="Twilio Auth Token"
                value={inputWhatsApp.authToken}
                onChange={(e) => setInputWhatsApp(prev => ({ ...prev, authToken: e.target.value }))}
                className="webhook-input-field"
              />
              <input
                type="text"
                placeholder="From Number (e.g. +14155238886)"
                value={inputWhatsApp.fromNumber}
                onChange={(e) => setInputWhatsApp(prev => ({ ...prev, fromNumber: e.target.value }))}
                className="webhook-input-field"
              />
            </div>
          )}

          <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn-test-alert"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', borderColor: '#25d366', color: '#25d366' }}
              onClick={handleTestWhatsApp}
            >
              Test Direct WhatsApp Dispatch
            </button>
            {whatsAppTestStatus && (
              <span style={{ fontSize: '0.8rem', color: whatsAppTestStatus.ok ? '#10b981' : '#ef4444' }}>
                {whatsAppTestStatus.msg}
              </span>
            )}
          </div>
        </div>

        <div className="circle-save-row">
          {saveSuccess && <span className="circle-save-success">✓ Circle updated & armed</span>}
          <button
            type="button"
            className="btn-test-alert"
            onClick={triggerTestAlert}
          >
            ⚡ Send Test Notification
          </button>
          <button type="submit" className="btn-save-circle">
            Save Circle Profile
          </button>
        </div>
      </form>
    </div>
  );
}
