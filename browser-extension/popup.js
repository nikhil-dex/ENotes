const baseUrlInput = document.querySelector('#base-url');
const codeInput = document.querySelector('#pairing-code');
const connectButton = document.querySelector('#connect');
const statusEl = document.querySelector('#status');
const pairingForm = document.querySelector('#pairing-form');
const connectedPanel = document.querySelector('#connected-panel');
const connectedUrl = document.querySelector('#connected-url');
const connectedExpiry = document.querySelector('#connected-expiry');

const DRAFT_TTL_MS = 5 * 60 * 1000;

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function showConnected({ baseUrl, expiresAt }) {
  pairingForm.hidden = true;
  connectedPanel.hidden = false;
  connectedUrl.textContent = baseUrl || 'Your ENotes site';
  connectedExpiry.textContent = expiresAt
    ? 'Token expires ' + new Date(expiresAt).toLocaleString() + '.'
    : 'Connection expiry is unknown.';
  showStatus('You are connected. Open any website and use the floating N widget to save a note.');
}

function showPairingForm() {
  pairingForm.hidden = false;
  connectedPanel.hidden = true;
}

async function restorePopupState() {
  const state = await chrome.storage.local.get([
    'baseUrl',
    'token',
    'expiresAt',
    'pairingCodeDraft',
    'pairingCodeDraftAt',
    'baseUrlDraft',
  ]);

  const savedBaseUrl = state.baseUrlDraft || state.baseUrl || '';
  baseUrlInput.value = savedBaseUrl;

  const draftIsFresh = state.pairingCodeDraftAt
    && Date.now() - state.pairingCodeDraftAt < DRAFT_TTL_MS;
  if (draftIsFresh && state.pairingCodeDraft) {
    codeInput.value = state.pairingCodeDraft;
  } else {
    await chrome.storage.local.remove(['pairingCodeDraft', 'pairingCodeDraftAt']);
  }

  if (state.token && state.expiresAt && new Date(state.expiresAt).getTime() > Date.now()) {
    showConnected(state);
    return;
  }

  showPairingForm();
  if (state.token || state.expiresAt) {
    showStatus('Your extension connection has expired. Generate a new pairing code in ENotes and reconnect.', true);
  } else {
    showStatus('Enter your ENotes URL and a one-time pairing code. Your progress is saved if this popup closes.');
  }
}

baseUrlInput.addEventListener('input', () => {
  chrome.storage.local.set({ baseUrlDraft: baseUrlInput.value });
});

codeInput.addEventListener('input', () => {
  chrome.storage.local.set({
    pairingCodeDraft: codeInput.value,
    pairingCodeDraftAt: Date.now(),
  });
});

connectButton.addEventListener('click', async () => {
  const code = codeInput.value.trim();
  let baseUrl;

  try {
    const url = new URL(baseUrlInput.value.trim());
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
      throw new Error();
    }
    if (url.username || url.password || url.search || url.hash) throw new Error();
    baseUrl = url.origin;
  } catch {
    showStatus('Enter a valid HTTPS ENotes URL (or localhost for development).', true);
    return;
  }

  if (!code) {
    showStatus('Generate a one-time pairing code in ENotes and paste it here.', true);
    return;
  }

  connectButton.disabled = true;
  showStatus('Requesting access to your ENotes website…');

  try {
    const permission = await chrome.permissions.request({ origins: [baseUrl + '/*'] });
    if (!permission) throw new Error('Host permission was not granted.');

    const result = await chrome.runtime.sendMessage({ type: 'PAIR', baseUrl, code });
    if (!result?.ok) throw new Error(result?.error || 'Could not connect extension.');

    await chrome.storage.local.remove(['pairingCodeDraft', 'pairingCodeDraftAt']);
    codeInput.value = '';
    baseUrlInput.value = baseUrl;
    await chrome.storage.local.set({ baseUrlDraft: baseUrl });
    showConnected({ baseUrl, expiresAt: result.expiresAt });
  } catch (error) {
    showStatus(error.message || 'Could not connect extension.', true);
  } finally {
    connectButton.disabled = false;
  }
});

restorePopupState().catch((error) => {
  showPairingForm();
  showStatus(error.message || 'Could not restore the extension state.', true);
});
