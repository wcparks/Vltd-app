import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import {
  collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';

const ACCENT = '#C8F04B';
const CARD = '#161616';
const BORDER = '#2a2a2a';

export default function ValetManager() {
  const [valets, setValets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', pin: '', role: 'valet' });
  const [loading, setLoading] = useState(false);
  const [showPins, setShowPins] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'valetAccounts'), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setValets(list);
    });
    return unsub;
  }, []);

  function generatePIN() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim() || form.pin.length !== 4) return;
    // Check for duplicate PIN
    const duplicate = valets.find(v => v.pin === form.pin);
    if (duplicate) { alert(`PIN ${form.pin} is already used by ${duplicate.name}. Choose a different PIN.`); return; }
    setLoading(true);
    try {
      await addDoc(collection(db, 'valetAccounts'), {
        name: form.name.trim(),
        pin: form.pin,
        role: form.role,
        active: true,
        createdAt: serverTimestamp(),
      });
      setForm({ name: '', pin: '', role: 'valet' });
      setShowForm(false);
    } catch (e) {
      alert('Error creating account. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(id, current) {
    await updateDoc(doc(db, 'valetAccounts', id), { active: !current });
  }

  async function resetPIN(id, name) {
    const newPin = generatePIN();
    // Check for duplicate
    const duplicate = valets.find(v => v.pin === newPin && v.id !== id);
    if (duplicate) { resetPIN(id, name); return; } // retry if collision
    await updateDoc(doc(db, 'valetAccounts', id), { pin: newPin });
    alert(`New PIN for ${name}: ${newPin}`);
  }

  async function deleteValet(id, name) {
    if (!window.confirm(`Remove ${name}? This cannot be undone.`)) return;
    await deleteDoc(doc(db, 'valetAccounts', id));
  }

  const activeValets = valets.filter(v => v.active);
  const inactiveValets = valets.filter(v => !v.active);

  return (
    <div style={{ color: '#fff', fontFamily: "'DM Mono', monospace" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Staff Accounts</div>
        <button onClick={() => setShowForm(!showForm)} style={{ background: ACCENT, color: '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {showForm ? 'Cancel' : '+ Add Staff'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: '#111', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={labelStyle}>FULL NAME</div>
            <input style={inputStyle} placeholder="John Smith" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <div style={labelStyle}>ROLE</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['valet', 'supervisor', 'cashier'].map(r => (
                <button key={r} type="button" onClick={() => setForm({ ...form, role: r })}
                  style={{ flex: 1, padding: '10px', background: form.role === r ? '#C8F04B22' : 'transparent', color: form.role === r ? ACCENT : '#666', border: `1px solid ${form.role === r ? ACCENT + '44' : BORDER}`, borderRadius: 8, fontSize: 12, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={labelStyle}>4-DIGIT PIN</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', letterSpacing: 6, fontSize: 20, textAlign: 'center' }}
                placeholder="----"
                value={form.pin}
                onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                type="tel"
                maxLength={4}
                required
              />
              <button type="button" onClick={() => setForm({ ...form, pin: generatePIN() })}
                style={{ background: '#222', color: '#888', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '0 14px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Generate
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading || form.pin.length !== 4} style={{ background: form.pin.length === 4 ? ACCENT : '#222', color: form.pin.length === 4 ? '#000' : '#555', border: 'none', borderRadius: 8, padding: '13px', fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: 1 }}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
      )}

      {/* Active staff */}
      <div style={{ fontSize: 9, color: '#888', letterSpacing: '2px', marginBottom: 10 }}>ACTIVE STAFF ({activeValets.length})</div>
      {activeValets.length === 0 && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, textAlign: 'center', marginBottom: 12 }}>
          <div style={{ color: '#777', fontSize: 12 }}>No staff accounts yet.</div>
          <div style={{ color: '#333', fontSize: 11, marginTop: 6 }}>Add your first valet above.</div>
        </div>
      )}
      {activeValets.map(v => (
        <div key={v.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{v.name}</div>
              <div style={{ fontSize: 10, color: '#999', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{v.role}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontFamily: 'monospace', fontSize: 18, color: showPins[v.id] ? ACCENT : '#444', letterSpacing: 4, fontWeight: 700 }}>
                  {showPins[v.id] ? v.pin : '????'}
                </div>
                <button onClick={() => setShowPins(p => ({ ...p, [v.id]: !p[v.id] }))}
                  style={{ background: 'transparent', border: `1px solid ${BORDER}`, color: '#999', borderRadius: 6, padding: '3px 8px', fontSize: 10, cursor: 'pointer' }}>
                  {showPins[v.id] ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={() => resetPIN(v.id, v.name)} style={{ background: '#C8F04B11', color: ACCENT, border: `1px solid ${ACCENT}33`, borderRadius: 8, padding: '6px 10px', fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Reset PIN
              </button>
              <button onClick={() => toggleActive(v.id, v.active)} style={{ background: '#ff444411', color: '#ff4444', border: '1px solid #ff444433', borderRadius: 8, padding: '6px 10px', fontSize: 10, cursor: 'pointer' }}>
                Deactivate
              </button>
              <button onClick={() => {
                const confirm = window.prompt(`Type DELETE to permanently remove ${v.name}`);
                if (confirm === 'DELETE') deleteValet(v.id, v.name);
              }} style={{ background: '#ff000011', color: '#ff4444', border: '1px solid #ff000033', borderRadius: 8, padding: '6px 10px', fontSize: 10, cursor: 'pointer' }}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Inactive staff */}
      {inactiveValets.length > 0 && (
        <>
          <div style={{ fontSize: 9, color: '#777', letterSpacing: '2px', margin: '16px 0 10px' }}>INACTIVE ({inactiveValets.length})</div>
          {inactiveValets.map(v => (
            <div key={v.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 10, opacity: 0.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{v.name}</div>
                  <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>{v.role}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => toggleActive(v.id, v.active)} style={{ background: '#C8F04B11', color: ACCENT, border: `1px solid ${ACCENT}33`, borderRadius: 8, padding: '6px 10px', fontSize: 10, cursor: 'pointer' }}>
                    Reactivate
                  </button>
                  <button onClick={() => deleteValet(v.id, v.name)} style={{ background: '#ff444411', color: '#ff4444', border: '1px solid #ff444433', borderRadius: 8, padding: '6px 10px', fontSize: 10, cursor: 'pointer' }}>
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '12px', background: '#0D0D0D', border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff', fontSize: 14, fontFamily: "'DM Mono', monospace", outline: 'none' };
const labelStyle = { fontSize: 9, color: '#888', letterSpacing: '2px', marginBottom: 6 };
