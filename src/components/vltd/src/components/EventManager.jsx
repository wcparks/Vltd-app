// ============================================================
// EventManager.jsx — Manager creates and manages events
// Place at: src/components/EventManager.jsx
// Import and render inside your manager dashboard section
// ============================================================
import { useState, useEffect } from 'react';
import { createEvent, getAllEvents, closeEvent } from '../events';

export default function EventManager() {
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    location: '',
    date: new Date().toISOString().split('T')[0],
    passcode: '',
  });

  useEffect(() => { fetchEvents(); }, []);

  async function fetchEvents() {
    const all = await getAllEvents();
    setEvents(all);
  }

  function generatePasscode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name || !form.location || !form.passcode) return;
    setLoading(true);
    try {
      await createEvent({ ...form, passcode: form.passcode.toUpperCase() });
      setForm({ name: '', location: '', date: new Date().toISOString().split('T')[0], passcode: '' });
      setShowForm(false);
      await fetchEvents();
    } finally {
      setLoading(false);
    }
  }

  async function handleClose(id) {
    if (!window.confirm('Mark this event as closed?')) return;
    await closeEvent(id);
    await fetchEvents();
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>📍 Events</h2>
        <button style={styles.btnPrimary} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Event'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={styles.form}>
          <input
            style={styles.input}
            placeholder="Event name (e.g. Smith Wedding)"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            style={styles.input}
            placeholder="Location / Venue"
            value={form.location}
            onChange={e => setForm({ ...form, location: e.target.value })}
            required
          />
          <input
            style={styles.input}
            type="date"
            value={form.date}
            onChange={e => setForm({ ...form, date: e.target.value })}
            required
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ ...styles.input, flex: 1, fontFamily: 'monospace', letterSpacing: 3, textTransform: 'uppercase' }}
              placeholder="PASSCODE"
              value={form.passcode}
              onChange={e => setForm({ ...form, passcode: e.target.value.toUpperCase() })}
              maxLength={8}
              required
            />
            <button
              type="button"
              style={styles.btnSecondary}
              onClick={() => setForm({ ...form, passcode: generatePasscode() })}
            >
              Generate
            </button>
          </div>
          <button type="submit" style={styles.btnPrimary} disabled={loading}>
            {loading ? 'Creating…' : 'Create Event'}
          </button>
        </form>
      )}

      <div style={styles.eventList}>
        {events.map(ev => (
          <div key={ev.id} style={{ ...styles.eventCard, opacity: ev.active ? 1 : 0.5 }}>
            <div style={styles.eventInfo}>
              <div style={styles.eventName}>
                {ev.active ? '🟢' : '🔴'} {ev.name}
              </div>
              <div style={styles.eventMeta}>{ev.location} · {ev.date}</div>
              <div style={styles.passcode}>
                Code: <span style={styles.passcodeVal}>{ev.passcode}</span>
              </div>
              <div style={styles.eventMeta}>
                {ev.ticketCounter || 0} tickets created
              </div>
            </div>
            {ev.active && (
              <button style={styles.btnClose} onClick={() => handleClose(ev.id)}>
                Close
              </button>
            )}
          </div>
        ))}
        {events.length === 0 && (
          <div style={styles.empty}>No events yet. Create your first event above.</div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: 16 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { margin: 0, fontSize: 20, fontWeight: 700 },
  form: { display: 'flex', flexDirection: 'column', gap: 10, background: '#f8f8f8', padding: 16, borderRadius: 12, marginBottom: 16 },
  input: { padding: '12px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 15, width: '100%', boxSizing: 'border-box' },
  btnPrimary: { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 20px', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  btnSecondary: { background: '#eee', color: '#333', border: 'none', borderRadius: 8, padding: '12px 16px', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' },
  btnClose: { background: '#fee', color: '#c00', border: '1px solid #fcc', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' },
  eventList: { display: 'flex', flexDirection: 'column', gap: 10 },
  eventCard: { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  eventInfo: { flex: 1 },
  eventName: { fontWeight: 700, fontSize: 16, marginBottom: 4 },
  eventMeta: { fontSize: 13, color: '#777', marginBottom: 2 },
  passcode: { fontSize: 13, color: '#555', marginBottom: 2 },
  passcodeVal: { fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2, color: '#1a1a1a', background: '#f0f0f0', padding: '2px 6px', borderRadius: 4 },
  empty: { textAlign: 'center', color: '#aaa', padding: 32 },
};
