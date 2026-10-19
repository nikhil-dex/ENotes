'use client';

import { useState } from 'react';
import SiteNavbar from '../components/site-navbar';

export default function ExtensionSetupPage() {
  const [code, setCode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function generateCode() {
    setLoading(true); setError(''); setMessage(''); setCode('');
    try {
      const response = await fetch('/api/extension/pairing', { method: 'POST', cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not create a pairing code.');
      setCode(data.code); setExpiresAt(data.expiresAt);
      setMessage('Copy this code into the OgeNotes Quick Note extension. It works once and expires in five minutes.');
    } catch (err) { setError(err.message || 'Could not create a pairing code.'); }
    finally { setLoading(false); }
  }

  async function copyCode() {
    try { await navigator.clipboard.writeText(code); setMessage('Pairing code copied. Return to the browser extension to connect it.'); }
    catch { setError('Clipboard access was blocked. Select and copy the code manually.'); }
  }

  async function revokeAccess() {
    if (!window.confirm('Disconnect all paired browser extensions? Any installed extension will need to be paired again.')) return;
    setRevoking(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/extension/pairing', { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not revoke extension access.');
      setCode(''); setExpiresAt(''); setMessage('Browser extension access revoked. ' + (data.revokedTokens || 0) + ' token(s) revoked.');
    } catch (err) { setError(err.message || 'Could not revoke extension access.'); }
    finally { setRevoking(false); }
  }

  return <main className="shell"><SiteNavbar /><section style={styles.wrap}>
    <p style={styles.eyebrow}>OGENOTES · QUICK CAPTURE</p><h1 style={styles.title}>Browser quick notes</h1>
    <p style={styles.lead}>Capture an idea from any website and save it to your existing Quick Notes. Pairing grants permission to create Quick Notes only; it cannot read, edit, or delete your notes.</p>
    <div style={styles.card}><h2 style={styles.cardTitle}>Connect your extension</h2>
      <ol style={styles.steps}><li>Load the extension folder in Chrome using <strong>Manage extensions → Developer mode → Load unpacked</strong>.</li><li>Enter your ENotes website URL in the extension popup.</li><li>Generate a pairing code here, then paste it into the extension popup within five minutes.</li></ol>
      <button type="button" onClick={generateCode} disabled={loading} style={styles.primary}>{loading ? 'Generating…' : 'Generate one-time pairing code'}</button>
      {code && <div style={styles.codeBox}><code style={styles.code}>{code}</code><button type="button" onClick={copyCode} style={styles.secondary}>Copy code</button><p style={styles.expiry}>Expires: {new Date(expiresAt).toLocaleTimeString()}</p></div>}
      {message && <p role="status" style={styles.success}>{message}</p>}{error && <p role="alert" style={styles.error}>{error}</p>}
      <hr style={styles.hr}/><h2 style={styles.cardTitle}>Security controls</h2><p style={styles.small}>Revoke all extension tokens if you lose access to a browser or want to disconnect the extension. Pairing codes expire after five minutes and can only be used once.</p>
      <button type="button" onClick={revokeAccess} disabled={revoking} style={styles.danger}>{revoking ? 'Revoking…' : 'Revoke all extension access'}</button>
    </div></section></main>;
}

const styles = {
 wrap:{maxWidth:'760px',margin:'32px auto 80px',padding:'0 20px'},
 eyebrow:{fontSize:'11px',letterSpacing:'1.5px',color:'var(--green, #40795e)',fontWeight:700},
 title:{fontSize:'clamp(28px, 5vw, 42px)',letterSpacing:'-1.2px',margin:'8px 0 12px',color:'var(--ink, #1e2925)'},
 lead:{color:'var(--muted, #84908a)',lineHeight:1.7,maxWidth:'680px',marginBottom:'28px'},
 card:{border:'1px solid var(--line, #e8ece9)',borderRadius:'14px',padding:'clamp(18px, 4vw, 30px)',background:'var(--paper, #fff)'},
 cardTitle:{fontSize:'18px',margin:'0 0 14px',color:'var(--ink, #1e2925)'},
 steps:{paddingLeft:'22px',lineHeight:1.9,color:'var(--ink, #1e2925)',marginBottom:'22px'},
 primary:{border:0,borderRadius:'8px',background:'var(--green, #40795e)',color:'#fff',padding:'12px 16px',fontWeight:700,cursor:'pointer'},
 secondary:{border:'1px solid var(--line, #dfe6e1)',borderRadius:'7px',padding:'9px 12px',background:'transparent',cursor:'pointer'},
 codeBox:{marginTop:'18px',border:'1px dashed var(--green, #40795e)',borderRadius:'9px',padding:'16px',display:'grid',gap:'12px'},
 code:{fontSize:'14px',overflowWrap:'anywhere',userSelect:'all'},
 expiry:{fontSize:'12px',color:'var(--muted, #84908a)',margin:0},
 success:{color:'var(--green, #40795e)',fontSize:'13px',lineHeight:1.5},error:{color:'#b42318',fontSize:'13px',lineHeight:1.5},
 hr:{border:0,borderTop:'1px solid var(--line, #e8ece9)',margin:'28px 0'},small:{fontSize:'13px',color:'var(--muted, #84908a)',lineHeight:1.6},
 danger:{border:'1px solid #c44',borderRadius:'8px',background:'transparent',color:'#b42318',padding:'11px 14px',fontWeight:600,cursor:'pointer'}
};
