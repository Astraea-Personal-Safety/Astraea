/**
 * LocalStorage Helpers for Astraea (On-device persistence)
 * Core Design Principle 1: No server / No database — all state persists strictly in browser localStorage.
 */

const STORAGE_KEYS = {
  SAFE_WORD: 'astraea_safe_word',
  DURESS_WORD: 'astraea_duress_word',
  VOICE_SOS_PHRASE: 'astraea_voice_sos_phrase',
  ONBOARDED: 'astraea_onboarded',
  MODE: 'astraea_mode',
  TRUSTED_CIRCLE: 'astraea_circle',
  FAMILIAR_PLACES: 'astraea_places',
  SETTINGS: 'astraea_settings',
  PRIVACY_SETTINGS: 'astraea_privacy_settings',
  SAFETY_TIMELINE: 'astraea_timeline',
  WEBHOOK_URL: 'astraea_webhook_url',
  TELEGRAM_CONFIG: 'astraea_telegram_config',
  WHATSAPP_CONFIG: 'astraea_whatsapp_config',
  GEMINI_API_KEY: 'astraea_gemini_api_key',
};

const DEFAULT_PRIVACY = {
  micDistressEnabled: true,
  motionSensorEnabled: true,
  ttsVoiceEnabled: true,
  sttVoiceCommandsEnabled: true,
  autoLocationSharing: true,
  dataRetention: '7d', // 'session' | '24h' | '7d' | 'indefinite'
  highContrast: false,
  hapticsEnabled: true,
  audibleSiren: true,
  instantSosTap: false // if true, single tap triggers SOS without hold
};

export const storage = {
  getSafeWord: () => {
    try {
      return localStorage.getItem(STORAGE_KEYS.SAFE_WORD) || '';
    } catch {
      return '';
    }
  },

  setSafeWord: (word) => {
    try {
      localStorage.setItem(STORAGE_KEYS.SAFE_WORD, word);
      localStorage.setItem(STORAGE_KEYS.ONBOARDED, 'true');
    } catch {}
  },

  getDuressWord: () => {
    try {
      return localStorage.getItem(STORAGE_KEYS.DURESS_WORD) || '';
    } catch {
      return '';
    }
  },

  setDuressWord: (word) => {
    try {
      localStorage.setItem(STORAGE_KEYS.DURESS_WORD, word);
    } catch {}
  },

  getVoiceSosPhrase: () => {
    try {
      return localStorage.getItem(STORAGE_KEYS.VOICE_SOS_PHRASE) || 'ASTRAEA HELP ME';
    } catch {
      return 'ASTRAEA HELP ME';
    }
  },

  setVoiceSosPhrase: (phrase) => {
    try {
      localStorage.setItem(STORAGE_KEYS.VOICE_SOS_PHRASE, phrase);
    } catch {}
  },

  isOnboarded: () => {
    try {
      return localStorage.getItem(STORAGE_KEYS.ONBOARDED) === 'true' === 'true';
    } catch {
      return false;
    }
  },

  getMode: () => {
    try {
      return localStorage.getItem(STORAGE_KEYS.MODE) || 'Solo';
    } catch {
      return 'Solo';
    }
  },

  setMode: (mode) => {
    try {
      localStorage.setItem(STORAGE_KEYS.MODE, mode);
    } catch {}
  },

  getTrustedCircle: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRUSTED_CIRCLE);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  setTrustedCircle: (circle) => {
    try {
      localStorage.setItem(STORAGE_KEYS.TRUSTED_CIRCLE, JSON.stringify(circle));
    } catch {}
  },

  getFamiliarPlaces: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FAMILIAR_PLACES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  setFamiliarPlaces: (places) => {
    try {
      localStorage.setItem(STORAGE_KEYS.FAMILIAR_PLACES, JSON.stringify(places));
    } catch {}
  },

  getPrivacySettings: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRIVACY_SETTINGS);
      return data ? { ...DEFAULT_PRIVACY, ...JSON.parse(data) } : DEFAULT_PRIVACY;
    } catch {
      return DEFAULT_PRIVACY;
    }
  },

  setPrivacySettings: (settings) => {
    try {
      localStorage.setItem(STORAGE_KEYS.PRIVACY_SETTINGS, JSON.stringify(settings));
    } catch {}
  },

  getWebhookUrl: () => {
    try {
      return localStorage.getItem(STORAGE_KEYS.WEBHOOK_URL) || '';
    } catch {
      return '';
    }
  },

  setWebhookUrl: (url) => {
    try {
      localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, url);
    } catch {}
  },

  getTelegramConfig: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TELEGRAM_CONFIG);
      return data ? JSON.parse(data) : { botToken: '', chatId: '', enabled: false };
    } catch {
      return { botToken: '', chatId: '', enabled: false };
    }
  },

  setTelegramConfig: (cfg) => {
    try {
      localStorage.setItem(STORAGE_KEYS.TELEGRAM_CONFIG, JSON.stringify(cfg));
    } catch {}
  },

  getWhatsAppConfig: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WHATSAPP_CONFIG);
      return data ? JSON.parse(data) : {
        enabled: false,
        gatewayType: 'callmebot', // 'callmebot' | 'twilio' | 'custom'
        apiKey: '',
        accountSid: '',
        authToken: '',
        fromNumber: '',
        endpointUrl: ''
      };
    } catch {
      return { enabled: false, gatewayType: 'callmebot', apiKey: '', accountSid: '', authToken: '', fromNumber: '', endpointUrl: '' };
    }
  },

  setWhatsAppConfig: (cfg) => {
    try {
      localStorage.setItem(STORAGE_KEYS.WHATSAPP_CONFIG, JSON.stringify(cfg));
    } catch {}
  },

  getGeminiApiKey: () => {
    try {
      return localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY) || '';
    } catch {
      return '';
    }
  },

  setGeminiApiKey: (key) => {
    try {
      localStorage.setItem(STORAGE_KEYS.GEMINI_API_KEY, key);
    } catch {}
  },

  getTimelineEvents: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SAFETY_TIMELINE);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveTimelineEvents: (events) => {
    try {
      localStorage.setItem(STORAGE_KEYS.SAFETY_TIMELINE, JSON.stringify(events.slice(-100)));
    } catch {}
  },

  clearTimeline: () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.SAFETY_TIMELINE);
    } catch {}
  },

  resetOnboarding: () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.SAFE_WORD);
      localStorage.removeItem(STORAGE_KEYS.DURESS_WORD);
      localStorage.removeItem(STORAGE_KEYS.VOICE_SOS_PHRASE);
      localStorage.removeItem(STORAGE_KEYS.ONBOARDED);
      localStorage.removeItem(STORAGE_KEYS.MODE);
      localStorage.removeItem(STORAGE_KEYS.TRUSTED_CIRCLE);
      localStorage.removeItem(STORAGE_KEYS.FAMILIAR_PLACES);
      localStorage.removeItem(STORAGE_KEYS.PRIVACY_SETTINGS);
      localStorage.removeItem(STORAGE_KEYS.SAFETY_TIMELINE);
      localStorage.removeItem(STORAGE_KEYS.WEBHOOK_URL);
      localStorage.removeItem(STORAGE_KEYS.TELEGRAM_CONFIG);
      localStorage.removeItem(STORAGE_KEYS.WHATSAPP_CONFIG);
      localStorage.removeItem(STORAGE_KEYS.GEMINI_API_KEY);
    } catch {}
  }
};
