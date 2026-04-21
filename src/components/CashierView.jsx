// ============================================================
// CashierView.jsx – Cashier role: tips, delivered tickets,
//                    receipts, manual ticket entry with
//                    “retrieved by” valet selector
// ============================================================
import { useState, useEffect, useRef } from ‘react’;
import { db } from ‘../config/firebase’;
import {
collection, query, where, onSnapshot,
updateDoc, addDoc, doc, getDocs, serverTimestamp
} from ‘firebase/firestore’;

export default function CashierView({ eventId, staffName, onLogout }) {
const [tickets, setTickets]         = useState([]);
const [selected, setSelected]       = useState(null);
const [tipConfirmed, setTipConfirmed] = useState({});
const [search, setSearch]           = useState(’’);
const [activeTab, setActiveTab]     = useState(‘requests’); // ‘requests’ | ‘delivered’ | ‘manual’
const [activeStaff, setActiveStaff] = useState([]);        // valets on this event
const receiptRef = useRef(null);

// ── Manual ticket form state ──────────────────────────────
const [mForm, setMForm] = useState({
ticketNum: ‘’, make: ‘’, model: ‘’, color: ‘’,
plate: ‘’, spot: ‘’, customerName: ‘’, customerPhone: ‘’,
damageNotes: ‘’, notes: ‘’, retrievedBy: ‘’
});
const [mSaving, setMSaving]   = useState(false);
const [mSuccess, setMSuccess] = useState(false);

const COLORS = [‘Black’,‘White’,‘Silver’,‘Gray’,‘Red’,‘Blue’,‘Navy’,‘Green’,‘Gold’,‘Brown’,‘Orange’,‘Yellow’];

// ── Live ticket listener ──────────────────────────────────
useEffect(() => {
if (!eventId) return;
const q = query(
collection(db, ‘tickets’),
where(‘eventId’, ‘==’, eventId),
where(‘status’, ‘in’, [‘retrieving’, ‘delivered’])
);
const unsub = onSnapshot(q, snap => {
const list = snap.docs.map(d => ({ id: d.id, …d.data() }));
list.sort((a, b) =>
(b.deliveredAt || b.time?.seconds || 0) -
(a.deliveredAt || a.time?.seconds || 0)
);
setTickets(list);
});
return unsub;
}, [eventId]);

// ── Load active staff for this event ─────────────────────
useEffect(() => {
if (!eventId) return;
// Pull from valetAccounts where active = true
// Optionally filter by eventId if your schema supports it
const fetchStaff = async () => {
try {
const snap = await getDocs(
query(collection(db, ‘valetAccounts’), where(‘active’, ‘==’, true))
);
const staff = snap.docs.map(d => ({ id: d.id, …d.data() }));
setActiveStaff(staff);
} catch (e) {
console.error(‘Could not load staff:’, e);
}
};
fetchStaff();
}, [eventId]);

// ── Helpers ───────────────────────────────────────────────
async function markDelivered(ticket, e) {
e.stopPropagation();
await updateDoc(doc(db, ‘tickets’, ticket.id), {
status: ‘delivered’,
deliveredAt: Date.now()
});
}

async function confirmTip(ticket) {
await updateDoc(doc(db, ‘tickets’, ticket.id), {
tipPaid: true,
tipPaidAt: Date.now()
});
setTipConfirmed(prev => ({ …prev, [ticket.id]: true }));
setSelected(null);
}

async function saveManualTicket() {
if (!mForm.plate)      { alert(‘License plate is required’); return; }
if (!mForm.ticketNum)  { alert(‘Paper ticket # is required’); return; }
setMSaving(true);
try {
await addDoc(collection(db, ‘tickets’), {
ticketNum:     mForm.ticketNum,
ticketNumber:  mForm.ticketNum, // keep both field names in sync
make:          mForm.make,
car:           mForm.make,      // legacy field
model:         mForm.model,
color:         mForm.color,
plate:         mForm.plate.toUpperCase(),
spot:          mForm.spot.toUpperCase(),
customerName:  mForm.customerName,
customerPhone: mForm.customerPhone,
damageNotes:   mForm.damageNotes,
notes:         mForm.notes,
retrievedBy:   mForm.retrievedBy,  // ← who retrieved the vehicle
status:        ‘parked’,
source:        ‘manual’,
eventId:       eventId || null,
createdBy:     staffName || ‘cashier’,
time:          serverTimestamp(),
updatedAt:     serverTimestamp(),
});
setMSuccess(true);
setMForm({
ticketNum: ‘’, make: ‘’, model: ‘’, color: ‘’,
plate: ‘’, spot: ‘’, customerName: ‘’, customerPhone: ‘’,
damageNotes: ‘’, notes: ‘’, retrievedBy: ‘’
});
setTimeout(() => setMSuccess(false), 3000);
} catch (e) {
console.error(e);
alert(‘Error saving ticket. Please try again.’);
}
setMSaving(false);
}

// ── Derived data ──────────────────────────────────────────
const requesting = tickets.filter(t => t.status === ‘retrieving’);
const delivered  = tickets.filter(t => t.status === ‘delivered’);

const filtered = (activeTab === ‘requests’ ? requesting : delivered).filter(t => {
const s = search.toLowerCase();
return !s ||
t.customerName?.toLowerCase().includes(s) ||
t.plate?.toLowerCase().includes(s) ||
String(t.ticketNumber || t.ticketNum || ‘’).includes(s);
});

const totalTips     = tickets.reduce((sum, t) => sum + (parseFloat(t.tipAmount) || 0), 0);
const confirmedTips = tickets
.filter(t => tipConfirmed[t.id] || t.tipPaid)
.reduce((sum, t) => sum + (parseFloat(t.tipAmount) || 0), 0);

// ── Render ────────────────────────────────────────────────
return (
<div style={s.wrap}>

```
  {/* ── Header ── */}
  <div style={s.header}>
    <div>
      <div style={s.role}>🧾 Cashier</div>
      <div style={s.headerSub}>{staffName || 'Cashier Dashboard'}</div>
    </div>
    <button style={s.logout} onClick={onLogout}>Logout</button>
  </div>

  {/* ── Summary bar ── */}
  <div style={s.summaryBar}>
    <div style={s.statBox}>
      <div style={s.statNum}>{requesting.length}</div>
      <div style={s.statLabel}>Requesting</div>
    </div>
    <div style={s.statBox}>
      <div style={s.statNum}>{delivered.length}</div>
      <div style={s.statLabel}>Delivered</div>
    </div>
    <div style={s.statBox}>
      <div style={{ ...s.statNum, color: '#27ae60' }}>${confirmedTips.toFixed(2)}</div>
      <div style={s.statLabel}>Confirmed</div>
    </div>
    <div style={s.statBox}>
      <div style={{ ...s.statNum, color: '#e67e22' }}>${(totalTips - confirmedTips).toFixed(2)}</div>
      <div style={s.statLabel}>Pending</div>
    </div>
  </div>

  {/* ── Tab nav ── */}
  <div style={s.tabNav}>
    {[
      { key: 'requests',  label: `🔔 Requests${requesting.length ? ` (${requesting.length})` : ''}` },
      { key: 'delivered', label: '✅ Delivered' },
      { key: 'manual',    label: '📋 Manual Entry' },
    ].map(t => (
      <button
        key={t.key}
        style={{ ...s.tabBtn, ...(activeTab === t.key ? s.tabBtnActive : {}) }}
        onClick={() => setActiveTab(t.key)}
      >
        {t.label}
      </button>
    ))}
  </div>

  {/* ── Search (requests + delivered tabs) ── */}
  {activeTab !== 'manual' && (
    <div style={s.searchWrap}>
      <input
        style={s.search}
        placeholder="Search name, plate, ticket #"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
    </div>
  )}

  {/* ── Requests / Delivered list ── */}
  {activeTab !== 'manual' && (
    <div style={s.list}>
      {filtered.map(ticket => {
        const paid = tipConfirmed[ticket.id] || ticket.tipPaid;
        const tip  = parseFloat(ticket.tipAmount) || 0;
        const num  = ticket.ticketNumber || ticket.ticketNum || ticket.id.slice(-4);
        return (
          <div
            key={ticket.id}
            style={{
              ...s.ticketRow,
              ...(ticket.status === 'retrieving' ? s.ticketRetrieving : {}),
              ...(paid ? s.ticketPaid : {})
            }}
            onClick={() => setSelected(ticket)}
          >
            <div style={s.ticketLeft}>
              <div style={s.ticketNum}>#{num}</div>
              <div style={s.ticketName}>{ticket.customerName || 'Guest'}</div>
              <div style={s.ticketCar}>
                {[ticket.color, ticket.make || ticket.car, ticket.model].filter(Boolean).join(' ')}
                {ticket.plate ? ` · ${ticket.plate}` : ''}
              </div>
              {ticket.spot ? <div style={s.ticketSpot}>Spot {ticket.spot}</div> : null}
            </div>
            <div style={s.ticketRight}>
              {ticket.status === 'retrieving' ? (
                <button
                  style={s.btnDeliver}
                  onClick={e => markDelivered(ticket, e)}
                >
                  Mark Delivered
                </button>
              ) : tip > 0 ? (
                <div style={{ ...s.tipBadge, ...(paid ? s.tipBadgePaid : {}) }}>
                  ${tip.toFixed(2)} tip{paid ? ' ✓' : ''}
                </div>
              ) : (
                <div style={s.noTip}>No tip</div>
              )}
              {ticket.valetName
                ? <div style={s.valetName}>{ticket.valetName}</div>
                : null}
              {ticket.retrievedBy
                ? <div style={s.valetName}>Retrieved by: {ticket.retrievedBy}</div>
                : null}
            </div>
          </div>
        );
      })}
      {filtered.length === 0 && (
        <div style={s.empty}>
          {activeTab === 'requests' ? 'No pending requests' : 'No delivered tickets yet'}
        </div>
      )}
    </div>
  )}

  {/* ── Manual Ticket Entry ── */}
  {activeTab === 'manual' && (
    <div style={s.manualWrap}>

      {mSuccess && (
        <div style={s.successBanner}>✅ Ticket saved & marked parked!</div>
      )}

      {/* Paper ticket # */}
      <div style={s.paperBox}>
        <div style={s.paperLabel}>PAPER TICKET #</div>
        <input
          style={s.paperInput}
          placeholder="0000"
          maxLength={8}
          value={mForm.ticketNum}
          onChange={e => setMForm(f => ({ ...f, ticketNum: e.target.value.toUpperCase() }))}
        />
        <div style={s.paperHint}>Enter number from physical ticket</div>
      </div>

      {/* Vehicle */}
      <div style={s.formCard}>
        <div style={s.formCardTitle}>VEHICLE</div>
        <div style={s.fieldRow}>
          <div style={s.fieldHalf}>
            <div style={s.fieldLabel}>MAKE</div>
            <input style={s.fieldInput} placeholder="Toyota"
              value={mForm.make}
              onChange={e => setMForm(f => ({ ...f, make: e.target.value }))} />
          </div>
          <div style={s.fieldHalf}>
            <div style={s.fieldLabel}>MODEL</div>
            <input style={s.fieldInput} placeholder="Camry"
              value={mForm.model}
              onChange={e => setMForm(f => ({ ...f, model: e.target.value }))} />
          </div>
        </div>
        <div style={s.fieldLabel}>COLOR</div>
        <div style={s.colorChips}>
          {COLORS.map(c => (
            <span
              key={c}
              style={{ ...s.chip, ...(mForm.color === c ? s.chipSel : {}) }}
              onClick={() => setMForm(f => ({ ...f, color: c }))}
            >{c}</span>
          ))}
        </div>
        <div style={s.fieldRow}>
          <div style={s.fieldHalf}>
            <div style={s.fieldLabel}>PLATE</div>
            <input style={s.fieldInput} placeholder="ABC1234"
              value={mForm.plate}
              onChange={e => setMForm(f => ({ ...f, plate: e.target.value.toUpperCase() }))} />
          </div>
          <div style={s.fieldHalf}>
            <div style={s.fieldLabel}>SPOT</div>
            <input style={s.fieldInput} placeholder="B-14"
              value={mForm.spot}
              onChange={e => setMForm(f => ({ ...f, spot: e.target.value.toUpperCase() }))} />
          </div>
        </div>
      </div>

      {/* Retrieved by ── NEW ── */}
      <div style={s.formCard}>
        <div style={s.formCardTitle}>RETRIEVED BY</div>
        <div style={s.fieldLabel}>VALET WHO RETRIEVED THE VEHICLE</div>
        {activeStaff.length > 0 ? (
          <div style={s.staffGrid}>
            {activeStaff.map(staff => (
              <div
                key={staff.id}
                style={{
                  ...s.staffCard,
                  ...(mForm.retrievedBy === staff.name ? s.staffCardSel : {})
                }}
                onClick={() => setMForm(f => ({
                  ...f,
                  retrievedBy: f.retrievedBy === staff.name ? '' : staff.name
                }))}
              >
                <div style={s.staffAvatar}>
                  {(staff.name || '?').charAt(0).toUpperCase()}
                </div>
                <div style={s.staffName}>{staff.name}</div>
                <div style={s.staffRole}>{staff.role}</div>
              </div>
            ))}
          </div>
        ) : (
          // Fallback: free text if no staff loaded
          <input
            style={s.fieldInput}
            placeholder="Valet name..."
            value={mForm.retrievedBy}
            onChange={e => setMForm(f => ({ ...f, retrievedBy: e.target.value }))}
          />
        )}
      </div>

      {/* Customer */}
      <div style={s.formCard}>
        <div style={s.formCardTitle}>CUSTOMER (OPTIONAL)</div>
        <div style={s.fieldLabel}>NAME</div>
        <input style={{ ...s.fieldInput, marginBottom: 10 }} placeholder="Guest name..."
          value={mForm.customerName}
          onChange={e => setMForm(f => ({ ...f, customerName: e.target.value }))} />
        <div style={s.fieldLabel}>PHONE</div>
        <input style={s.fieldInput} type="tel" placeholder="Phone number..."
          value={mForm.customerPhone}
          onChange={e => setMForm(f => ({ ...f, customerPhone: e.target.value }))} />
      </div>

      {/* Notes */}
      <div style={s.formCard}>
        <div style={s.formCardTitle}>NOTES</div>
        <div style={s.fieldLabel}>DAMAGE</div>
        <textarea style={{ ...s.fieldInput, ...s.textarea }} placeholder="Pre-existing damage..."
          value={mForm.damageNotes}
          onChange={e => setMForm(f => ({ ...f, damageNotes: e.target.value }))} />
        <div style={{ ...s.fieldLabel, marginTop: 10 }}>SPECIAL NOTES</div>
        <textarea style={{ ...s.fieldInput, ...s.textarea }} placeholder="VIP, rush, instructions..."
          value={mForm.notes}
          onChange={e => setMForm(f => ({ ...f, notes: e.target.value }))} />
      </div>

      <button
        style={{ ...s.btnPrimary, ...(mSaving ? s.btnDisabled : {}) }}
        onClick={saveManualTicket}
        disabled={mSaving}
      >
        {mSaving ? 'SAVING...' : 'SAVE & MARK PARKED'}
      </button>
      <button style={s.btnSecondary} onClick={() => setMForm({
        ticketNum: '', make: '', model: '', color: '',
        plate: '', spot: '', customerName: '', customerPhone: '',
        damageNotes: '', notes: '', retrievedBy: ''
      })}>
        CLEAR FORM
      </button>

      <div style={{ height: 40 }} />
    </div>
  )}

  {/* ── Receipt modal ── */}
  {selected && (
    <div style={s.overlay} onClick={() => setSelected(null)}>
      <div style={s.modal} onClick={e => e.stopPropagation()} ref={receiptRef}>
        <div style={s.receipt}>
          <div style={s.receiptHeader}>
            <div style={s.receiptLogo}>VLTD</div>
            <div style={s.receiptTitle}>RECEIPT</div>
            <div style={s.receiptNum}>
              Ticket #{selected.ticketNumber || selected.ticketNum}
            </div>
          </div>
          <div style={s.receiptDivider} />
          {[
            ['Customer',    selected.customerName || '--'],
            ['Vehicle',     [selected.color, selected.make || selected.car, selected.model].filter(Boolean).join(' ') || '--'],
            ['Plate',       selected.plate || '--'],
            ['Spot',        selected.spot  || '--'],
            ['Valet',       selected.valetName || '--'],
            ['Retrieved by',selected.retrievedBy || '--'],
          ].map(([label, val]) => (
            <div key={label} style={s.receiptRow}>
              <span>{label}</span>
              <span style={label === 'Plate' ? { fontFamily: 'monospace', fontWeight: 700 } : {}}>
                {val}
              </span>
            </div>
          ))}
          {selected.parkingFee > 0 && (
            <div style={s.receiptRow}>
              <span>Parking Fee</span>
              <span>${parseFloat(selected.parkingFee).toFixed(2)}</span>
            </div>
          )}
          <div style={s.receiptDivider} />
          <div style={{ ...s.receiptRow, fontWeight: 700, fontSize: 17 }}>
            <span>Tip</span>
            <span>${(parseFloat(selected.tipAmount) || 0).toFixed(2)}</span>
          </div>
          {selected.rating && (
            <div style={s.receiptRow}>
              <span>Rating</span>
              <span>{'⭐'.repeat(selected.rating)}</span>
            </div>
          )}
          <div style={s.receiptDivider} />
          <div style={s.receiptTime}>
            {selected.deliveredAt
              ? new Date(selected.deliveredAt).toLocaleString()
              : ''}
          </div>
        </div>

        <div style={s.modalActions}>
          {!tipConfirmed[selected.id] && !selected.tipPaid &&
           parseFloat(selected.tipAmount) > 0 && (
            <button style={s.btnConfirm} onClick={() => confirmTip(selected)}>
              ✅ Confirm Tip Paid — ${parseFloat(selected.tipAmount).toFixed(2)}
            </button>
          )}
          {(tipConfirmed[selected.id] || selected.tipPaid) && (
            <div style={s.paidBadge}>✅ Tip Confirmed Paid</div>
          )}
          <button style={s.btnClose} onClick={() => setSelected(null)}>Close</button>
        </div>
      </div>
    </div>
  )}
</div>
```

);
}

// ── Styles ────────────────────────────────────────────────────────────
const s = {
wrap:        { minHeight: ‘100vh’, background: ‘#f5f5f5’, fontFamily: ‘system-ui, sans-serif’, paddingBottom: 40 },
header:      { background: ‘#1a1a1a’, color: ‘#fff’, padding: ‘16px 20px’, display: ‘flex’, justifyContent: ‘space-between’, alignItems: ‘center’ },
role:        { fontSize: 18, fontWeight: 700 },
headerSub:   { fontSize: 12, color: ‘#888’, marginTop: 2 },
logout:      { background: ‘transparent’, border: ‘1px solid #444’, color: ‘#fff’, padding: ‘6px 14px’, borderRadius: 8, cursor: ‘pointer’, fontSize: 13 },
summaryBar:  { display: ‘grid’, gridTemplateColumns: ‘1fr 1fr 1fr 1fr’, gap: 1, background: ‘#ddd’ },
statBox:     { background: ‘#fff’, padding: ‘12px 8px’, textAlign: ‘center’ },
statNum:     { fontSize: 18, fontWeight: 800 },
statLabel:   { fontSize: 11, color: ‘#888’, marginTop: 2 },
tabNav:      { display: ‘flex’, gap: 0, borderBottom: ‘1px solid #ddd’, background: ‘#fff’, overflowX: ‘auto’ },
tabBtn:      { flex: 1, padding: ‘12px 8px’, border: ‘none’, borderBottom: ‘2px solid transparent’, background: ‘transparent’, fontSize: 11, fontFamily: ‘system-ui’, letterSpacing: ‘0.5px’, color: ‘#999’, cursor: ‘pointer’, whiteSpace: ‘nowrap’ },
tabBtnActive:{ color: ‘#1a1a1a’, borderBottomColor: ‘#C8F04B’, fontWeight: 700 },
searchWrap:  { padding: ‘12px 16px’, background: ‘#fff’, borderBottom: ‘1px solid #eee’ },
search:      { width: ‘100%’, boxSizing: ‘border-box’, padding: ‘10px 14px’, border: ‘1px solid #ddd’, borderRadius: 10, fontSize: 15, background: ‘#f9f9f9’, outline: ‘none’ },
list:        { padding: ‘12px 16px 32px’ },
ticketRow:   { background: ‘#fff’, borderRadius: 12, padding: 14, marginBottom: 8, display: ‘flex’, justifyContent: ‘space-between’, alignItems: ‘flex-start’, cursor: ‘pointer’, border: ‘1px solid #eee’, boxShadow: ‘0 1px 4px rgba(0,0,0,0.04)’ },
ticketRetrieving: { border: ‘1px solid #ffcc0066’, background: ‘#fffdf0’ },
ticketPaid:  { opacity: 0.6 },
ticketLeft:  {},
ticketNum:   { fontSize: 11, color: ‘#aaa’, fontFamily: ‘monospace’, marginBottom: 2 },
ticketName:  { fontWeight: 700, fontSize: 15, marginBottom: 2 },
ticketCar:   { fontSize: 12, color: ‘#888’ },
ticketSpot:  { fontSize: 11, color: ‘#C8A000’, marginTop: 3, fontWeight: 600 },
ticketRight: { textAlign: ‘right’, flexShrink: 0, marginLeft: 10 },
tipBadge:    { background: ‘#fff3cd’, color: ‘#856404’, padding: ‘4px 10px’, borderRadius: 20, fontSize: 12, fontWeight: 700 },
tipBadgePaid:{ background: ‘#d4edda’, color: ‘#155724’ },
noTip:       { color: ‘#bbb’, fontSize: 12 },
valetName:   { fontSize: 11, color: ‘#aaa’, marginTop: 4 },
btnDeliver:  { background: ‘#1a1a1a’, color: ‘#fff’, border: ‘none’, borderRadius: 8, padding: ‘8px 12px’, fontSize: 12, fontWeight: 700, cursor: ‘pointer’ },
empty:       { textAlign: ‘center’, color: ‘#bbb’, padding: 40, fontSize: 14 },

// Manual form
manualWrap:  { padding: ‘16px 16px 0’ },
successBanner:{ background: ‘#d4edda’, color: ‘#155724’, borderRadius: 10, padding: ‘12px 16px’, marginBottom: 14, fontWeight: 700, fontSize: 14, textAlign: ‘center’ },
paperBox:    { background: ‘#C8F04B15’, border: ‘1px solid #C8F04B66’, borderRadius: 12, padding: 16, marginBottom: 14, textAlign: ‘center’ },
paperLabel:  { fontSize: 10, color: ‘#7a9400’, letterSpacing: 2, marginBottom: 8, fontWeight: 700 },
paperInput:  { background: ‘transparent’, border: ‘none’, outline: ‘none’, fontFamily: ‘monospace’, fontSize: 28, fontWeight: 900, color: ‘#5a7000’, textAlign: ‘center’, letterSpacing: 6, width: ‘100%’ },
paperHint:   { fontSize: 10, color: ‘#aaa’, marginTop: 4, letterSpacing: 1 },
formCard:    { background: ‘#fff’, border: ‘1px solid #eee’, borderRadius: 14, padding: 16, marginBottom: 12 },
formCardTitle:{ fontSize: 10, color: ‘#aaa’, letterSpacing: 2, marginBottom: 12, paddingBottom: 8, borderBottom: ‘1px solid #f0f0f0’, fontWeight: 700 },
fieldRow:    { display: ‘flex’, gap: 10, marginBottom: 10 },
fieldHalf:   { flex: 1, minWidth: 0 },
fieldLabel:  { fontSize: 10, color: ‘#aaa’, letterSpacing: 1, marginBottom: 4, fontWeight: 600 },
fieldInput:  { width: ‘100%’, background: ‘#f9f9f9’, border: ‘1px solid #eee’, borderRadius: 8, padding: ‘10px 11px’, fontSize: 14, outline: ‘none’, boxSizing: ‘border-box’, fontFamily: ‘system-ui’ },
textarea:    { resize: ‘none’, height: 64, lineHeight: 1.5 },
colorChips:  { display: ‘flex’, flexWrap: ‘wrap’, gap: 6, marginBottom: 12 },
chip:        { padding: ‘5px 11px’, borderRadius: 99, fontSize: 12, cursor: ‘pointer’, border: ‘1.5px solid #eee’, background: ‘#f5f5f5’, color: ‘#888’, transition: ‘all .12s’ },
chipSel:     { border: ‘1.5px solid #C8F04B’, color: ‘#5a7000’, background: ‘#C8F04B22’, fontWeight: 700 },

// Retrieved by staff grid
staffGrid:   { display: ‘grid’, gridTemplateColumns: ‘repeat(3, 1fr)’, gap: 8, marginTop: 6 },
staffCard:   { background: ‘#f9f9f9’, border: ‘1.5px solid #eee’, borderRadius: 10, padding: ‘10px 6px’, textAlign: ‘center’, cursor: ‘pointer’, transition: ‘all .12s’ },
staffCardSel:{ background: ‘#C8F04B22’, border: ‘1.5px solid #C8F04B’, },
staffAvatar: { width: 36, height: 36, borderRadius: ‘50%’, background: ‘#1a1a1a’, color: ‘#C8F04B’, fontFamily: ‘monospace’, fontWeight: 900, fontSize: 16, display: ‘flex’, alignItems: ‘center’, justifyContent: ‘center’, margin: ‘0 auto 6px’ },
staffName:   { fontSize: 11, fontWeight: 700, color: ‘#1a1a1a’, lineHeight: 1.3 },
staffRole:   { fontSize: 9, color: ‘#aaa’, marginTop: 2, textTransform: ‘uppercase’, letterSpacing: 0.5 },

btnPrimary:  { width: ‘100%’, background: ‘#C8F04B’, color: ‘#000’, border: ‘none’, borderRadius: 12, padding: 15, fontSize: 13, fontWeight: 800, cursor: ‘pointer’, letterSpacing: 1, marginBottom: 8, fontFamily: ‘system-ui’ },
btnDisabled: { opacity: 0.5, cursor: ‘default’ },
btnSecondary:{ width: ‘100%’, background: ‘transparent’, border: ‘1px solid #ddd’, borderRadius: 12, padding: 14, fontSize: 13, color: ‘#aaa’, cursor: ‘pointer’, fontFamily: ‘system-ui’ },

// Modal
overlay:     { position: ‘fixed’, inset: 0, background: ‘rgba(0,0,0,0.6)’, zIndex: 200, display: ‘flex’, alignItems: ‘flex-end’, justifyContent: ‘center’ },
modal:       { background: ‘#fff’, width: ‘100%’, maxWidth: 440, borderRadius: ‘20px 20px 0 0’, overflow: ‘hidden’, maxHeight: ‘90vh’, overflowY: ‘auto’ },
receipt:     { padding: 24, fontFamily: ‘monospace’ },
receiptHeader:{ textAlign: ‘center’, marginBottom: 12 },
receiptLogo: { fontSize: 28, fontWeight: 900, letterSpacing: 4 },
receiptTitle:{ fontSize: 12, letterSpacing: 3, color: ‘#888’ },
receiptNum:  { fontSize: 13, marginTop: 4 },
receiptDivider:{ borderTop: ‘1px dashed #ddd’, margin: ‘12px 0’ },
receiptRow:  { display: ‘flex’, justifyContent: ‘space-between’, fontSize: 14, marginBottom: 6 },
receiptTime: { textAlign: ‘center’, fontSize: 11, color: ‘#aaa’, marginTop: 8 },
modalActions:{ padding: ‘0 20px 32px’, display: ‘flex’, flexDirection: ‘column’, gap: 10 },
btnConfirm:  { width: ‘100%’, padding: 14, background: ‘#27ae60’, color: ‘#fff’, border: ‘none’, borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: ‘pointer’ },
btnClose:    { width: ‘100%’, padding: 14, background: ‘#f0f0f0’, border: ‘none’, borderRadius: 12, fontSize: 15, cursor: ‘pointer’ },
paidBadge:   { textAlign: ‘center’, color: ‘#27ae60’, fontWeight: 700, fontSize: 15, padding: 14, background: ‘#d4edda’, borderRadius: 12 },
};