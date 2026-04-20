// ============================================================
// EmployeeProfiles.jsx — Valet profiles + performance tracking
// Place at: src/components/EmployeeProfiles.jsx
//
// SETUP: When a valet logs in, upsert their profile:
//   import { upsertEmployee } from './employeeUtils';
//   await upsertEmployee(valetName); // call on login
//
// When a ticket is created/delivered, update their stats:
//   await incrementStat(valetName, 'parked'); // on car parked
//   await incrementStat(valetName, 'retrieved'); // on car retrieved
//   await updateRating(valetName, rating, tipAmount); // on review
//
// This component is the manager-only view.
// ============================================================
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, increment, getDoc, query, where, orderBy } from 'firebase/firestore';

// ── Utility functions (add to src/employeeUtils.js) ────────
export async function upsertEmployee(name) {
  if (!name) return;
  const ref = doc(db, 'employees', name.toLowerCase().replace(/\s+/g, '_'));
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      name,
      totalParked: 0,
      totalRetrieved: 0,
      totalTips: 0,
      totalRatings: 0,
      ratingSum: 0,
      avgRating: 0,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      reviews: [],
    });
  } else {
    await updateDoc(ref, { lastSeen: Date.now() });
  }
}

export async function incrementStat(name, stat) {
  if (!name) return;
  const ref = doc(db, 'employees', name.toLowerCase().replace(/\s+/g, '_'));
  const field = stat === 'parked' ? 'totalParked' : 'totalRetrieved';
  try {
    await updateDoc(ref, { [field]: increment(1), lastSeen: Date.now() });
  } catch {
    await upsertEmployee(name);
    await updateDoc(ref, { [field]: increment(1) });
  }
}

export async function updateRating(name, rating, tipAmount = 0, comment = '') {
  if (!name || !rating) return;
  const ref = doc(db, 'employees', name.toLowerCase().replace(/\s+/g, '_'));
  const snap = await getDoc(ref);
  if (!snap.exists()) await upsertEmployee(name);
  const data = snap.data() || {};
  const newSum = (data.ratingSum || 0) + rating;
  const newCount = (data.totalRatings || 0) + 1;
  const newTips = (data.totalTips || 0) + parseFloat(tipAmount || 0);
  const review = { rating, tipAmount: parseFloat(tipAmount || 0), comment, date: Date.now() };
  const reviews = [...(data.reviews || []).slice(-49), review]; // keep last 50
  await updateDoc(ref, {
    ratingSum: newSum,
    totalRatings: newCount,
    avgRating: parseFloat((newSum / newCount).toFixed(2)),
    totalTips: newTips,
    reviews,
  });
}

// ── Main component ─────────────────────────────────────────
export default function EmployeeProfiles() {
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'employees'), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.totalParked || 0) - (a.totalParked || 0));
      setEmployees(list);
    });
    return unsub;
  }, []);

  if (selected) {
    return <EmployeeDetail employee={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div style={styles.wrap}>
      <h2 style={styles.heading}>👥 Valet Team</h2>
      <div style={styles.list}>
        {employees.map(emp => (
          <div key={emp.id} style={styles.card} onClick={() => setSelected(emp)}>
            <div style={styles.avatar}>{emp.name?.[0]?.toUpperCase() || '?'}</div>
            <div style={styles.info}>
              <div style={styles.name}>{emp.name}</div>
              <div style={styles.meta}>
                {emp.totalParked || 0} parked · {emp.totalRetrieved || 0} retrieved
              </div>
              <div style={styles.meta}>
                {emp.totalRatings > 0
                  ? `⭐ ${emp.avgRating} avg (${emp.totalRatings} reviews) · $${(emp.totalTips || 0).toFixed(2)} tips`
                  : 'No reviews yet'}
              </div>
            </div>
            <div style={styles.arrow}>›</div>
          </div>
        ))}
        {employees.length === 0 && (
          <div style={styles.empty}>No employee profiles yet. They're created automatically on login.</div>
        )}
      </div>
    </div>
  );
}

function EmployeeDetail({ employee: emp, onBack }) {
  const [tab, setTab] = useState('stats');

  const recentReviews = (emp.reviews || []).slice().reverse().slice(0, 20);

  // Rating trend: group reviews into buckets of 5
  const ratingChunks = [];
  const reviews = emp.reviews || [];
  for (let i = 0; i < reviews.length; i += 5) {
    const chunk = reviews.slice(i, i + 5);
    const avg = chunk.reduce((s, r) => s + r.rating, 0) / chunk.length;
    ratingChunks.push(parseFloat(avg.toFixed(1)));
  }

  return (
    <div style={styles.wrap}>
      <button style={styles.back} onClick={onBack}>← Back</button>

      {/* Profile header */}
      <div style={styles.profileHeader}>
        <div style={styles.avatarLarge}>{emp.name?.[0]?.toUpperCase() || '?'}</div>
        <div style={styles.profileName}>{emp.name}</div>
        <div style={styles.profileMeta}>
          Last active: {emp.lastSeen ? new Date(emp.lastSeen).toLocaleDateString() : '—'}
        </div>
      </div>

      {/* Stats grid */}
      <div style={styles.statsGrid}>
        <Stat label="Cars Parked" value={emp.totalParked || 0} />
        <Stat label="Retrieved" value={emp.totalRetrieved || 0} />
        <Stat label="Avg Rating" value={emp.totalRatings > 0 ? `⭐ ${emp.avgRating}` : '—'} />
        <Stat label="Total Tips" value={`$${(emp.totalTips || 0).toFixed(2)}`} />
        <Stat label="Reviews" value={emp.totalRatings || 0} />
        <Stat label="Since" value={emp.firstSeen ? new Date(emp.firstSeen).toLocaleDateString() : '—'} />
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button style={tab === 'stats' ? styles.tabActive : styles.tab} onClick={() => setTab('stats')}>Trend</button>
        <button style={tab === 'reviews' ? styles.tabActive : styles.tab} onClick={() => setTab('reviews')}>Reviews</button>
      </div>

      {tab === 'stats' && (
        <div style={styles.trendWrap}>
          {ratingChunks.length > 1 ? (
            <>
              <div style={styles.trendLabel}>Rating trend (per 5 reviews)</div>
              <div style={styles.sparkline}>
                {ratingChunks.map((val, i) => (
                  <div key={i} style={styles.sparkCol}>
                    <div style={{ ...styles.sparkBar, height: `${(val / 5) * 80}px`, background: val >= 4 ? '#27ae60' : val >= 3 ? '#f39c12' : '#e74c3c' }} />
                    <div style={styles.sparkVal}>{val}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={styles.empty}>Not enough reviews for trend data yet.</div>
          )}

          <div style={styles.trendLabel}>Rating distribution</div>
          {[5, 4, 3, 2, 1].map(s => {
            const count = reviews.filter(r => r.rating === s).length;
            const pct = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
            return (
              <div key={s} style={styles.distRow}>
                <span style={styles.distLabel}>{s}★</span>
                <div style={styles.distBar}><div style={{ ...styles.distFill, width: `${pct}%` }} /></div>
                <span style={styles.distCount}>{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'reviews' && (
        <div style={styles.reviewList}>
          {recentReviews.length === 0 && <div style={styles.empty}>No reviews yet.</div>}
          {recentReviews.map((r, i) => (
            <div key={i} style={styles.reviewCard}>
              <div style={styles.reviewTop}>
                <span>{'⭐'.repeat(r.rating)}</span>
                <span style={styles.reviewMeta}>
                  {r.tipAmount > 0 ? `$${r.tipAmount.toFixed(2)} tip` : 'No tip'} · {new Date(r.date).toLocaleDateString()}
                </span>
              </div>
              {r.comment && <div style={styles.reviewComment}>"{r.comment}"</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={styles.statBox}>
      <div style={styles.statNum}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const styles = {
  wrap: { padding: 16, fontFamily: 'system-ui, sans-serif' },
  heading: { margin: '0 0 16px', fontSize: 20, fontWeight: 700 },
  back: { background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#1a1a1a', padding: '0 0 16px', fontWeight: 600 },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { background: '#fff', border: '1px solid #eee', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' },
  avatar: { width: 44, height: 44, borderRadius: 22, background: '#1a1a1a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, flexShrink: 0 },
  avatarLarge: { width: 72, height: 72, borderRadius: 36, background: '#1a1a1a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800, margin: '0 auto 12px' },
  info: { flex: 1 },
  name: { fontWeight: 700, fontSize: 16, marginBottom: 2 },
  meta: { fontSize: 12, color: '#888' },
  arrow: { fontSize: 20, color: '#ccc' },
  profileHeader: { textAlign: 'center', padding: '20px 0', marginBottom: 16 },
  profileName: { fontSize: 22, fontWeight: 800 },
  profileMeta: { fontSize: 13, color: '#888', marginTop: 4 },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 },
  statBox: { background: '#f8f8f8', borderRadius: 12, padding: '12px 8px', textAlign: 'center' },
  statNum: { fontSize: 18, fontWeight: 800 },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  tabs: { display: 'flex', gap: 8, marginBottom: 16 },
  tab: { flex: 1, padding: 10, border: '1px solid #ddd', borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: 14 },
  tabActive: { flex: 1, padding: 10, border: 'none', borderRadius: 10, background: '#1a1a1a', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  trendWrap: { padding: '8px 0' },
  trendLabel: { fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 16 },
  sparkline: { display: 'flex', alignItems: 'flex-end', gap: 6, height: 96, marginBottom: 8 },
  sparkCol: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  sparkBar: { width: '100%', borderRadius: '4px 4px 0 0', minHeight: 4, transition: 'height 0.3s' },
  sparkVal: { fontSize: 11, color: '#555' },
  distRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 },
  distLabel: { fontSize: 13, width: 28, color: '#555' },
  distBar: { flex: 1, height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' },
  distFill: { height: '100%', background: '#f4c542', borderRadius: 4 },
  distCount: { fontSize: 12, color: '#888', width: 24, textAlign: 'right' },
  reviewList: { display: 'flex', flexDirection: 'column', gap: 10 },
  reviewCard: { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 12 },
  reviewTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reviewMeta: { fontSize: 12, color: '#aaa' },
  reviewComment: { fontSize: 14, color: '#444', fontStyle: 'italic' },
  empty: { textAlign: 'center', color: '#bbb', padding: 32, lineHeight: 1.6 },
};
