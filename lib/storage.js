import { STORAGE_KEYS, DEFAULT_SETTINGS, MAX_HISTORY } from './constants.js';

function promisify(fn) {
  return new Promise((resolve, reject) => {
    fn((result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result);
      }
    });
  });
}

export async function get(keys) {
  const result = await promisify((cb) => chrome.storage.local.get(keys, cb));
  if (typeof keys === 'string') return result[keys];
  return result;
}

export async function set(items) {
  return promisify((cb) => chrome.storage.local.set(items, cb));
}

export async function getAll() {
  const data = await get([STORAGE_KEYS.API_KEY, STORAGE_KEYS.HISTORY, STORAGE_KEYS.SETTINGS, STORAGE_KEYS.HOTKEY_PREFERENCE]);
  return {
    apiKey: data[STORAGE_KEYS.API_KEY] || '',
    history: Array.isArray(data[STORAGE_KEYS.HISTORY]) ? data[STORAGE_KEYS.HISTORY] : [],
    settings: { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEYS.SETTINGS] || {}) },
    hotkeyPreference: data[STORAGE_KEYS.HOTKEY_PREFERENCE] || '',
  };
}

export async function getApiKey() {
  const key = await get(STORAGE_KEYS.API_KEY);
  return (key || '').trim();
}

export async function setApiKey(key) {
  return set({ [STORAGE_KEYS.API_KEY]: key });
}

export async function getHistory() {
  const history = await get(STORAGE_KEYS.HISTORY);
  return Array.isArray(history) ? history : [];
}

export async function addHistoryItem(item) {
  const settings = await getSettings();
  if (!settings.saveHistory) return;

  const history = await getHistory();
  history.unshift(item);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  return set({ [STORAGE_KEYS.HISTORY]: history });
}

export async function deleteHistoryItem(id) {
  const history = await getHistory();
  const filtered = history.filter((item) => item.id !== id);
  return set({ [STORAGE_KEYS.HISTORY]: filtered });
}

export async function clearHistory() {
  return set({ [STORAGE_KEYS.HISTORY]: [] });
}

export async function getSettings() {
  const data = await get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(data || {}) };
}

export async function saveSettings(settings) {
  const current = await getSettings();
  return set({ [STORAGE_KEYS.SETTINGS]: { ...current, ...settings } });
}

export async function resetAll() {
  return promisify((cb) => chrome.storage.local.clear(cb));
}
