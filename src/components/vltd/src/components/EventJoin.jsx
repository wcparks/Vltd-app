// ============================================================
// EventJoin.jsx — Valet joins event by entering passcode
// Place at: src/components/EventJoin.jsx
//
// USAGE in App.js:
//   After valet enters their PIN successfully, show this screen.
//   Once they join, store the event in state:
//
//   const [currentEvent, setCurrentEvent] = useState(null);
//
//   if (role === 'valet' && !currentEvent) {
//     return <EventJoin onJoin={setCurrentEvent} />;
//   }
//
//   Then pass currentEvent.id as eventId to all ticket operations.
// ============================================================
import { useState } from 'react';
import { joinEventByPasscode } from '../events';

export default function EventJoin({ onJoin }) {
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
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.icon}>📍</div>
        <h2 style={styles.title}>Join Event</h2>
        <p style={styles.sub}>Enter the event passcode from your manager</p>
        <input
          style={styles.input}
          placeholder="EVENT CODE"
          value={code}
          onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          maxLength={8}
          autoFocus
        />
        {error && <div style={styles.error}>{error}</div>}
        <button style={styles.btn} onClick={handleJoin} disabled={loading || code.length < 4}>
          {loading ? 'Joining…' : 'Join Event'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 20 },
  card: { background: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 360, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  icon: { fontSize: 48, marginBottom: 8 },
  title: { margin: '0 0 8px', fontSize: 24, fontWeight: 800 },
  sub: { margin: '0 0 24px', color: '#888', fontSize: 14 },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '14px 16px',
    fontSize: 24, fontFamily: 'monospace', fontWeight: 700,
    letterSpacing: 6, textAlign: 'center', textTransform: 'uppercase',
    border: '2px solid #ddd', borderRadius: 12, marginBottom: 12,
    outline: 'none',
  },
  error: { color: '#c00', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: '#fee', borderRadius: 8 },
  btn: {
    width: '100%', padding: '14px', background: '#1a1a1a', color: '#fff',
    border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700,
    cursor: 'pointer', opacity: 1,
  },
};
