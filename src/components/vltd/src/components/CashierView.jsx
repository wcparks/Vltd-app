// ============================================================
// CashierView.jsx — Cashier role: tips, delivered tickets, receipts
// Place at: src/components/CashierView.jsx
//
// HOW TO ADD THE CASHIER PIN to App.js:
//   const CASHIER_PIN = '5678'; // or whatever you choose
//
//   In your login handler:
//   if (pin === MANAGER_PIN) setRole('manager');
//   else if (pin === VALET_PIN) setRole('valet');
//   else if (pin === CASHIER_PIN) setRole('cashier');
//
//   Then in your render:
//   if (role === 'cashier') return <CashierView eventId={currentEvent?.id} />;
// ============================================================
import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';

export default function CashierView({ eventId, onLogout }) {
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tipConfirmed, setTipConfirmed] = useState({});
  const [search, setSearch] = useState('');
  const receiptRef = useRef(null);

  useEffect(() => {
    if (!eventId) return;
    const q = query(
      collection(db, 'tickets'),
      where('eventId', '==', eventId),
      where('status', '==', 'delivered')
    );
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.deliveredAt || 0) - (a.deliveredAt || 0));
      setTickets(list);
    });
    return unsub;
  }, [eventId]);

  const filtered = tickets.filter(t => {
    const s = search.toLowerCase();
    return !s || t.customerName?.toLowerCase().includes(s) ||
      t.plate?.toLowerCase().includes(s) ||
      t.ticketNumber?.includes(s);
  });

  const totalTips = tickets.reduce((sum, t) => sum + (parseFloat(t.tipAmount) || 0), 0);
  const confirmedTips = tickets
    .filter(t => tipConfirmed[t.id] || t.tipPaid)
    .reduce((sum, t) => sum + (parseFloat(t.tipAmount) || 0), 0);

  async function confirmTip(ticket) {
    await updateDoc(doc(db, 'tickets', ticket.id), { tipPaid: true, tipPaidAt: Date.now() });
    setTipConfirmed(prev => ({ ...prev, [ticket.id]: true }));
    setSelected(null);
  }

  return (
    <div style={styles.wrap}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.role}>💳 Cashier</div>
          <div style={styles.headerSub}>Delivered tickets only</div>
        </div>
        <button style={styles.logout} onClick={onLogout}>Logout</button>
      </div>

      {/* Summary bar */}
      <div style={styles.summaryBar}>
        <div style={styles.statBox}>
          <div style={styles.statNum}>{tickets.length}</div>
          <div style={styles.statLabel}>Delivered</div>
        </div>
        <div style={styles.statBox}>
          <div style={styles.statNum}>${totalTips.toFixed(2)}</div>
          <div style={styles.statLabel}>Total Tips</div>
        </div>
        <div style={styles.statBox}>
          <div style={{ ...styles.statNum, color: '#27ae60' }}>${confirmedTips.toFixed(2)}</div>
          <div style={styles.statLabel}>Confirmed</div>
        </div>
        <div style={styles.statBox}>
          <div style={{ ...styles.statNum, color: '#e67e22' }}>${(totalTips - confirmedTips).toFixed(2)}</div>
          <div style={styles.statLabel}>Pending</div>
        </div>
      </div>

      {/* Search */}
      <div style={styles.searchWrap}>
        <input
          style={styles.search}
          placeholder="🔍 Search name, plate, ticket #"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Ticket list */}
      <div style={styles.list}>
        {filtered.map(ticket => {
          const paid = tipConfirmed[ticket.id] || ticket.tipPaid;
          const tip = parseFloat(ticket.tipAmount) || 0;
          return (
            <div
              key={ticket.id}
              style={{ ...styles.ticketRow, ...(paid ? styles.ticketPaid : {}) }}
              onClick={() => setSelected(ticket)}
            >
              <div style={styles.ticketLeft}>
                <div style={styles.ticketNum}>#{ticket.ticketNumber}</div>
                <div style={styles.ticketName}>{ticket.customerName || 'Guest'}</div>
                <div style={styles.ticketCar}>{ticket.color} {ticket.make} {ticket.model} · {ticket.plate}</div>
              </div>
              <div style={styles.ticketRight}>
                {tip > 0 ? (
                  <div style={{ ...styles.tipBadge, ...(paid ? styles.tipBadgePaid : {}) }}>
                    ${tip.toFixed(2)} tip
                    {paid ? ' ✓' : ''}
                  </div>
                ) : (
                  <div style={styles.noTip}>No tip</div>
                )}
                <div style={styles.valetName}>{ticket.valetName}</div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={styles.empty}>No delivered tickets yet</div>
        )}
      </div>

      {/* Ticket detail / receipt modal */}
      {selected && (
        <div style={styles.overlay} onClick={() => setSelected(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()} ref={receiptRef}>
            <div style={styles.receipt}>
              <div style={styles.receiptHeader}>
                <div style={styles.receiptLogo}>VLTD</div>
                <div style={styles.receiptTitle}>RECEIPT</div>
                <div style={styles.receiptNum}>Ticket #{selected.ticketNumber}</div>
              </div>
              <div style={styles.receiptDivider} />
              <div style={styles.receiptRow}>
                <span>Customer</span>
                <span>{selected.customerName || '—'}</span>
              </div>
              <div style={styles.receiptRow}>
                <span>Vehicle</span>
                <span>{selected.color} {selected.make} {selected.model}</span>
              </div>
              <div style={styles.receiptRow}>
                <span>Plate</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{selected.plate}</span>
              </div>
              <div style={styles.receiptRow}>
                <span>Valet</span>
                <span>{selected.valetName}</span>
              </div>
              {selected.parkingFee > 0 && (
                <div style={styles.receiptRow}>
                  <span>Parking Fee</span>
                  <span>${parseFloat(selected.parkingFee).toFixed(2)}</span>
                </div>
              )}
              <div style={styles.receiptDivider} />
              <div style={{ ...styles.receiptRow, fontWeight: 700, fontSize: 17 }}>
                <span>Tip</span>
                <span>${(parseFloat(selected.tipAmount) || 0).toFixed(2)}</span>
              </div>
              {selected.rating && (
                <div style={styles.receiptRow}>
                  <span>Rating</span>
                  <span>{'⭐'.repeat(selected.rating)}</span>
                </div>
              )}
              <div style={styles.receiptDivider} />
              <div style={styles.receiptTime}>
                {selected.deliveredAt ? new Date(selected.deliveredAt).toLocaleString() : ''}
              </div>
            </div>

            <div style={styles.modalActions}>
              {!tipConfirmed[selected.id] && !selected.tipPaid && parseFloat(selected.tipAmount) > 0 && (
                <button style={styles.btnConfirm} onClick={() => confirmTip(selected)}>
                  ✅ Confirm Tip Paid — ${parseFloat(selected.tipAmount).toFixed(2)}
                </button>
              )}
              {(tipConfirmed[selected.id] || selected.tipPaid) && (
                <div style={styles.paidBadge}>✅ Tip Confirmed Paid</div>
              )}
              <button style={styles.btnClose} onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { minHeight: '100vh', background: '#f5f5f5', fontFamily: 'system-ui, sans-serif' },
  header: { background: '#1a1a1a', color: '#fff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  role: { fontSize: 18, fontWeight: 700 },
  headerSub: { fontSize: 12, color: '#888', marginTop: 2 },
  logout: { background: 'transparent', border: '1px solid #444', color: '#fff', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  summaryBar: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1, background: '#ddd' },
  statBox: { background: '#fff', padding: '12px 8px', textAlign: 'center' },
  statNum: { fontSize: 18, fontWeight: 800 },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  searchWrap: { padding: '12px 16px' },
  search: { width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 10, fontSize: 15, background: '#fff' },
  list: { padding: '0 16px 32px' },
  ticketRow: { background: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: '1px solid #eee' },
  ticketPaid: { opacity: 0.6 },
  ticketLeft: {},
  ticketNum: { fontSize: 12, color: '#aaa', fontFamily: 'monospace' },
  ticketName: { fontWeight: 700, fontSize: 15 },
  ticketCar: { fontSize: 12, color: '#888', marginTop: 2 },
  ticketRight: { textAlign: 'right' },
  tipBadge: { background: '#fff3cd', color: '#856404', padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 },
  tipBadgePaid: { background: '#d4edda', color: '#155724' },
  noTip: { color: '#bbb', fontSize: 13 },
  valetName: { fontSize: 12, color: '#aaa', marginTop: 4 },
  empty: { textAlign: 'center', color: '#bbb', padding: 40 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal: { background: '#fff', width: '100%', maxWidth: 440, borderRadius: '20px 20px 0 0', overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto' },
  receipt: { padding: 24, fontFamily: 'monospace' },
  receiptHeader: { textAlign: 'center', marginBottom: 12 },
  receiptLogo: { fontSize: 28, fontWeight: 900, letterSpacing: 4 },
  receiptTitle: { fontSize: 12, letterSpacing: 3, color: '#888' },
  receiptNum: { fontSize: 13, marginTop: 4 },
  receiptDivider: { borderTop: '1px dashed #ddd', margin: '12px 0' },
  receiptRow: { display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 },
  receiptTime: { textAlign: 'center', fontSize: 11, color: '#aaa', marginTop: 8 },
  modalActions: { padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 10 },
  btnConfirm: { width: '100%', padding: 14, background: '#27ae60', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  btnClose: { width: '100%', padding: 14, background: '#f0f0f0', border: 'none', borderRadius: 12, fontSize: 15, cursor: 'pointer' },
  paidBadge: { textAlign: 'center', color: '#27ae60', fontWeight: 700, fontSize: 15, padding: 14, background: '#d4edda', borderRadius: 12 },
};
