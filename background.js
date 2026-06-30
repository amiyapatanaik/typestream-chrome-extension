console.log('[Typestream] === Service worker loaded ===');

import { MSG, OVERLAY_STATES, STORAGE_KEYS } from './lib/constants.js';
import { getApiKey, addHistoryItem } from './lib/storage.js';
import { transcribeRecording, ApiError } from './lib/api.js';
import { loadRecordingBlob, deleteRecordingBlob } from './lib/audio-store.js';

function log(...args) {
  console.log('[Typestream]', ...args);
}

// Catch everything
self.addEventListener('error', (e) => log('GLOBAL ERROR:', e.message, e.filename, e.lineno));
self.addEventListener('unhandledrejection', (e) => {
  log('UNHANDLED REJECTION:', e.reason?.message || e.reason);
  e.preventDefault();
});

// ── State ───────────────────────────────────────────────────────────

const MIC_READY_TIMEOUT_MS = 3000;
const KEEPALIVE_ALARM = 'dictation-keepalive';
const KEEPALIVE_DELAY_MIN = 0.4; // ~24s; keeps the service worker alive during long recordings

const state = {
  phase: 'idle', // idle | starting | recording | processing | cancelling | failed
  tabId: null,
  recordingBlob: null,
  recordingAudioId: null,
  recordingMimeType: 'audio/webm',
  recordingStartedAt: null,
  startedAt: null,
  transcript: null,
};

const OFFSCREEN_TARGET = 'offscreen';

let micBootPromise = null;
let micBootStarted = false;
let finishInFlight = false;
let processingTimeout = null;

function needsKeepalive() {
  return state.phase === 'starting' || state.phase === 'recording' || state.phase === 'processing';
}

function syncKeepalive() {
  if (needsKeepalive()) {
    chrome.alarms.create(KEEPALIVE_ALARM, { delayInMinutes: KEEPALIVE_DELAY_MIN });
  } else {
    chrome.alarms.clear(KEEPALIVE_ALARM);
  }
}

async function persistSession() {
  if (state.phase === 'idle') {
    await chrome.storage.session.remove(STORAGE_KEYS.DICTATION_SESSION);
    return;
  }

  await chrome.storage.session.set({
    [STORAGE_KEYS.DICTATION_SESSION]: {
      phase: state.phase,
      tabId: state.tabId,
      recordingStartedAt: state.recordingStartedAt,
      startedAt: state.startedAt,
      recordingMimeType: state.recordingMimeType,
      recordingAudioId: state.recordingAudioId,
    },
  });
}

async function restoreSession() {
  try {
    const data = await chrome.storage.session.get(STORAGE_KEYS.DICTATION_SESSION);
    const saved = data[STORAGE_KEYS.DICTATION_SESSION];
    if (!saved || saved.phase === 'idle') return;

    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
    });
    const offscreenAlive = contexts.some((c) => c.documentUrl?.includes('offscreen.html'));

    if (saved.phase === 'processing') {
      log('Stale processing session, cleaning up');
      await chrome.storage.session.remove(STORAGE_KEYS.DICTATION_SESSION);
      if (saved.tabId) {
        await sendToTab(MSG.SHOW_OVERLAY, {
          state: OVERLAY_STATES.ERROR,
          error: 'Transcription was interrupted. Try again.',
          action: 'retry',
        }, saved.tabId);
      }
      return;
    }

    if (saved.phase === 'failed') {
      log('Restored failed session, audioId:', saved.recordingAudioId || '(none)');
      state.phase = 'failed';
      state.tabId = saved.tabId;
      state.recordingAudioId = saved.recordingAudioId || null;
      state.recordingMimeType = saved.recordingMimeType || 'audio/webm';
      state.recordingStartedAt = saved.recordingStartedAt;
      return;
    }

    if (!offscreenAlive && (saved.phase === 'recording' || saved.phase === 'starting')) {
      log('Orphaned recording session, cleaning up');
      await chrome.storage.session.remove(STORAGE_KEYS.DICTATION_SESSION);
      if (saved.tabId) {
        await sendToTab(MSG.HIDE_OVERLAY, {}, saved.tabId);
      }
      return;
    }

    log('Restored session, phase:', saved.phase);
    state.phase = saved.phase;
    state.tabId = saved.tabId;
    state.recordingStartedAt = saved.recordingStartedAt;
    state.startedAt = saved.startedAt;
    state.recordingMimeType = saved.recordingMimeType || 'audio/webm';
    syncKeepalive();
  } catch (err) {
    log('restoreSession error:', err.message);
  }
}

const sessionReady = restoreSession();

async function ensureSessionReady() {
  await sessionReady;
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== KEEPALIVE_ALARM) return;
  log('Keepalive ping, phase:', state.phase);
  if (needsKeepalive()) {
    chrome.alarms.create(KEEPALIVE_ALARM, { delayInMinutes: KEEPALIVE_DELAY_MIN });
  }
});

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });
  const existing = contexts.find((c) => c.documentUrl?.includes('offscreen.html'));
  if (existing) return;

  log('Creating offscreen doc');
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Microphone for dictation',
  });
  await new Promise((resolve) => setTimeout(resolve, 200));
}

function sendToOffscreen(type) {
  chrome.runtime.sendMessage({ type, target: OFFSCREEN_TARGET });
}

async function handleOffscreenMessage(msg) {
  try {
    log('Offscreen msg:', msg.type);

    if (msg.type === MSG.RECORDING_READY) {
      log('Recording active');
      if (state.phase === 'starting') state.phase = 'recording';
      state.recordingStartedAt = Date.now();
      void persistSession();
      syncKeepalive();
      return;
    }

    if (msg.type === MSG.RECORDING_STOPPED) {
      log('Recording stopped, phase:', state.phase);

      if (state.phase === 'idle' || state.phase === 'cancelling') {
        await cleanup();
        return;
      }

      if (state.phase !== 'recording' && state.phase !== 'processing' && state.phase !== 'starting') {
        log('Ignoring stale RECORDING_STOPPED');
        return;
      }

      const blob = await loadAudioFromPayload(msg.payload);

      if (!blob || blob.size === 0) {
        if (state.phase === 'starting') {
          await sendToTab(MSG.HIDE_OVERLAY);
        } else {
          await sendToTab(MSG.SHOW_OVERLAY, {
            state: OVERLAY_STATES.ERROR,
            error: 'No audio recorded. Try again.',
            action: 'retry',
          });
        }
        await cleanup();
        return;
      }

      state.recordingBlob = blob;
      state.recordingAudioId = msg.payload?.audioId || null;
      state.recordingMimeType = msg.payload?.mimeType || blob.type || 'audio/webm';
      log('Audio blob:', state.recordingBlob.size, 'bytes,', state.recordingMimeType);

      if (state.phase === 'recording' || state.phase === 'starting') {
        state.phase = 'processing';
        void persistSession();
        syncKeepalive();
        await sendToTab(MSG.SHOW_OVERLAY, { state: OVERLAY_STATES.PROCESSING });
        scheduleProcessingTimeout();
      }

      if (state.phase === 'processing') {
        await finishDictation();
      }
      return;
    }

    if (msg.type === MSG.OFFSCREEN_ERROR) {
      log('Offscreen error:', msg.payload?.message);
      await sendToTab(MSG.SHOW_OVERLAY, {
        state: OVERLAY_STATES.ERROR,
        error: msg.payload?.message,
        action: 'retry',
      });
      await cleanup();
    }
  } catch (err) {
    log('Offscreen msg handler error:', err.message);
  }
}

// ── Content script messages ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target === 'background' || msg.type === MSG.RECORDING_READY || msg.type === MSG.RECORDING_STOPPED || msg.type === MSG.OFFSCREEN_ERROR) {
    void ensureSessionReady().then(() => handleOffscreenMessage(msg));
    return false;
  }

  if (msg.type === MSG.OVERLAY_READY) {
    log('OVERLAY_READY from content');
    if (state.phase !== 'starting' || micBootStarted) {
      sendResponse({ received: false });
      return true;
    }
    sendResponse({ received: true });
    void startRecording().catch((err) => log('startRecording error:', err.message));
    return true;
  }
  if (msg.type === MSG.RETRY_DICTATION) {
    log('RETRY_DICTATION, phase:', state.phase);
    sendResponse({ received: true });
    const tabId = state.tabId || sender.tab?.id;
    if (state.phase === 'failed') {
      void retryTranscription().catch((err) => log('RETRY_DICTATION error:', err.message));
    } else if (state.phase === 'idle' && tabId) {
      void startDictation(tabId).catch((err) => log('RETRY_DICTATION error:', err.message));
    }
    return true;
  }
  if (msg.type === MSG.DISMISS_OVERLAY) {
    log('DISMISS_OVERLAY');
    sendResponse({ received: true });
    void cleanup();
    return true;
  }
  if (msg.type === MSG.STOP_DICTATION) {
    log('STOP_DICTATION');
    sendResponse({ received: true });
    void ensureSessionReady()
      .then(() => stopDictation())
      .catch((err) => log('STOP_DICTATION error:', err.message));
    return true;
  }
  if (msg.type === MSG.START_DICTATION) {
    log('START_DICTATION');
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ received: false });
      return true;
    }
    sendResponse({ received: true });
    void ensureSessionReady().then(() => {
      if (isActivePhase()) {
        return handleShortcutStop();
      }
      return handleShortcutStart(tabId);
    }).catch((err) => log('START_DICTATION error:', err.message));
    return true;
  }
  if (msg.type === MSG.GET_SHORTCUT_LABEL) {
    void chrome.commands.getAll().then((commands) => {
      const cmd = commands.find((c) => c.name === 'toggle-dictation');
      sendResponse({ label: formatShortcutLabel(cmd?.shortcut || '') });
    });
    return true;
  }
  if (msg.type === MSG.INJECT_CONTENT_SCRIPT) {
    const tabId = msg.tabId;
    if (!tabId) {
      sendResponse({ success: false });
      return true;
    }
    void ensureContentScript(tabId).then((success) => sendResponse({ success }));
    return true;
  }
  return false;
});

// ── Tab communication ───────────────────────────────────────────────

function isRestrictedTabUrl(url) {
  if (!url) return true;
  const restricted = ['chrome://', 'chrome-extension://', 'edge://', 'about:', 'devtools://'];
  return restricted.some((prefix) => url.startsWith(prefix));
}

const IS_MAC = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac');

const MODIFIER_SYMBOLS = {
  Ctrl: 'Ctrl',
  Alt: IS_MAC ? '⌥' : 'Alt',
  Shift: IS_MAC ? '⇧' : 'Shift',
  Meta: 'Win',
  Command: '⌘',
  MacCtrl: '⌃',
  Option: '⌥',
};

function formatShortcutLabel(shortcut) {
  if (!shortcut) return '';
  return shortcut.split('+').map((key) => {
    const trimmed = key.trim();
    return MODIFIER_SYMBOLS[trimmed] || trimmed;
  }).join('');
}

const PING = '__typestream_ping__';

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesFromPayload(value) {
  if (!value) return null;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value.byteLength === 'number' && value.byteLength > 0) {
    return new Uint8Array(value);
  }
  return null;
}

async function loadAudioFromPayload(payload) {
  if (!payload) return null;

  const mime = payload.mimeType || 'audio/webm';
  const expected = payload.byteLength ?? 0;

  if (typeof payload.audioId === 'string' && payload.audioId.length > 0) {
    const blob = await loadRecordingBlob(payload.audioId);
    if (!blob || blob.size === 0) {
      log('Missing IndexedDB audio for id:', payload.audioId);
      return null;
    }
    log('Loaded IndexedDB audio:', blob.size, 'bytes (expected:', expected, ')');
    return blob;
  }

  if (typeof payload.base64 === 'string' && payload.base64.length > 0) {
    const bytes = base64ToBytes(payload.base64);
    const blob = new Blob([bytes], { type: mime });
    log('Decoded base64 audio:', blob.size, 'bytes (expected:', expected, ')');
    return blob;
  }

  const bytes = bytesFromPayload(payload.bytes);
  if (bytes && bytes.byteLength > 0) {
    const blob = new Blob([bytes], { type: mime });
    log('Decoded byte audio:', blob.size, 'bytes (expected:', expected, ')');
    return blob;
  }

  const data = bytesFromPayload(payload.data);
  if (data && data.byteLength > 0) {
    const blob = new Blob([data], { type: mime });
    log('Decoded ArrayBuffer audio:', blob.size, 'bytes');
    return blob;
  }

  log('Invalid audio payload');
  return null;
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve) => {
    if (!tabId) {
      resolve(null);
      return;
    }
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(response ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

async function injectContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });
}

async function ensureContentScript(tabId) {
  if (await sendTabMessage(tabId, { type: PING }) !== null) {
    return true;
  }

  try {
    await injectContentScript(tabId);
  } catch (err) {
    log('ensureContentScript inject failed:', err.message);
    return false;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    if (await sendTabMessage(tabId, { type: PING }) !== null) {
      return true;
    }
  }

  return false;
}

async function sendToTab(type, payload = {}, tabId = state.tabId) {
  if (!tabId) return false;

  const message = { type, ...payload };

  if (await sendTabMessage(tabId, message) !== null) {
    return true;
  }

  const ready = await ensureContentScript(tabId);
  if (!ready) {
    log('sendToTab: no content script on tab', tabId);
    return false;
  }

  return (await sendTabMessage(tabId, message)) !== null;
}

// ── Dictation flow ──────────────────────────────────────────────────

function clearProcessingTimeout() {
  if (processingTimeout) {
    clearTimeout(processingTimeout);
    processingTimeout = null;
  }
}

function scheduleProcessingTimeout() {
  clearProcessingTimeout();
  processingTimeout = setTimeout(() => {
    if (state.phase !== 'processing') return;
    log('Processing timeout');
    void enterFailedState('Transcription timed out. Try again.');
  }, 60_000);
}

async function startDictation(tabId) {
  if (state.phase !== 'idle') return;
  log('startDictation on tab', tabId);

  await releaseRecording();

  state.phase = 'starting';
  state.tabId = tabId;
  state.startedAt = Date.now();
  state.transcript = null;

  void persistSession();
  syncKeepalive();

  const connected = await ensureContentScript(tabId);
  if (!connected) {
    log('No content script available on tab', tabId);
    state.phase = 'idle';
    state.tabId = null;
    return;
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    log('No API key');
    await sendToTab(MSG.SHOW_OVERLAY, { state: OVERLAY_STATES.ERROR, error: 'No API key configured.', action: 'settings' });
    state.phase = 'idle';
    state.tabId = null;
    return;
  }

  const overlayShown = await sendToTab(MSG.SHOW_OVERLAY, { state: OVERLAY_STATES.LISTENING });
  if (!overlayShown) {
    log('Could not show overlay on tab', tabId);
    state.phase = 'idle';
    state.tabId = null;
    return;
  }
}

async function startRecording() {
  if (state.phase !== 'starting') return;
  if (micBootPromise) return micBootPromise;
  if (micBootStarted) return;

  micBootStarted = true;
  micBootPromise = bootMicrophone();
  try {
    await micBootPromise;
  } finally {
    micBootPromise = null;
  }
}

async function bootMicrophone() {
  log('bootMicrophone');
  try {
    if (state.phase !== 'starting') return;

    await ensureOffscreen();
    if (state.phase !== 'starting') return;

    sendToOffscreen(MSG.START_RECORDING);
    log('Sent START_RECORDING');
  } catch (err) {
    log('bootMicrophone FAILED:', err.message);
    if (state.phase === 'starting' || state.phase === 'recording') {
      await sendToTab(MSG.SHOW_OVERLAY, { state: OVERLAY_STATES.ERROR, error: err.message, action: 'retry' });
      await cleanup();
    }
  }
}

async function cancelDictation() {
  if (state.phase !== 'starting') return;
  log('cancelDictation');
  state.phase = 'cancelling';
  sendToOffscreen(MSG.STOP_RECORDING);
  await sendToTab(MSG.HIDE_OVERLAY);
  await cleanup();
}

async function waitForRecordingPhase(timeoutMs = MIC_READY_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (state.phase === 'starting' && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return state.phase === 'recording';
}

async function stopActiveRecording() {
  if (state.phase !== 'recording') return;

  log('stopActiveRecording');
  state.phase = 'processing';
  void persistSession();
  syncKeepalive();
  await sendToTab(MSG.SHOW_OVERLAY, { state: OVERLAY_STATES.PROCESSING });
  scheduleProcessingTimeout();
  sendToOffscreen(MSG.STOP_RECORDING);
}

async function stopDictation() {
  if (state.phase === 'starting') {
    const ready = await waitForRecordingPhase();
    if (!ready) {
      if (state.phase === 'starting') {
        await cancelDictation();
      }
      return;
    }
  }

  if (state.phase !== 'recording') return;

  await stopActiveRecording();
}

async function ensureRecordingBlob() {
  if (state.recordingBlob?.size > 0) return state.recordingBlob;
  if (!state.recordingAudioId) return null;

  const blob = await loadRecordingBlob(state.recordingAudioId);
  if (blob?.size > 0) {
    state.recordingBlob = blob;
    return blob;
  }
  return null;
}

async function retryTranscription() {
  if (state.phase !== 'failed') return;
  const tabId = state.tabId;
  if (!tabId) return;

  log('retryTranscription');

  const apiKey = await getApiKey();
  if (!apiKey) {
    await sendToTab(MSG.SHOW_OVERLAY, {
      state: OVERLAY_STATES.ERROR,
      error: 'No API key configured.',
      action: 'settings',
    }, tabId);
    return;
  }

  const blob = await ensureRecordingBlob();
  if (!blob) {
    log('Retry audio missing, starting new recording');
    await releaseRecording();
    state.phase = 'idle';
    state.tabId = tabId;
    void persistSession();
    await startDictation(tabId);
    return;
  }

  state.phase = 'processing';
  void persistSession();
  syncKeepalive();
  await sendToTab(MSG.SHOW_OVERLAY, { state: OVERLAY_STATES.PROCESSING });
  scheduleProcessingTimeout();
  await finishDictation();
}

async function finishDictation() {
  if (state.phase !== 'processing' || finishInFlight) return;
  finishInFlight = true;

  try {
    const apiKey = await getApiKey();
    const blob = await ensureRecordingBlob();
    if (!blob) {
      throw new ApiError('RECORDING_UNAVAILABLE', 'Recording no longer available. Please record again.');
    }

    const durationMs = state.recordingStartedAt
      ? Date.now() - state.recordingStartedAt
      : 0;
    log('Transcribing:', blob.size, 'bytes,', durationMs, 'ms,', state.recordingMimeType);
    const text = await transcribeRecording(
      apiKey,
      blob,
      state.recordingMimeType,
      durationMs,
    );
    log('Transcript:', text?.substring(0, 60));
    state.transcript = text;

    await sendToTab(MSG.INSERT_TEXT, { text });
    try {
      await addHistoryItem({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), text });
    } catch (historyErr) {
      log('History save failed (transcription succeeded):', historyErr.message);
    }
    log('Saved');
    await releaseRecording();
    await cleanup();
  } catch (err) {
    log('finishDictation error:', err.message);
    const message = err instanceof ApiError ? err.message : err.message;
    await enterFailedState(message);
  } finally {
    finishInFlight = false;
  }
}

async function releaseRecording() {
  if (state.recordingAudioId) {
    await deleteRecordingBlob(state.recordingAudioId).catch((err) => {
      log('Failed to delete stored recording:', err.message);
    });
  }
  state.recordingBlob = null;
  state.recordingAudioId = null;
  state.recordingMimeType = 'audio/webm';
  state.recordingStartedAt = null;
}

async function enterFailedState(errorMessage) {
  clearProcessingTimeout();
  state.phase = 'failed';
  state.transcript = null;
  micBootPromise = null;
  micBootStarted = false;
  finishInFlight = false;
  void persistSession();
  syncKeepalive();
  await sendToTab(MSG.SHOW_OVERLAY, {
    state: OVERLAY_STATES.ERROR,
    error: errorMessage,
    action: 'retry',
  });
}

async function cleanup() {
  clearProcessingTimeout();
  await releaseRecording();
  state.phase = 'idle';
  state.tabId = null;
  state.startedAt = null;
  state.transcript = null;
  micBootPromise = null;
  micBootStarted = false;
  finishInFlight = false;
  void persistSession();
  syncKeepalive();
}

async function resetExtensionState() {
  clearProcessingTimeout();
  await releaseRecording();
  state.phase = 'idle';
  state.tabId = null;
  state.startedAt = null;
  state.transcript = null;
  micBootPromise = null;
  micBootStarted = false;
  finishInFlight = false;
  try { await chrome.offscreen.closeDocument(); } catch {}
}

function isActivePhase() {
  return state.phase === 'recording' || state.phase === 'starting';
}

async function handleShortcutStart(tabId) {
  if (!tabId) return;
  if (state.phase === 'processing' || state.phase === 'cancelling') return;
  if (isActivePhase()) return;
  if (state.phase !== 'idle') return;
  await startDictation(tabId);
}

async function handleShortcutStop() {
  if (state.phase === 'processing' || state.phase === 'cancelling') return;
  if (!isActivePhase()) return;
  await stopDictation();
}

chrome.commands.onCommand.addListener((command, tab) => {
  log('>>> COMMAND:', command, 'tab:', tab?.id, 'phase:', state.phase);
  if (command !== 'toggle-dictation') return;

  void (async () => {
    try {
      await ensureSessionReady();

      let targetTab = tab;
      if (!targetTab?.id) {
        const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        targetTab = tabs[0];
      }
      if (!targetTab?.id) {
        log('No active tab');
        return;
      }
      if (isRestrictedTabUrl(targetTab.url)) {
        log('Restricted page:', targetTab.url);
        return;
      }

      log('Active tab:', targetTab.id, targetTab.url);
      if (isActivePhase()) {
        await handleShortcutStop();
      } else {
        await handleShortcutStart(targetTab.id);
      }
    } catch (err) {
      log('Command handler error:', err.message);
    }
  })();
});

// ── Startup ─────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  void resetExtensionState();
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
  }
});

// Do NOT reset state on every service-worker wake — that kills in-progress recordings.

setTimeout(async () => {
  try {
    log('=== Startup diagnostics ===');
    const commands = await chrome.commands.getAll();
    const cmd = commands.find((c) => c.name === 'toggle-dictation');
    log('Shortcut:', cmd?.shortcut || '(none)');
    const key = await getApiKey();
    log('API key:', key ? 'configured' : 'MISSING');
  } catch (err) {
    log('Diag error:', err.message);
  }
}, 300);

log('=== Init complete ===');
