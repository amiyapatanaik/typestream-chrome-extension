const historyList = document.getElementById('history-list');
const emptyState = document.getElementById('empty-state');
const emptyHint = document.getElementById('empty-hint');
const settingsBtn = document.getElementById('settings-btn');
const toast = document.getElementById('toast');

let toastTimer = null;

// ── Shortcut display ─────────────────────────────────────────────────

const MODIFIER_LABELS = {
  '⇧': '⇧',
  Shift: '⇧',
  '⌘': '⌘',
  Command: '⌘',
  '⌃': '⌃',
  Ctrl: '⌃',
  Control: '⌃',
  '⌥': '⌥',
  Alt: '⌥',
  Option: '⌥',
};

function parseShortcutKeys(shortcut) {
  if (shortcut.includes('+')) {
    return shortcut.split('+').map((key) => key.trim()).filter(Boolean);
  }

  const keys = [];
  let i = 0;
  const modifiers = new Set(['⇧', '⌘', '⌃', '⌥']);

  while (i < shortcut.length) {
    if (modifiers.has(shortcut[i])) {
      keys.push(shortcut[i]);
      i += 1;
    } else {
      keys.push(shortcut.slice(i));
      break;
    }
  }

  return keys;
}

function formatKeyLabel(key) {
  if (MODIFIER_LABELS[key]) return MODIFIER_LABELS[key];
  if (key.length === 1) return key.toUpperCase();
  return key;
}

function renderShortcutHint(shortcut) {
  emptyHint.replaceChildren();

  if (!shortcut || shortcut.startsWith('Not set')) {
    emptyHint.textContent = shortcut;
    return;
  }

  const prefix = document.createElement('span');
  prefix.className = 'empty-hint-text';
  prefix.textContent = 'Press';
  emptyHint.appendChild(prefix);

  const keysWrapper = document.createElement('span');
  keysWrapper.className = 'shortcut-keys';
  keysWrapper.setAttribute('aria-label', shortcut);

  parseShortcutKeys(shortcut).forEach((key) => {
    const kbd = document.createElement('kbd');
    kbd.className = 'shortcut-key';
    kbd.textContent = formatKeyLabel(key);
    keysWrapper.appendChild(kbd);
  });

  emptyHint.appendChild(keysWrapper);

  const suffix = document.createElement('span');
  suffix.className = 'empty-hint-text';
  suffix.textContent = 'to start';
  emptyHint.appendChild(suffix);
}

async function getShortcutLabel() {
  try {
    const commands = await chrome.commands.getAll();
    const cmd = commands.find((c) => c.name === 'toggle-dictation');
    if (cmd && cmd.shortcut) return cmd.shortcut;
  } catch {}
  return 'Not set — go to Settings';
}

// ── Relative timestamps ─────────────────────────────────────────────

function formatTimestamp(isoString) {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin === 1) return '1 min ago';
  if (diffMin < 60) return `${diffMin} mins ago`;
  if (diffHr === 1) return '1 hour ago';
  if (diffHr < 24) return `${diffHr} hours ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;

  return new Date(isoString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

// ── Render ──────────────────────────────────────────────────────────

function renderHistory(history) {
  historyList.innerHTML = '';

  if (!history || history.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  history.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'dictation-card';

    card.innerHTML = `
      <p class="card-text">${escapeHtml(item.text)}</p>
      <span class="card-time">${formatTimestamp(item.timestamp)}</span>
      <div class="card-actions">
        <button class="card-btn delete-btn" data-id="${item.id}" aria-label="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
        <button class="card-btn copy-btn" data-text="${escapeAttr(item.text)}" aria-label="Copy">
          Copy
        </button>
      </div>
    `;

    card.querySelector('.copy-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      copyText(item.text);
    });

    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteItem(item.id);
    });

    historyList.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Actions ─────────────────────────────────────────────────────────

async function loadHistory() {
  const data = await chrome.storage.local.get('history');
  renderHistory(data.history || []);
}

async function deleteItem(id) {
  const data = await chrome.storage.local.get('history');
  const history = (data.history || []).filter((item) => item.id !== id);
  await chrome.storage.local.set({ history });
  renderHistory(history);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback
  }
  showToast();
}

function showToast() {
  clearTimeout(toastTimer);
  toast.classList.remove('show', 'hide');
  void toast.offsetWidth;
  toast.classList.add('show');
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
  }, 2000);
}

// ── Init ────────────────────────────────────────────────────────────

async function init() {
  const shortcut = await getShortcutLabel();
  renderShortcutHint(shortcut);
  loadHistory();

  settingsBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
  });
}

document.addEventListener('DOMContentLoaded', init);
