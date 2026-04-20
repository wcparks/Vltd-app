import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import {
  collection, addDoc, onSnapshot, doc, updateDoc, serverTimestamp
} from 'firebase/firestore';

const ACCENT = '#C8F04B';
const CARD = '#161616';
const BORDER = '#2a2a2a';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Generate next N days starting from tomorrow
function getNext14Days() {
  const days = [];
  const today = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const key = d.toISOString().slice(0, 10); // "2025-04-19"
    days.push({
      key,
      label: DAYS[d.getDay()],
      date: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    });
  }
  return days;
}

function defaultDaySchedule() {
  return { active: false, startTime: '18:00', endTime: '23:00', staff: [] };
}

function defaultWeekSchedule() {
  return Object.fromEntries([0,1,2,3,4,5,6].map(d => [d, defaultDaySchedule()]));
}

// Both managers hardcoded — never in valetAccounts
const HARDCODED_MANAGERS = [
  { id: "manager_ivan_m", name: "Ivan M", role: "manager" },
  { id: "manager_malynda_m", name: "Malynda M", role: "manager" },
];

export default function LocationManager() {
  const [locations, setLocations] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', contactName: '', contactPhone: '', notes: '' });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'locations'), snap => {
      setLocations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    // Load valetAccounts staff
    const unsub = onSnapshot(collection(db, 'valetAccounts'), snap => {
      const accounts = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.active);
      setAllStaff(accounts);
    });
    return unsub;
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name || !form.address) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'locations'), {
        ...form, active: true, createdAt: serverTimestamp(),
        weekSchedule: defaultWeekSchedule(),
      });
      setForm({ name: '', address: '', contactName: '', contactPhone: '', notes: '' });
      setShowForm(false);
    } catch (err) {
      alert('Error creating location. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleLocationActive(id, current) {
    await updateDoc(doc(db, 'locations', id), { active: !current });
  }

  if (selected) {
    return (
      <LocationDetail
        location={locations.find(l => l.id === selected) || {}}
        allStaff={allStaff}
        onBack={() => setSelected(null)}
        onToggleActive={toggleLocationActive}
      />
    );
  }

  return (
    <div style={{ color: '#fff', fontFamily: "'DM Mono', monospace" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Locations</div>
        <button onClick={() => setShowForm(!showForm)} style={btnAccent}>
          {showForm ? 'Cancel' : '+ Add Location'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: '#111', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="VENUE NAME" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="The Grand Hotel" required />
          <Field label="ADDRESS" value={form.address} onChange={v => setForm({ ...form, address: v })} placeholder="123 Main St, Orlando FL" required />
          <Field label="CONTACT NAME" value={form.contactName} onChange={v => setForm({ ...form, contactName: v })} placeholder="John Manager" />
          <Field label="CONTACT PHONE" value={form.contactPhone} onChange={v => setForm({ ...form, contactPhone: v })} placeholder="407-555-0000" />
          <Field label="NOTES" value={form.notes} onChange={v => setForm({ ...form, notes: v })} placeholder="Special instructions..." />
          <button type="submit" disabled={loading} style={btnAccent}>
            {loading ? 'Creating...' : 'Create Location'}
          </button>
        </form>
      )}

      <div style={{ fontSize: 9, color: '#888', letterSpacing: '2px', marginBottom: 10 }}>
        ACTIVE ({locations.filter(l => l.active).length})
      </div>

      {locations.filter(l => l.active).map(loc => {
        const ws = loc.weekSchedule || {};
        const activeDays = Object.entries(ws).filter(([, d]) => d.active);
        const totalStaff = new Set(activeDays.flatMap(([, d]) => (d.staff || []).map(s => s.id))).size;
        return (
          <div key={loc.id} onClick={() => setSelected(loc.id)} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 10, cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{loc.name}</div>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>{loc.address}</div>
                <div style={{ fontSize: 10, color: '#888' }}>
                  {activeDays.length > 0 ? activeDays.map(([d]) => DAYS[d]).join(', ') : 'No days scheduled'}
                </div>
                <div style={{ fontSize: 10, color: '#777', marginTop: 2 }}>{totalStaff} staff assigned</div>
              </div>
              <div style={{ background: '#C8F04B22', color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: 8, padding: '4px 10px', fontSize: 9 }}>ACTIVE</div>
            </div>
          </div>
        );
      })}

      {locations.filter(l => !l.active).length > 0 && (
        <>
          <div style={{ fontSize: 9, color: '#555', letterSpacing: '2px', margin: '16px 0 10px' }}>INACTIVE</div>
          {locations.filter(l => !l.active).map(loc => (
            <div key={loc.id} onClick={() => setSelected(loc.id)} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 10, opacity: 0.5, cursor: 'pointer' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{loc.name}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{loc.address}</div>
            </div>
          ))}
        </>
      )}

      {locations.length === 0 && (
        <div style={{ color: '#555', fontSize: 12, textAlign: 'center', padding: 32 }}>No locations yet.</div>
      )}
    </div>
  );
}

function LocationDetail({ location: loc, allStaff, onBack, onToggleActive }) {
  const [weekSchedule, setWeekSchedule] = useState(loc.weekSchedule || defaultWeekSchedule());
  const [editingDay, setEditingDay] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('schedule');

  useEffect(() => {
    if (loc.weekSchedule) setWeekSchedule(loc.weekSchedule);
  }, [loc.id]);

  async function saveSchedule(newSchedule) {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'locations', loc.id), { weekSchedule: newSchedule });
    } finally {
      setSaving(false);
    }
  }

  function toggleDay(i) {
    const updated = { ...weekSchedule, [i]: { ...weekSchedule[i], active: !weekSchedule[i]?.active } };
    setWeekSchedule(updated);
    saveSchedule(updated);
  }

  function updateTime(i, field, val) {
    const updated = { ...weekSchedule, [i]: { ...weekSchedule[i], [field]: val } };
    setWeekSchedule(updated);
    saveSchedule(updated);
  }

  function toggleStaff(i, s) {
    const day = weekSchedule[i] || defaultDaySchedule();
    const exists = (day.staff || []).find(ds => ds.id === s.id);
    const newStaff = exists
      ? day.staff.filter(ds => ds.id !== s.id)
      : [...(day.staff || []), { id: s.id, name: s.name, role: s.role }];
    const updated = { ...weekSchedule, [i]: { ...day, staff: newStaff } };
    setWeekSchedule(updated);
    saveSchedule(updated);
  }

  function fmt(t) {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hr = parseInt(h);
    return `${hr > 12 ? hr - 12 : hr || 12}:${m}${hr >= 12 ? 'pm' : 'am'}`;
  }

  return (
    <div style={{ color: '#fff', fontFamily: "'DM Mono', monospace" }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13, marginBottom: 16, padding: 0 }}>
        &larr; Back
      </button>
      <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{loc.name}</div>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 16 }}>{loc.address}</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['schedule', 'info'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '9px', background: tab === t ? ACCENT : 'transparent', color: tab === t ? '#000' : '#666', border: `1px solid ${tab === t ? ACCENT : BORDER}`, borderRadius: 8, fontSize: 10, fontWeight: tab === t ? 700 : 400, cursor: 'pointer', textTransform: 'uppercase' }}>{t}</button>
        ))}
      </div>

      {tab === 'schedule' && (
        <div>
          <div style={{ fontSize: 9, color: '#888', letterSpacing: '2px', marginBottom: 12 }}>
            NEXT 14 DAYS{saving ? ' (saving...)' : ''}
          </div>

          {getNext14Days().map(({ key, label, date }) => {
            const day = weekSchedule[key] || defaultDaySchedule();
            const isEditing = editingDay === key;

            return (
              <div key={key} style={{ background: CARD, border: `1px solid ${day.active ? ACCENT + '33' : BORDER}`, borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => {
                      const updated = { ...weekSchedule, [key]: { ...(weekSchedule[key] || defaultDaySchedule()), active: !day.active } };
                      setWeekSchedule(updated); saveSchedule(updated);
                    }} style={{ width: 22, height: 22, borderRadius: 11, background: day.active ? ACCENT : '#333', border: 'none', cursor: 'pointer', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: day.active ? '#fff' : '#555' }}>{label} <span style={{ fontWeight: 400, fontSize: 12 }}>{date}</span></div>
                      {day.active && (
                        <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                          {fmt(day.startTime)} - {fmt(day.endTime)} &bull; {(day.staff || []).length} staff
                        </div>
                      )}
                    </div>
                  </div>
                  {day.active && (
                    <button onClick={() => setEditingDay(isEditing ? null : key)} style={{ background: isEditing ? '#C8F04B22' : 'transparent', color: isEditing ? ACCENT : '#666', border: `1px solid ${isEditing ? ACCENT + '44' : BORDER}`, borderRadius: 8, padding: '5px 12px', fontSize: 10, cursor: 'pointer' }}>
                      {isEditing ? 'Done' : 'Edit'}
                    </button>
                  )}
                </div>

                {day.active && isEditing && (
                  <div style={{ borderTop: `1px solid ${BORDER}`, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                      <div style={{ flex: 1 }}>
                        <div style={labelStyle}>START TIME</div>
                        <input type="time" value={day.startTime || '18:00'} onChange={e => {
                          const updated = { ...weekSchedule, [key]: { ...(weekSchedule[key] || defaultDaySchedule()), startTime: e.target.value } };
                          setWeekSchedule(updated); saveSchedule(updated);
                        }} style={inputStyle} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={labelStyle}>END TIME</div>
                        <input type="time" value={day.endTime || '23:00'} onChange={e => {
                          const updated = { ...weekSchedule, [key]: { ...(weekSchedule[key] || defaultDaySchedule()), endTime: e.target.value } };
                          setWeekSchedule(updated); saveSchedule(updated);
                        }} style={inputStyle} />
                      </div>
                    </div>

                    <div style={labelStyle}>ASSIGN STAFF FOR THIS DAY</div>
                    {(() => {
                      const staffWithMgr = [...HARDCODED_MANAGERS, ...allStaff];
                      if (staffWithMgr.length === 0) return <div style={{ fontSize: 11, color: '#555', padding: '8px 0' }}>No staff accounts yet.</div>;
                      return staffWithMgr.map(s => {
                        const assigned = (day.staff || []).some(ds => ds.id === s.id);
                        return (
                          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${BORDER}` }}>
                            <div>
                              <div style={{ fontSize: 13, color: '#fff' }}>{s.name}</div>
                              <div style={{ fontSize: 9, color: '#777', textTransform: 'uppercase', marginTop: 1 }}>{s.role}</div>
                            </div>
                            <button onClick={() => {
                              const exists = (day.staff || []).find(ds => ds.id === s.id);
                              const newStaff = exists ? day.staff.filter(ds => ds.id !== s.id) : [...(day.staff || []), { id: s.id, name: s.name, role: s.role }];
                              const updated = { ...weekSchedule, [key]: { ...(weekSchedule[key] || defaultDaySchedule()), staff: newStaff } };
                              setWeekSchedule(updated); saveSchedule(updated);
                            }} style={{ background: assigned ? '#ff444422' : '#C8F04B22', color: assigned ? '#ff4444' : ACCENT, border: `1px solid ${assigned ? '#ff444433' : ACCENT + '44'}`, borderRadius: 8, padding: '5px 12px', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}>
                              {assigned ? 'Remove' : 'Add'}
                            </button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {day.active && !isEditing && (day.staff || []).length > 0 && (
                  <div style={{ borderTop: `1px solid ${BORDER}`, padding: '8px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {day.staff.map(s => (
                      <div key={s.id} style={{ background: '#1a1a1a', color: '#ccc', border: `1px solid ${BORDER}`, borderRadius: 20, padding: '3px 10px', fontSize: 10 }}>
                        {s.name} <span style={{ color: '#555' }}>({s.role})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <button onClick={() => onToggleActive(loc.id, loc.active)} style={{ background: loc.active ? '#ff444411' : '#C8F04B22', color: loc.active ? '#ff4444' : ACCENT, border: `1px solid ${loc.active ? '#ff444433' : ACCENT + '44'}`, borderRadius: 10, padding: '12px', width: '100%', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 8, fontFamily: "'DM Mono', monospace" }}>
            {loc.active ? 'DEACTIVATE LOCATION' : 'REACTIVATE LOCATION'}
          </button>
        </div>
      )}

      {tab === 'info' && (
        <div>
          {loc.contactName && (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div style={labelStyle}>CONTACT</div>
              <div style={{ fontSize: 14, color: '#fff', marginBottom: 4 }}>{loc.contactName}</div>
              {loc.contactPhone && <div style={{ fontSize: 12, color: '#999' }}>{loc.contactPhone}</div>}
            </div>
          )}
          {loc.notes && (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
              <div style={labelStyle}>NOTES</div>
              <div style={{ fontSize: 13, color: '#ccc' }}>{loc.notes}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <input style={inputStyle} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} />
    </div>
  );
}

const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', background: '#0D0D0D', border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff', fontSize: 13, fontFamily: "'DM Mono', monospace", outline: 'none' };
const labelStyle = { fontSize: 9, color: '#888', letterSpacing: '2px', marginBottom: 6 };
const btnAccent = { background: '#C8F04B', color: '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' };
