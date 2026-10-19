const TOKEN_URL = '/api/extension/token';
const QUICK_NOTES_URL = '/api/extension/quick-notes';
function normalizeBaseUrl(value) {
 const url = new URL(String(value || '').trim());
 if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) throw new Error('Use an HTTPS ENotes URL. HTTP is allowed only for localhost.');
 if (url.username || url.password || url.search || url.hash) throw new Error('Enter only the base URL of your ENotes website.');
 return url.origin;
}
async function fetchJson(url, options) { const response = await fetch(url, options); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'Request failed (' + response.status + ').'); return data; }
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
 if (message?.type === 'PAIR') {
  (async () => { const baseUrl = normalizeBaseUrl(message.baseUrl); const permitted = await chrome.permissions.contains({origins:[baseUrl + '/*']}); if (!permitted) throw new Error('Allow host access to your ENotes website, then try again.'); const data = await fetchJson(baseUrl + TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:message.code})}); await chrome.storage.local.set({baseUrl,token:data.token,expiresAt:data.expiresAt}); sendResponse({ok:true,expiresAt:data.expiresAt}); })().catch(error => sendResponse({error:error.message || 'Could not connect extension.'})); return true;
 }
 if (message?.type === 'CREATE_QUICK_NOTE') {
  (async () => { const {baseUrl,token} = await chrome.storage.local.get(['baseUrl','token']); if (!baseUrl || !token) throw new Error('Connect the extension from its toolbar popup first.'); const data = await fetchJson(baseUrl + QUICK_NOTES_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer ' + token},body:JSON.stringify({content:String(message.content || '')})}); sendResponse({ok:true,title:data.title}); })().catch(error => sendResponse({error:error.message || 'Could not save the quick note.'})); return true;
 }
 return false;
});
