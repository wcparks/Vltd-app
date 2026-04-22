import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import {
  collection, getDocs, doc, updateDoc,
  onSnapshot, query, where, deleteDoc
} from 'firebase/firestore';
import { createEvent, getAllEvents, closeEvent } from '../services/eventService';

const ACCENT = '#C8F04B';
const CARD = '#161616';
const BORDER = '#2a2a2a';

// -- Manager: full event management + shift posting ---------
export default function EventManager({ managerName }) {
  const [tab, setTab] = useState('active');
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', location: '', date: new Date().toISOString().split('T')[0], passcode: '', spotsNeeded: '4', notes: '' });
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => { fetchEvents(); }, [tab]);

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
      await createEvent({
        ...form,
        passcode: form.passcode.toUpperCase(),
        spotsNeeded: parseInt(form.spotsNeeded) || 4,
        status: 'upcoming',
      });
      setForm({ name: '', location: '', date: new Date().toISOString().split('T')[0], passcode: '', spotsNeeded: '4', notes: '' });
      setShowForm(false);
      await fetchEvents();
    } catch (err) {
      alert('Error creating event. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleClose(id) {
    if (!window.confirm('Close this event? Valets will no longer be able to join.')) return;
    await closeEvent(id);
    await fetchEvents();
  }

  async function handleDeleteEvent(ev) {
    const confirm = window.prompt(`Type DELETE to permanently remove "${ev.name}" and all its tickets`);
    if (confirm !== 'DELETE') return;
    try {
      // Delete all tickets for this event
      const ticketSnap = await getDocs(query(collection(db, 'tickets'), where('eventId', '==', ev.id)));
      await Promise.all(ticketSnap.docs.map(d => deleteDoc(doc(db, 'tickets', d.id))));
      // Delete all availability requests
      const availSnap = await getDocs(query(collection(db, 'availability'), where('eventId', '==', ev.id)));
      await Promise.all(availSnap.docs.map(d => deleteDoc(doc(db, 'availability', d.id))));
      // Delete the event itself
      await deleteDoc(doc(db, 'events', ev.id));
      await fetchEvents();
    } catch (e) {
      alert('Error deleting event. Try again.');
    }
  }

  const activeEvents = events.filter(e => e.active);
  const pastEvents = events.filter(e => !e.active);

  if (selectedEvent) {
    return <EventDetail event={selectedEvent} onBack={() => { setSelectedEvent(null); fetchEvents(); }} />;
  }

  return (
    <div style={{ color: '#fff', fontFamily: "'DM Mono', monospace" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Events</div>
        <button onClick={() => setShowForm(!showForm)} style={{ background: ACCENT, color: '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {showForm ? 'Cancel' : '+ New'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: '#111', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input style={inputStyle} placeholder="Event name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <input style={inputStyle} placeholder="Location / Venue" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} required />
          <input style={inputStyle} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
          <input style={inputStyle} placeholder="Notes for valets (optional)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>VALETS NEEDED</div>
              <input style={inputStyle} type="number" min="1" max="20" value={form.spotsNeeded} onChange={e => setForm({ ...form, spotsNeeded: e.target.value })} />
            </div>
            <div style={{ flex: 2 }}>
              <div style={labelStyle}>PASSCODE</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...inputStyle, flex: 1, letterSpacing: 3, textTransform: 'uppercase', fontFamily: 'monospace' }}
                  placeholder="CODE" value={form.passcode}
                  onChange={e => setForm({ ...form, passcode: e.target.value.toUpperCase() })} maxLength={8} required />
                <button type="button" onClick={() => setForm({ ...form, passcode: generatePasscode() })}
                  style={{ background: '#222', color: '#888', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '0 12px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Generate
                </button>
              </div>
            </div>
          </div>
          <button type="submit" disabled={loading} style={{ background: ACCENT, color: '#000', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {loading ? 'Creating...' : 'Create Event'}
          </button>
        </form>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['active', 'history'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '10px', background: tab === t ? ACCENT : 'transparent', color: tab === t ? '#000' : '#666', border: `1px solid ${tab === t ? ACCENT : BORDER}`, borderRadius: 8, fontSize: 11, fontWeight: tab === t ? 700 : 400, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1 }}>
            {t === 'active' ? `Active (${activeEvents.length})` : `History (${pastEvents.length})`}
          </button>
        ))}
      </div>

      {tab === 'active' && (
        <div>
          {activeEvents.length === 0 && <div style={{ color: '#777', fontSize: 12, textAlign: 'center', padding: 32 }}>No active events. Create one above.</div>}
          {activeEvents.map(ev => (
            <div key={ev.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{ev.name}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{ev.location} - {ev.date}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                    Code: <span style={{ fontFamily: 'monospace', color: ACCENT, letterSpacing: 2 }}>{ev.passcode}</span>
                    {' '}- {ev.ticketCounter || 0} tickets
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 8 }}>
                  <button onClick={() => setSelectedEvent(ev)} style={{ background: '#C8F04B22', color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: 8, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>Details</button>
                  <button onClick={() => handleClose(ev.id)} style={{ background: '#ff444411', color: '#ff4444', border: '1px solid #ff444433', borderRadius: 8, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>Close</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div>
          {pastEvents.length === 0 && <div style={{ color: '#777', fontSize: 12, textAlign: 'center', padding: 32 }}>No past events yet.</div>}
          {pastEvents.map(ev => (
            <div key={ev.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setSelectedEvent(ev)}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{ev.name}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{ev.location} - {ev.date}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{ev.ticketCounter || 0} tickets</div>
                </div>
                <button onClick={() => handleDeleteEvent(ev)} style={{ background: '#ff000011', color: '#ff4444', border: '1px solid #ff000033', borderRadius: 8, padding: '6px 12px', fontSize: 11, cursor: 'pointer', marginLeft: 8, whiteSpace: 'nowrap' }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -- Event detail: roster, availability, shift closeout -----
function EventDetail({ event, onBack }) {
  const [requests, setRequests] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [tab, setTab] = useState('roster');
  const [shiftClosed, setShiftClosed] = useState(event.shiftClosed || false);

  useEffect(() => {
    // Load availability requests
    const q = query(collection(db, 'availability'), where('eventId', '==', event.id));
    const unsub = onSnapshot(q, snap => setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [event.id]);

  useEffect(() => {
    // Load tickets for this event
    const q = query(collection(db, 'tickets'), where('eventId', '==', event.id));
    const unsub = onSnapshot(q, snap => setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [event.id]);

  async function confirmRequest(reqId, valetName) {
    await updateDoc(doc(db, 'availability', reqId), { status: 'confirmed' });
  }

  async function denyRequest(reqId) {
    await updateDoc(doc(db, 'availability', reqId), { status: 'denied' });
  }

  async function closeShift() {
    if (!window.confirm('Close this shift? This will archive all delivered tickets and generate a final summary.')) return;
    await updateDoc(doc(db, 'events', event.id), { shiftClosed: true, shiftClosedAt: Date.now() });
    setShiftClosed(true);
  }

  const confirmed = requests.filter(r => r.status === 'confirmed');
  const pending = requests.filter(r => r.status === 'pending');
  const denied = requests.filter(r => r.status === 'denied');

  // Shift summary stats
  const delivered = tickets.filter(t => t.status === 'delivered');
  const totalTips = tickets.reduce((s, t) => s + (t.tip || 0), 0);
  const rated = tickets.filter(t => t.rating > 0);
  const avgRating = rated.length ? (rated.reduce((s, t) => s + t.rating, 0) / rated.length).toFixed(1) : '--';
  const valetNames = [...new Set(tickets.map(t => t.createdBy).filter(Boolean))];

  // Tip split
  const tipsByValet = {};
  tickets.forEach(t => {
    if (t.tip > 0 && t.createdBy) {
      tipsByValet[t.createdBy] = (tipsByValet[t.createdBy] || 0) + t.tip;
    }
  });

  return (
    <div style={{ color: '#fff', fontFamily: "'DM Mono', monospace" }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13, marginBottom: 16, padding: 0 }}>
        &larr; Back
      </button>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{event.name}</div>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 16 }}>{event.location} - {event.date}</div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
        {['roster', 'summary', 'tips', 'tickets'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 14px', background: tab === t ? ACCENT : 'transparent', color: tab === t ? '#000' : '#666', border: `1px solid ${tab === t ? ACCENT : BORDER}`, borderRadius: 8, fontSize: 10, fontWeight: tab === t ? 700 : 400, cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            {t}
          </button>
        ))}
      </div>

      {/* ROSTER TAB */}
      {tab === 'roster' && (
        <div>
          {pending.length > 0 && (
            <>
              <div style={sectionLabel}>PENDING REQUESTS ({pending.length})</div>
              {pending.map(r => (
                <div key={r.id} style={{ background: CARD, border: `1px solid #ffcc0044`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{r.valetName}</div>
                      <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Requested {new Date(r.requestedAt).toLocaleDateString()}</div>
                      {r.note && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>"{r.note}"</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => confirmRequest(r.id, r.valetName)} style={{ background: '#C8F04B22', color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: 8, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>Confirm</button>
                      <button onClick={() => denyRequest(r.id)} style={{ background: '#ff444411', color: '#ff4444', border: '1px solid #ff444433', borderRadius: 8, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>Deny</button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          <div style={sectionLabel}>CONFIRMED ({confirmed.length})</div>
          {confirmed.length === 0 && <div style={{ color: '#777', fontSize: 12, marginBottom: 16 }}>No confirmed valets yet.</div>}
          {confirmed.map(r => (
            <div key={r.id} style={{ background: CARD, border: `1px solid ${ACCENT}33`, borderRadius: 12, padding: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{r.valetName}</div>
              <div style={{ fontSize: 10, color: ACCENT, marginTop: 2 }}>CONFIRMED</div>
            </div>
          ))}

          {denied.length > 0 && (
            <>
              <div style={sectionLabel}>DENIED ({denied.length})</div>
              {denied.map(r => (
                <div key={r.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, marginBottom: 8, opacity: 0.5 }}>
                  <div style={{ fontSize: 13, color: '#fff' }}>{r.valetName}</div>
                  <div style={{ fontSize: 10, color: '#ff4444', marginTop: 2 }}>DENIED</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* SUMMARY TAB */}
      {tab === 'summary' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'TOTAL CARS', value: tickets.length },
              { label: 'DELIVERED', value: delivered.length },
              { label: 'TOTAL TIPS', value: `$${totalTips}` },
              { label: 'AVG RATING', value: avgRating + '/5' },
              { label: 'VALETS', value: valetNames.length },
              { label: 'ACTIVE', value: tickets.filter(t => t.status !== 'delivered').length },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#111', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontFamily: 'sans-serif', fontWeight: 900, color: ACCENT }}>{value}</div>
                <div style={{ fontSize: 8, color: '#888', letterSpacing: '1.5px', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={sectionLabel}>BY VALET</div>
          {valetNames.map(name => {
            const vt = tickets.filter(t => t.createdBy === name);
            const tips = vt.reduce((s, t) => s + (t.tip || 0), 0);
            const r = vt.filter(t => t.rating > 0);
            const avg = r.length ? (r.reduce((s, t) => s + t.rating, 0) / r.length).toFixed(1) : '--';
            return (
              <div key={name} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{name}</div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{vt.length} cars - ${tips} tips - {avg}/5</div>
                  </div>
                  <div style={{ fontSize: 24, color: ACCENT, fontFamily: 'sans-serif', fontWeight: 900 }}>{vt.length}</div>
                </div>
              </div>
            );
          })}

          {!shiftClosed && event.active && (
            <button onClick={closeShift} style={{ background: '#ff444422', color: '#ff4444', border: '1px solid #ff444433', borderRadius: 12, padding: 14, width: '100%', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 16, fontFamily: 'sans-serif' }}>
              CLOSE SHIFT
            </button>
          )}
          {shiftClosed && (
            <div style={{ background: '#1a2a0a', border: `1px solid ${ACCENT}44`, borderRadius: 12, padding: 14, textAlign: 'center', marginTop: 16 }}>
              <div style={{ color: ACCENT, fontSize: 13, fontWeight: 700 }}>SHIFT CLOSED</div>
              <div style={{ color: '#999', fontSize: 11, marginTop: 4 }}>Final summary recorded</div>
            </div>
          )}
        </div>
      )}

      {/* TIP SPLIT TAB */}
      {tab === 'tips' && (
        <div>
          <div style={{ background: '#111', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontFamily: 'sans-serif', fontWeight: 900, color: ACCENT }}>${totalTips.toFixed(2)}</div>
            <div style={{ fontSize: 10, color: '#888', letterSpacing: '1.5px', marginTop: 4 }}>TOTAL TIPS</div>
          </div>

          <div style={sectionLabel}>BY VALET</div>
          {Object.entries(tipsByValet).sort((a, b) => b[1] - a[1]).map(([name, amount]) => {
            const pct = totalTips > 0 ? Math.round((amount / totalTips) * 100) : 0;
            return (
              <div key={name} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{name}</div>
                  <div style={{ fontSize: 18, fontFamily: 'sans-serif', fontWeight: 900, color: ACCENT }}>${amount.toFixed(2)}</div>
                </div>
                <div style={{ height: 6, background: '#222', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: ACCENT, borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>{pct}% of total</div>
              </div>
            );
          })}

          {valetNames.length > 1 && totalTips > 0 && (
            <div style={{ background: '#111', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginTop: 8 }}>
              <div style={sectionLabel}>EQUAL SPLIT</div>
              <div style={{ fontSize: 24, fontFamily: 'sans-serif', fontWeight: 900, color: ACCENT, textAlign: 'center' }}>
                ${(totalTips / valetNames.length).toFixed(2)}
              </div>
              <div style={{ fontSize: 10, color: '#888', textAlign: 'center', marginTop: 4 }}>per valet ({valetNames.length} valets)</div>
            </div>
          )}

          {Object.keys(tipsByValet).length === 0 && (
            <div style={{ color: '#777', fontSize: 12, textAlign: 'center', padding: 32 }}>No tips recorded yet.</div>
          )}
        </div>
      )}

      {/* TICKETS TAB */}
      {tab === 'tickets' && (
        <div>
          <div style={sectionLabel}>ALL TICKETS ({tickets.length})</div>
          {tickets.length === 0 && <div style={{ color: '#777', fontSize: 12, textAlign: 'center', padding: 32 }}>No tickets yet.</div>}
          {tickets.map(t => (
            <div key={t.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 16, fontFamily: 'sans-serif', fontWeight: 900, color: '#fff' }}>#{t.ticketNum}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{t.color} {t.car} - {t.plate}</div>
                  <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{t.createdBy}{t.retrievedBy ? ` - Retrieved: ${t.retrievedBy}` : ''}</div>
                  {t.tip > 0 && <div style={{ fontSize: 11, color: ACCENT, marginTop: 2 }}>${t.tip} tip - {t.rating}/5</div>}
                </div>
                <div style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 9, letterSpacing: 1, background: t.status === 'parked' ? '#1a2a0a' : t.status === 'retrieving' ? '#1a1500' : '#111', color: t.status === 'parked' ? ACCENT : t.status === 'retrieving' ? '#ffcc00' : '#555', border: `1px solid ${t.status === 'parked' ? ACCENT + '44' : '#33333344'}` }}>
                  {t.status?.toUpperCase()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const sectionLabel = { fontSize: 9, color: '#888', letterSpacing: '2px', marginBottom: 10, marginTop: 4 };
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', background: '#0D0D0D', border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff', fontSize: 13, fontFamily: "'DM Mono', monospace", outline: 'none' };
const labelStyle = { fontSize: 9, color: '#888', letterSpacing: '2px', marginBottom: 4 };
