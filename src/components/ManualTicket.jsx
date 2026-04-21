import { useState, useRef } from 'react';
import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { getNextTicketNumber } from '../services/eventService';
import { createManualTicketService } from '../services/ticketService';

const ACCENT = '#C8F04B';
const CARD = '#161616';
const BORDER = '#2a2a2a';

export default function ManualTicket({ valetName, valetRole, currentEvent, onClose, ticketId = null, initialData = null }) {
  const [step, setStep] = useState('details'); // details -> tip -> done
  const [form, setForm] = useState({
    paperTicketNum: initialData?.paperTicketNum || '',
    plate: initialData?.plate || '',
    make: initialData?.make || '',
    model: initialData?.model || '',
    color: initialData?.color || '',
    spot: initialData?.spot || '',
    customerName: initialData?.customerName || '',
    customerPhone: initialData?.customerPhone || '',
    damage: initialData?.damage || '',
    notes: initialData?.notes || '',
  });
  const [tipAmount, setTipAmount] = useState(0);
  const [customTip, setCustomTip] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [createdTicket, setCreatedTicket] = useState(null);

  const finalTip = showCustom && customTip ? parseFloat(customTip) || 0 : tipAmount;

  async function createManualTicket() {
    console.log("BUTTON CLICKED");
    setLoading(true);
    try {
      console.log("CALLING SERVICE");
      const result = await createManualTicketService({
        form,
        valetName,
        currentEvent,
        tipAmount: finalTip,
        paymentMethod,
        ticketId,
        initialData
      });

      setCreatedTicket(result);
      setStep('done');

    } catch (err) {
      console.error("MANUAL TICKET ERROR:", err);
      console.error("FULL OBJECT:", JSON.stringify(err, null, 2));
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (step === 'done' && createdTicket) {
    return (
      <div style={{ background: '#0D0D0D', minHeight: '100vh', color: '#fff', fontFamily: "'DM Mono', monospace", padding: 20, paddingTop: 'calc(20px + env(safe-area-inset-top))' }}>
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <div style={{ fontSize: 56, color: ACCENT, marginBottom: 16 }}>&#10003;</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 8 }}>{ticketId ? 'Ticket Updated' : 'Ticket Created'}</div>
          <div style={{ fontSize: 48, fontFamily: 'monospace', fontWeight: 900, color: ACCENT, marginBottom: 8 }}>#{createdTicket.num}</div>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>LOGGED BY: {valetName}</div>
          {finalTip > 0 && <div style={{ fontSize: 14, color: ACCENT, marginBottom: 4 }}>${finalTip} tip - {paymentMethod.toUpperCase()}</div>}
          <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!ticketId && (
              <button onClick={() => { setStep('details'); setForm({ paperTicketNum: '', plate: '', make: '', model: '', color: '', spot: '', customerName: '', customerPhone: '', damage: '', notes: '' }); setTipAmount(0); setCreatedTicket(null); }}
                style={{ background: ACCENT, color: '#000', border: 'none', borderRadius: 12, padding: 15, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                + NEW MANUAL TICKET
              </button>
            )}
            <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #2a2a2a', color: '#666', borderRadius: 12, padding: 15, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'tip') {
    return (
      <div style={{ background: '#0D0D0D', minHeight: '100vh', color: '#fff', fontFamily: "'DM Mono', monospace", padding: 20, paddingTop: 'calc(20px + env(safe-area-inset-top))' }}>
        <button onClick={() => setStep('details')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13, marginBottom: 20, padding: 0 }}>&larr; Back</button>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Record Tip</div>
        <div style={{ fontSize: 11, color: '#666', marginBottom: 24 }}>Ticket #{form.plate} - {form.make} {form.model}</div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: '#888', letterSpacing: '2px', marginBottom: 12 }}>TIP AMOUNT</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {[2, 5, 10, 20].map(amt => (
              <button key={amt} onClick={() => { setTipAmount(amt); setShowCustom(false); setCustomTip(''); }}
                style={{ flex: 1, background: tipAmount === amt && !showCustom ? '#C8F04B22' : 'transparent', border: `1px solid ${tipAmount === amt && !showCustom ? ACCENT : BORDER}`, borderRadius: 10, padding: '12px 0', color: tipAmount === amt && !showCustom ? ACCENT : '#aaa', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>
                ${amt}
              </button>
            ))}
            <button onClick={() => { setShowCustom(true); setTipAmount(0); }}
              style={{ flex: 1, background: showCustom ? '#C8F04B22' : 'transparent', border: `1px solid ${showCustom ? ACCENT : BORDER}`, borderRadius: 10, padding: '12px 0', color: showCustom ? ACCENT : '#aaa', fontSize: 12, cursor: 'pointer' }}>
              Other
            </button>
          </div>
          {showCustom && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ color: ACCENT, fontSize: 20, fontWeight: 700 }}>$</span>
              <input type="number" placeholder="0" value={customTip} onChange={e => setCustomTip(e.target.value)} autoFocus min="0"
                style={{ flex: 1, padding: 12, background: '#111', border: `1px solid ${BORDER}`, borderRadius: 10, color: ACCENT, fontSize: 20, fontWeight: 700, textAlign: 'center', outline: 'none' }} />
            </div>
          )}
        </div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: '#888', letterSpacing: '2px', marginBottom: 12 }}>PAYMENT METHOD</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['cash', 'card', 'cashapp', 'venmo'].map(m => (
              <button key={m} onClick={() => setPaymentMethod(m)}
                style={{ flex: 1, background: paymentMethod === m ? '#C8F04B22' : 'transparent', border: `1px solid ${paymentMethod === m ? ACCENT : BORDER}`, borderRadius: 8, padding: '10px 4px', color: paymentMethod === m ? ACCENT : '#666', fontSize: 9, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {m}
              </button>
            ))}
          </div>
        </div>

        <button onClick={createManualTicket} disabled={loading}
          style={{ background: ACCENT, color: '#000', border: 'none', borderRadius: 12, padding: 15, width: '100%', fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '1px', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'SAVING...' : finalTip > 0 ? `SAVE TICKET + $${finalTip} TIP` : 'SAVE TICKET (NO TIP)'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: '#0D0D0D', minHeight: '100vh', color: '#fff', fontFamily: "'DM Mono', monospace", padding: 20, paddingTop: 'calc(20px + env(safe-area-inset-top))' }}>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13, marginBottom: 16, padding: 0 }}>&larr; Back</button>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Manual Ticket Entry</div>
      <div style={{ fontSize: 10, color: '#666', marginBottom: 20 }}>LOGGED BY: {valetName.toUpperCase()}</div>

      {/* Paper Ticket Number */}
      <div style={{ background: CARD, border: `1px solid ${ACCENT}44`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: ACCENT, letterSpacing: '2px', marginBottom: 12 }}>PAPER TICKET #</div>
        <input
          style={{ ...inputStyle, fontSize: 22, fontWeight: 900, fontFamily: 'monospace', letterSpacing: 4, textAlign: 'center', color: ACCENT }}
          placeholder="0000"
          value={form.paperTicketNum}
          onChange={e => setForm({ ...form, paperTicketNum: e.target.value })}
        />
        <div style={{ fontSize: 9, color: '#555', textAlign: 'center', marginTop: 4 }}>Enter the number from the physical ticket</div>
      </div>

      {/* Vehicle */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: '#888', letterSpacing: '2px', marginBottom: 12 }}>VEHICLE</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>MAKE</div>
            <input style={inputStyle} placeholder="Toyota" value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>MODEL</div>
            <input style={inputStyle} placeholder="Camry" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>COLOR</div>
            <input style={inputStyle} placeholder="Black" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>PLATE</div>
            <input style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: 2, textTransform: 'uppercase' }} placeholder="ABC1234" value={form.plate} onChange={e => setForm({ ...form, plate: e.target.value.toUpperCase() })} />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={labelStyle}>SPOT</div>
          <input style={inputStyle} placeholder="B-14" value={form.spot} onChange={e => setForm({ ...form, spot: e.target.value })} />
        </div>
      </div>

      {/* Customer */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: '#888', letterSpacing: '2px', marginBottom: 12 }}>CUSTOMER (OPTIONAL)</div>
        <div style={labelStyle}>NAME</div>
        <input style={inputStyle} placeholder="Guest name..." value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} />
        <div style={labelStyle}>PHONE</div>
        <input style={{ ...inputStyle, marginBottom: 0 }} placeholder="Phone number..." type="tel" value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} />
      </div>

      {/* Notes */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 9, color: '#888', letterSpacing: '2px', marginBottom: 12 }}>NOTES</div>
        <div style={labelStyle}>DAMAGE</div>
        <input style={inputStyle} placeholder="Pre-existing damage..." value={form.damage} onChange={e => setForm({ ...form, damage: e.target.value })} />
        <div style={labelStyle}>SPECIAL NOTES</div>
        <input style={{ ...inputStyle, marginBottom: 0 }} placeholder="VIP, rush, instructions..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
      </div>

      <button onClick={() => setStep('tip')} style={{ background: ACCENT, color: '#000', border: 'none', borderRadius: 12, padding: 15, width: '100%', fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '1px' }}>
        NEXT - ADD TIP
      </button>
    </div>
  );
}

const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', background: '#0D0D0D', border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff', fontSize: 13, fontFamily: "'DM Mono', monospace", outline: 'none', marginBottom: 0 };
const labelStyle = { fontSize: 9, color: '#666', letterSpacing: '2px', marginBottom: 6, marginTop: 10 };
