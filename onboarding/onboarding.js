const DEFAULT_SETTINGS = {
  saveHistory: true,
  autoCopy: true,
  playSounds: false,
};

const STORAGE_KEYS = {
  API_KEY: 'typestream_api_key',
  SETTINGS: 'settings',
  HOTKEY_PREFERENCE: 'hotkey_preference',
};

const keycapsEl = document.getElementById('keycaps');
const shortcutHelper = document.getElementById('shortcut-helper');
const hotkeySettingsBtn = document.getElementById('hotkey-settings-btn');
const apiKeyInput = document.getElementById('api-key');
const keyStatus = document.getElementById('key-status');
const grantMicBtn = document.getElementById('grant-mic-btn');
const permBanner = document.getElementById('perm-banner');
const permDesc = document.getElementById('perm-desc');
const clearDataBtn = document.getElementById('clear-data-btn');
const toggleHistory = document.getElementById('toggle-history');
const toggleAutocopy = document.getElementById('toggle-autocopy');
const toggleSounds = document.getElementById('toggle-sounds');

const IS_MAC = navigator.platform.includes('Mac');

// ── Shortcut display ──────────────────────────────────────────────────

const MODIFIER_SYMBOLS = {
  Ctrl: 'Ctrl',
  Alt: IS_MAC ? '⌥' : 'Alt',
  Shift: IS_MAC ? '⇧' : 'Shift',
  Meta: 'Win',
  Command: '⌘',
  MacCtrl: '⌃',
  Option: '⌥',
};

const ARROW_KEYS = {
  Up: '↑', Down: '↓', Left: '←', Right: '→',
};

function parseShortcut(shortcut) {
  if (!shortcut) return [];
  return shortcut.split('+').map((key) => {
    key = key.trim();
    if (MODIFIER_SYMBOLS[key]) return MODIFIER_SYMBOLS[key];
    if (ARROW_KEYS[key]) return ARROW_KEYS[key];
    return key;
  });
}

function renderKeycaps(keys) {
  keycapsEl.innerHTML = '';

  if (!keys.length) {
    keycapsEl.innerHTML = '<span class="keycap keycap-unset">Not set</span>';
    return;
  }

  keys.forEach((key) => {
    const span = document.createElement('span');
    span.className = 'keycap';
    span.textContent = key;
    keycapsEl.appendChild(span);
  });
}

async function loadShortcut() {
  try {
    const commands = await chrome.commands.getAll();
    const cmd = commands.find((c) => c.name === 'toggle-dictation');
    const shortcut = cmd?.shortcut || '';
    renderKeycaps(parseShortcut(shortcut));

    if (!shortcut) {
      shortcutHelper.innerHTML =
        'No shortcut is set yet. Click <strong>Change shortcut</strong> and assign one for "Start or stop voice dictation". ' +
        'Chrome cannot use <strong>⌘D</strong> or <strong>Ctrl+D</strong> — those are reserved for bookmarks.';
    } else {
      shortcutHelper.innerHTML =
        'Opens Chrome\'s keyboard shortcut settings. Set scope to <strong>Global</strong> to use dictation from any app.';
    }
  } catch {
    renderKeycaps([]);
  }
}

hotkeySettingsBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    loadShortcut();
  }
});

// ── Load ──────────────────────────────────────────────────────────────

async function loadSettings() {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.API_KEY,
    STORAGE_KEYS.SETTINGS,
    STORAGE_KEYS.HOTKEY_PREFERENCE,
  ]);

  const apiKey = data[STORAGE_KEYS.API_KEY] || '';
  apiKeyInput.value = apiKey;
  updateKeyStatus(apiKey);

  const settings = { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEYS.SETTINGS] || {}) };
  setToggle(toggleHistory, settings.saveHistory);
  setToggle(toggleAutocopy, settings.autoCopy);
  setToggle(toggleSounds, settings.playSounds);

  await loadShortcut();
  await updateMicBanner();
}

// ── API Key ────────────────────────────────────────────────────────────

apiKeyInput.addEventListener('input', () => {
  const val = apiKeyInput.value.trim();
  saveApiKey(val);
  updateKeyStatus(val);
});

function updateKeyStatus(val) {
  if (!val) {
    keyStatus.classList.add('hidden');
    return;
  }
  keyStatus.classList.remove('hidden');
  const isValid = val.startsWith('ts_') || val.startsWith('sk_');
  keyStatus.textContent = isValid ? '✓' : '✗';
  keyStatus.className = 'status-icon ' + (isValid ? 'valid' : 'invalid');
}

async function saveApiKey(val) {
  await chrome.storage.local.set({ [STORAGE_KEYS.API_KEY]: val });
}

// ── Microphone permission ─────────────────────────────────────────────

grantMicBtn.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    permBanner.classList.add('granted');
    permDesc.textContent = 'Microphone is ready. You’re all set!';
    grantMicBtn.textContent = 'Granted';
    grantMicBtn.disabled = true;
  } catch (err) {
    permDesc.textContent =
      err.name === 'NotAllowedError'
        ? 'Access denied. Allow microphone in your browser settings.'
        : 'Could not access microphone. Check your device.';
    permBanner.style.borderLeftColor = '#ef4444';
    permBanner.style.background = 'rgba(239, 68, 68, 0.06)';
  }
});

async function updateMicBanner() {
  try {
    const perms = await navigator.permissions.query({ name: 'microphone' });
    if (perms.state === 'granted') {
      permBanner.classList.add('granted');
      permDesc.textContent = 'Microphone is ready. You’re all set!';
      grantMicBtn.textContent = 'Granted';
      grantMicBtn.disabled = true;
    }
  } catch {
    // permissions.query may not be supported
  }
}

// ── Toggles ────────────────────────────────────────────────────────────

function setToggle(el, value) {
  el.setAttribute('aria-checked', String(value));
}

function getToggle(el) {
  return el.getAttribute('aria-checked') === 'true';
}

[toggleHistory, toggleAutocopy, toggleSounds].forEach((toggle) => {
  toggle.addEventListener('click', () => {
    const current = getToggle(toggle);
    setToggle(toggle, !current);
    saveAllSettings();
  });
});

async function saveAllSettings() {
  const settings = {
    saveHistory: getToggle(toggleHistory),
    autoCopy: getToggle(toggleAutocopy),
    playSounds: getToggle(toggleSounds),
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
}

// ── Danger zone ────────────────────────────────────────────────────────

clearDataBtn.addEventListener('click', async () => {
  const confirmed = confirm(
    'This will permanently delete your API key, transcription history, and all settings. This action cannot be undone.'
  );
  if (!confirmed) return;

  await chrome.storage.local.clear();

  apiKeyInput.value = '';
  updateKeyStatus('');
  setToggle(toggleHistory, DEFAULT_SETTINGS.saveHistory);
  setToggle(toggleAutocopy, DEFAULT_SETTINGS.autoCopy);
  setToggle(toggleSounds, DEFAULT_SETTINGS.playSounds);
  permBanner.classList.remove('granted');
  permBanner.style.borderLeftColor = '#6366f1';
  permBanner.style.background = '';
  permDesc.textContent = 'Please grant access to start dictating.';
  grantMicBtn.textContent = 'Grant Access';
  grantMicBtn.disabled = false;
});

// ── Init ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', loadSettings);
