// ── Message constants (mirrors lib/constants.js to keep content.js self-contained) ──
const MSG = {
  SHOW_OVERLAY: 'SHOW_OVERLAY',
  HIDE_OVERLAY: 'HIDE_OVERLAY',
  INSERT_TEXT: 'INSERT_TEXT',
  OVERLAY_READY: 'OVERLAY_READY',
  RETRY_DICTATION: 'RETRY_DICTATION',
  DISMISS_OVERLAY: 'DISMISS_OVERLAY',
  STOP_DICTATION: 'STOP_DICTATION',
  START_DICTATION: 'START_DICTATION',
  GET_SHORTCUT_LABEL: 'GET_SHORTCUT_LABEL',
};

const STORAGE_KEYS = {
  SETTINGS: 'settings',
};

const DEFAULT_SETTINGS = {
  showFloatingBar: false,
};

// ── SVG Icons (inline, no external requests) ──────────────────────────────

const MIC_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`;

const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;

const WARNING_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`;

// ── Shadow DOM styles ─────────────────────────────────────────────────────

const UI_CSS = `
  :host {
    all: initial;
  }

  @keyframes ts-spring-up {
    0%   { transform: translateY(20px) scale(0.9); opacity: 0; }
    60%  { transform: translateY(-4px) scale(1.02); opacity: 1; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
  }

  @keyframes ts-dock-expand {
    0%   { transform: translateY(8px) scale(0.85); opacity: 0; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
  }

  @keyframes ts-pulse-glow {
    0%, 100% { box-shadow: 0 20px 40px -10px rgba(99, 102, 241, 0.25); }
    50%      { box-shadow: 0 20px 40px -10px rgba(139, 92, 246, 0.35); }
  }

  @keyframes ts-pulse-opacity {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.5; }
  }

  @keyframes ts-waveform {
    0%   { transform: scaleY(0.4); }
    50%  { transform: scaleY(1); }
    100% { transform: scaleY(0.4); }
  }

  @keyframes ts-spin {
    to { transform: rotate(360deg); }
  }

  @keyframes ts-shake {
    0%, 100% { transform: translateX(0); }
    20%      { transform: translateX(-5px); }
    40%      { transform: translateX(5px); }
    60%      { transform: translateX(-5px); }
    80%      { transform: translateX(5px); }
  }

  @keyframes ts-fade-out {
    to { opacity: 0; transform: scale(0.9); }
  }

  @keyframes ts-success-glow {
    0%, 100% { box-shadow: 0 20px 40px -10px rgba(14, 165, 233, 0.25); }
    50%      { box-shadow: 0 20px 40px -10px rgba(14, 165, 233, 0.4); }
  }

  .hidden {
    display: none !important;
  }

  /* ── Floating dock (Wispr-style) ─────────────────────────────────── */

  .dock-wrapper {
    position: fixed;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Geist', sans-serif;
  }

  .dock-idle {
    pointer-events: auto;
    width: 40px;
    height: 5px;
    border-radius: 999px;
    background: #3f3f46;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: width 0.2s ease, background 0.2s ease, height 0.2s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .dock-idle:hover {
    width: 48px;
    height: 6px;
    background: #52525b;
  }

  .dock-expanded {
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    animation: ts-dock-expand 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }

  .dictate-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 999px;
    background: #09090b;
    color: #fafafa;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    user-select: none;
  }

  .shortcut-label {
    color: #c4b5fd;
    font-weight: 500;
  }

  .dock-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .dock-mic-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    border: none;
    background: #09090b;
    color: #fafafa;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    transition: background 0.15s, transform 0.15s;
  }

  .dock-mic-btn:hover {
    background: #18181b;
    transform: scale(1.05);
  }

  .dock-mic-btn:active {
    transform: scale(0.97);
  }

  /* ── Recording overlay ───────────────────────────────────────────── */

  .overlay-wrapper {
    position: fixed;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    pointer-events: none;
  }

  .overlay-pill {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 12px;
    height: 48px;
    padding: 0 20px 0 16px;
    border-radius: 999px;
    background: #FFFFFF;
    border: 1px solid #E4E4E7;
    color: #09090B;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Geist', sans-serif;
    font-size: 14px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
    user-select: none;
    animation: ts-spring-up 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }

  .icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    color: #6366F1;
  }

  .text-content {
    color: #09090B;
    font-size: 14px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
  }

  .waveform {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 16px;
  }

  .wf-bar {
    width: 3px;
    border-radius: 2px;
    background: #6366F1;
    animation: ts-waveform 1s infinite ease-in-out;
  }
  .wf-bar:nth-child(1) { height: 60%; animation-delay: 0s; }
  .wf-bar:nth-child(2) { height: 100%; animation-delay: -0.2s; }
  .wf-bar:nth-child(3) { height: 60%; animation-delay: -0.4s; }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #E4E4E7;
    border-top-color: #6366F1;
    border-radius: 50%;
    animation: ts-spin 1s linear infinite;
  }

  .error-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: 4px;
  }

  .retry-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid rgba(239, 68, 68, 0.2);
    background: rgba(239, 68, 68, 0.05);
    color: #EF4444;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }

  .retry-btn:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border-radius: 999px;
    border: 1px solid #E4E4E7;
    background: transparent;
    color: #71717A;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    flex-shrink: 0;
  }

  .close-btn:hover {
    background: #F4F4F5;
    color: #09090B;
  }

  .listening-actions {
    display: flex;
    align-items: center;
    margin-left: 4px;
  }

  .stop-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid #E4E4E7;
    background: #F4F4F5;
    color: #09090B;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .stop-btn:hover {
    background: #FEE2E2;
    border-color: rgba(239, 68, 68, 0.3);
    color: #DC2626;
  }

  .state-listening .overlay-pill {
    animation: ts-spring-up 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards,
               ts-pulse-glow 2s ease-in-out infinite;
    animation-delay: 0s, 0.4s;
  }
  .state-listening .mic-icon {
    animation: ts-pulse-opacity 1s infinite;
    color: #6366F1;
  }

  .state-processing .overlay-pill {
    animation: ts-spring-up 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    box-shadow: 0 20px 40px -10px rgba(99, 102, 241, 0.2);
  }

  .state-resolution .overlay-pill {
    animation: ts-spring-up 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards,
               ts-success-glow 1.5s ease-in-out 1;
    box-shadow: 0 20px 40px -10px rgba(14, 165, 233, 0.2);
  }
  .state-resolution .icon-wrapper {
    color: #0EA5E9;
  }

  .state-error .overlay-pill {
    animation: ts-spring-up 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards,
               ts-shake 0.4s ease-in-out 0.4s;
    box-shadow: 0 20px 40px -10px rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.3);
  }
  .state-error .icon-wrapper {
    color: #EF4444;
  }
`;

// ── Shadow DOM template ──────────────────────────────────────────────────

const UI_HTML = `
  <div class="dock-wrapper hidden" id="dock-wrapper">
    <button class="dock-idle" id="dock-idle" type="button" aria-label="Open dictation menu" title="Click to dictate"></button>
    <div class="dock-expanded hidden" id="dock-expanded">
      <div class="dictate-pill">
        <span>Dictate</span>
        <span class="shortcut-label" id="shortcut-label"></span>
      </div>
      <div class="dock-actions">
        <button class="dock-mic-btn" id="dock-mic-btn" type="button" aria-label="Start dictation">
          ${MIC_SVG}
        </button>
      </div>
    </div>
  </div>

  <div class="overlay-wrapper hidden" id="overlay-wrapper">
    <div class="overlay-pill" id="pill">
      <div class="icon-wrapper" id="icon"></div>
      <span class="text-content" id="text"></span>
      <div class="waveform hidden" id="waveform">
        <div class="wf-bar"></div>
        <div class="wf-bar"></div>
        <div class="wf-bar"></div>
      </div>
      <div class="listening-actions hidden" id="listening-actions">
        <button class="stop-btn" id="stop-btn" type="button" aria-label="Stop recording" title="Or press your shortcut again">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
          Stop
        </button>
      </div>
      <div class="error-actions hidden" id="error-actions">
        <button class="retry-btn hidden" id="retry-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          Retry
        </button>
        <button class="close-btn hidden" id="close-btn" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
        </button>
      </div>
    </div>
  </div>
`;

// ── State ─────────────────────────────────────────────────────────────────

let shadowRoot = null;
let hideTimeout = null;
let overlayReadySent = false;
let showFloatingBar = false;
let dockExpanded = false;
let outsideClickHandler = null;

let dockWrapper = null;
let dockIdle = null;
let dockExpandedEl = null;
let shortcutLabelEl = null;
let dockMicBtn = null;

let overlayWrapper = null;
let iconEl = null;
let textEl = null;
let waveformEl = null;
let errorActionsEl = null;
let listeningActionsEl = null;
let retryBtn = null;
let stopBtn = null;
let closeBtn = null;

// ── Host / dock / overlay ─────────────────────────────────────────────────

function ensureHost() {
  if (shadowRoot) return;

  const host = document.createElement('div');
  host.id = 'typestream-host';
  host.style.cssText = 'all: initial;';

  shadowRoot = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = UI_CSS;
  shadowRoot.appendChild(style);

  const container = document.createElement('div');
  container.innerHTML = UI_HTML;
  while (container.firstChild) {
    shadowRoot.appendChild(container.firstChild);
  }

  dockWrapper = shadowRoot.getElementById('dock-wrapper');
  dockIdle = shadowRoot.getElementById('dock-idle');
  dockExpandedEl = shadowRoot.getElementById('dock-expanded');
  shortcutLabelEl = shadowRoot.getElementById('shortcut-label');
  dockMicBtn = shadowRoot.getElementById('dock-mic-btn');

  overlayWrapper = shadowRoot.getElementById('overlay-wrapper');
  iconEl = shadowRoot.getElementById('icon');
  textEl = shadowRoot.getElementById('text');
  waveformEl = shadowRoot.getElementById('waveform');
  errorActionsEl = shadowRoot.getElementById('error-actions');
  listeningActionsEl = shadowRoot.getElementById('listening-actions');
  retryBtn = shadowRoot.getElementById('retry-btn');
  stopBtn = shadowRoot.getElementById('stop-btn');
  closeBtn = shadowRoot.getElementById('close-btn');

  dockIdle.addEventListener('click', (e) => {
    e.stopPropagation();
    expandDock();
  });

  dockMicBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    collapseDock();
    sendToBackground({ type: MSG.START_DICTATION });
  });

  stopBtn.addEventListener('click', () => {
    sendToBackground({ type: MSG.STOP_DICTATION });
  });

  retryBtn.addEventListener('click', () => {
    sendToBackground({ type: MSG.RETRY_DICTATION });
  });

  closeBtn.addEventListener('click', () => {
    overlayReadySent = false;
    finishOverlaySession();
    sendToBackground({ type: MSG.DISMISS_OVERLAY });
  });

  (document.documentElement || document.body).appendChild(host);
}

function showDock() {
  if (!showFloatingBar) return;
  ensureHost();
  dockWrapper.classList.remove('hidden');
  setDockIdle();
}

function hideDock() {
  if (!dockWrapper) return;
  dockWrapper.classList.add('hidden');
  collapseDock();
}

function setDockIdle() {
  dockExpanded = false;
  dockIdle.classList.remove('hidden');
  dockExpandedEl.classList.add('hidden');
  removeOutsideClickHandler();
}

async function expandDock() {
  ensureHost();
  dockExpanded = true;
  dockIdle.classList.add('hidden');
  dockExpandedEl.classList.remove('hidden');

  try {
    const response = await sendToBackgroundAsync({ type: MSG.GET_SHORTCUT_LABEL });
    shortcutLabelEl.textContent = response?.label || '';
  } catch {
    shortcutLabelEl.textContent = '';
  }

  addOutsideClickHandler();
}

function collapseDock() {
  if (!dockExpanded) return;
  setDockIdle();
}

function addOutsideClickHandler() {
  removeOutsideClickHandler();
  outsideClickHandler = (e) => {
    const host = document.getElementById('typestream-host');
    if (host && e.composedPath().includes(host)) return;
    collapseDock();
  };
  document.addEventListener('click', outsideClickHandler, true);
}

function removeOutsideClickHandler() {
  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler, true);
    outsideClickHandler = null;
  }
}

function showOverlay() {
  ensureHost();
  hideDock();
  overlayWrapper.classList.remove('hidden');
}

function hideOverlay() {
  if (!overlayWrapper) return;
  overlayWrapper.classList.add('hidden');
  overlayWrapper.classList.remove('state-listening', 'state-processing', 'state-resolution', 'state-error');
}

function finishOverlaySession() {
  clearTimeout(hideTimeout);
  hideOverlay();
  overlayReadySent = false;
  if (showFloatingBar) {
    showDock();
  } else {
    removeHost();
  }
}

function removeHost() {
  clearTimeout(hideTimeout);
  removeOutsideClickHandler();
  const host = document.getElementById('typestream-host');
  if (host) host.remove();
  shadowRoot = null;
  dockWrapper = null;
  dockIdle = null;
  dockExpandedEl = null;
  shortcutLabelEl = null;
  dockMicBtn = null;
  overlayWrapper = null;
  iconEl = null;
  textEl = null;
  waveformEl = null;
  errorActionsEl = null;
  listeningActionsEl = null;
  retryBtn = null;
  stopBtn = null;
  closeBtn = null;
  dockExpanded = false;
}

function setOverlayState(state, options = {}) {
  showOverlay();
  clearTimeout(hideTimeout);

  overlayWrapper.classList.remove('state-listening', 'state-processing', 'state-resolution', 'state-error');

  iconEl.classList.remove('mic-icon');
  iconEl.innerHTML = '';
  waveformEl.classList.add('hidden');
  errorActionsEl.classList.add('hidden');
  listeningActionsEl.classList.add('hidden');
  retryBtn.classList.add('hidden');
  closeBtn.classList.add('hidden');
  stopBtn.disabled = false;

  switch (state) {
    case 'listening':
      overlayWrapper.classList.add('state-listening');
      iconEl.classList.add('mic-icon');
      iconEl.innerHTML = MIC_SVG;
      waveformEl.classList.remove('hidden');
      listeningActionsEl.classList.remove('hidden');
      textEl.textContent = 'Listening…';
      break;

    case 'processing':
      overlayWrapper.classList.add('state-processing');
      iconEl.innerHTML = '<div class="spinner"></div>';
      textEl.textContent = 'Transcribing...';
      break;

    case 'resolution':
      overlayWrapper.classList.add('state-resolution');
      iconEl.innerHTML = CHECK_SVG;
      textEl.textContent = options.text || 'Inserted!';
      hideTimeout = setTimeout(finishOverlaySession, 1500);
      break;

    case 'error':
      overlayWrapper.classList.add('state-error');
      iconEl.innerHTML = WARNING_SVG;
      textEl.textContent = options.error || 'Something went wrong.';
      errorActionsEl.classList.remove('hidden');
      closeBtn.classList.remove('hidden');
      if (options.action === 'retry') {
        retryBtn.classList.remove('hidden');
      }
      break;
  }
}

// ── Settings ──────────────────────────────────────────────────────────────

async function loadFloatingBarSetting() {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const settings = { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEYS.SETTINGS] || {}) };
    applyFloatingBarSetting(settings.showFloatingBar);
  } catch {
    applyFloatingBarSetting(false);
  }
}

function applyFloatingBarSetting(enabled) {
  showFloatingBar = enabled;
  if (enabled) {
    showDock();
  } else {
    collapseDock();
    hideDock();
    if (overlayWrapper?.classList.contains('hidden') !== false) {
      removeHost();
    }
  }
}

// ── Text insertion ────────────────────────────────────────────────────────

const INPUT_TYPES = new Set([
  'text', 'search', 'url', 'tel', 'email', 'password', 'number', null, '',
]);

function getInsertionTarget() {
  const el = document.activeElement;
  if (!el || el === document.body) return null;

  const tag = el.tagName.toLowerCase();
  const type = el.getAttribute('type');
  const isCE = el.getAttribute('contenteditable') === 'true' || el.isContentEditable;

  if (tag === 'textarea') return { element: el, kind: 'input' };
  if (tag === 'input' && INPUT_TYPES.has(type)) return { element: el, kind: 'input' };
  if (isCE) return { element: el, kind: 'contenteditable' };

  let parent = el.parentElement;
  while (parent) {
    if (parent.isContentEditable) return { element: el, kind: 'contenteditable-nested' };
    parent = parent.parentElement;
  }

  return null;
}

function insertIntoInput(target, text) {
  const { element } = target;
  const start = element.selectionStart || 0;
  const end = element.selectionEnd || 0;
  const before = element.value.substring(0, start);
  const after = element.value.substring(end);
  const newValue = before + text + after;

  const nativeSetter =
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set ||
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;

  if (nativeSetter) {
    nativeSetter.call(element, newValue);
  } else {
    element.value = newValue;
  }

  element.dispatchEvent(new InputEvent('input', {
    inputType: 'insertText',
    data: text,
    bubbles: true,
    cancelable: true,
    composed: true,
  }));
  element.dispatchEvent(new Event('change', { bubbles: true }));

  const newCursor = start + text.length;
  element.setSelectionRange(newCursor, newCursor);
  element.focus();
}

function insertIntoContentEditable(target, text) {
  const { element } = target;
  element.focus();

  const sel = window.getSelection();
  if (!sel) return false;

  if (!element.contains(sel.anchorNode)) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  if (document.execCommand('insertText', false, text)) return true;

  const range = sel.getRangeAt(0);
  range.deleteContents();
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.setEndAfter(textNode);
  sel.removeAllRanges();
  sel.addRange(range);

  element.dispatchEvent(new InputEvent('input', {
    inputType: 'insertText',
    data: text,
    bubbles: true,
    cancelable: true,
  }));

  return true;
}

function insertText(text) {
  const target = getInsertionTarget();
  if (!target) return false;

  try {
    if (target.kind === 'input') {
      insertIntoInput(target, text);
    } else {
      insertIntoContentEditable(target, text);
    }
    return true;
  } catch {
    return false;
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

const LOG_PREFIX = '[Typestream]';

function sendToBackground(message) {
  try {
    chrome.runtime.sendMessage(message, () => {
      void chrome.runtime.lastError;
    });
  } catch {
    // Extension context invalidated after reload.
  }
}

function sendToBackgroundAsync(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

// ── Background message handler ────────────────────────────────────────────

if (!globalThis.__typestreamContentScriptLoaded) {
  globalThis.__typestreamContentScriptLoaded = true;

  document.getElementById('typestream-host')?.remove();

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case '__typestream_ping__':
        sendResponse({ ok: true });
        break;

      case MSG.SHOW_OVERLAY:
        console.log(LOG_PREFIX, 'SHOW_OVERLAY:', msg.state);
        setOverlayState(msg.state, { text: msg.text, error: msg.error, action: msg.action });
        if (msg.state === 'listening' && !overlayReadySent) {
          overlayReadySent = true;
          sendToBackground({ type: MSG.OVERLAY_READY });
        } else if (msg.state !== 'listening') {
          overlayReadySent = false;
        }
        sendResponse({ received: true });
        break;

      case MSG.HIDE_OVERLAY:
        overlayReadySent = false;
        finishOverlaySession();
        sendResponse({ received: true });
        break;

      case MSG.INSERT_TEXT: {
        const inserted = insertText(msg.text);
        if (!inserted) {
          copyToClipboard(msg.text).then(() => {
            setOverlayState('resolution', { text: 'Copied to clipboard' });
          });
        } else {
          setOverlayState('resolution', { text: 'Inserted!' });
        }
        sendResponse({ inserted });
        break;
      }

      default:
        sendResponse({ received: false });
        break;
    }
    return true;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEYS.SETTINGS]) return;
    const newSettings = { ...DEFAULT_SETTINGS, ...(changes[STORAGE_KEYS.SETTINGS].newValue || {}) };
    applyFloatingBarSetting(newSettings.showFloatingBar);
  });

  void loadFloatingBarSetting();

  console.log('[Typestream] Content script loaded on:', window.location.href);
}
