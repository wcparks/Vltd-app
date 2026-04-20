import { useState } from 'react';
import { joinEventByPasscode } from '../services/eventService';

const ACCENT = '#C8F04B';

export default function EventJoin({ onJoin, onBack }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    if (code.trim().length < 4) return;
    setLoading(true);
    setError('');
    try {
      const event = await joinEventByPasscode(code.trim());
      if (!event) {
        setError('Invalid or inactive passcode. Check with your manager.');
      } else {
        onJoin(event);
      }
    } catch (err) {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "'DM Mono', monospace" }}>
      {onBack && (
        <button onClick={onBack} style={{ position: 'absolute', top: 20, left: 20, background: 'transparent', border: '1px solid #2a2a2a', color: '#999', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
          Back
        </button>
      )}
      <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
        <div style={{ fontFamily: 'sans-serif', fontSize: '22px', fontWeight: 900, color: ACCENT, marginBottom: '6px' }}>VLTD</div>
        <div style={{ fontSize: '10px', color: '#888', letterSpacing: '3px', marginBottom: '40px' }}>JOIN EVENT</div>

        <div style={{ fontSize: '14px', color: '#888', marginBottom: '20px' }}>Enter the passcode from your manager</div>

        <input
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '18px 16px', fontSize: '28px',
            fontFamily: "'DM Mono', monospace", fontWeight: 700,
            letterSpacing: '8px', textAlign: 'center',
            textTransform: 'uppercase', background: '#111',
            border: `2px solid ${error ? '#ff4444' : '#2a2a2a'}`,
            borderRadius: '14px', color: '#fff', outline: 'none',
            marginBottom: '12px',
          }}
          placeholder="- - - - -"
          value={code}
          onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          maxLength={8}
          autoFocus
        />

        {error && (
          <div style={{ color: '#ff4444', fontSize: '12px', marginBottom: '12px', padding: '10px', background: '#ff444411', borderRadius: '8px' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleJoin}
          disabled={loading || code.length < 4}
          style={{
            width: '100%', padding: '15px',
            background: code.length >= 4 ? ACCENT : '#222',
            color: code.length >= 4 ? '#000' : '#444',
            border: 'none', borderRadius: '12px',
            fontSize: '13px', fontWeight: 700,
            cursor: code.length >= 4 ? 'pointer' : 'default',
            fontFamily: 'sans-serif', letterSpacing: '1px',
          }}
        >
          {loading ? 'JOINING...' : 'JOIN EVENT'}
        </button>
      </div>
    </div>
  );
}
