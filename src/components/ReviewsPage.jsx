// ============================================================
// ReviewsPage.jsx -- Public reviews showcase + manager view
// Place at: src/components/ReviewsPage.jsx
//
// Add route in App.js:
//   import ReviewsPage from './components/ReviewsPage';
//   // In your router or conditional render:
//   if (path === '/reviews') return <ReviewsPage isManager={role === 'manager'} />;
//
// Or use React Router:
//   <Route path="/reviews" element={<ReviewsPage isManager={role==='manager'} />} />
// ============================================================
import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot, where, deleteDoc, doc } from 'firebase/firestore';

const STARS = [5, 4, 3, 2, 1];

export default function ReviewsPage({ isManager = false }) {
  const [reviews, setReviews] = useState([]);
  const [filterValet, setFilterValet] = useState('all');
  const [filterStars, setFilterStars] = useState(0);
  const [valets, setValets] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setReviews(list);
      const names = [...new Set(list.map(r => r.valetName).filter(Boolean))];
      setValets(names);
    });
    return unsub;
  }, []);

  async function deleteReview(id) {
    if (!window.confirm('Delete this review?')) return;
    await deleteDoc(doc(db, 'reviews', id));
  }

  const filtered = reviews.filter(r => {
    if (filterValet !== 'all' && r.valetName !== filterValet) return false;
    if (filterStars > 0 && r.rating !== filterStars) return false;
    return true;
  });

  const avgRating = filtered.length
    ? (filtered.reduce((s, r) => s + (r.rating || 0), 0) / filtered.length).toFixed(1)
    : '--';

  const ratingDist = STARS.map(s => ({
    stars: s,
    count: filtered.filter(r => r.rating === s).length,
    pct: filtered.length ? Math.round((filtered.filter(r => r.rating === s).length / filtered.length) * 100) : 0,
  }));

  return (
    <div style={styles.page}>
      {/* Hero */}
      <div style={styles.hero}>
        <div style={styles.heroLogo}>VLTD</div>
        <div style={styles.heroRating}>{avgRating}</div>
        <div style={styles.heroStars}>{'?'.repeat(Math.round(parseFloat(avgRating) || 0))}</div>
        <div style={styles.heroCount}>{filtered.length} review{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Rating distribution */}
      <div style={styles.distWrap}>
        {ratingDist.map(d => (
          <div key={d.stars} style={styles.distRow}>
            <span style={styles.distLabel}>{d.stars}?</span>
            <div style={styles.distBar}>
              <div style={{ ...styles.distFill, width: `${d.pct}%` }} />
            </div>
            <span style={styles.distCount}>{d.count}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <select style={styles.select} value={filterValet} onChange={e => setFilterValet(e.target.value)}>
          <option value="all">All Valets</option>
          {valets.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select style={styles.select} value={filterStars} onChange={e => setFilterStars(Number(e.target.value))}>
          <option value={0}>All Ratings</option>
          {STARS.map(s => <option key={s} value={s}>{s} Stars</option>)}
        </select>
      </div>

      {/* Review cards */}
      <div style={styles.reviewList}>
        {filtered.map(review => (
          <div key={review.id} style={styles.card}>
            <div style={styles.cardTop}>
              <div>
                <div style={styles.cardStars}>{'?'.repeat(review.rating || 0)}</div>
                {/* Manager sees names, public sees anonymous */}
                <div style={styles.cardAuthor}>
                  {isManager ? (review.customerName || 'Anonymous') : 'Verified Customer'}
                  {review.valetName && <span style={styles.cardValet}> - {review.valetName}</span>}
                </div>
              </div>
              <div style={styles.cardMeta}>
                {review.createdAt?.toDate
                  ? review.createdAt.toDate().toLocaleDateString()
                  : new Date(review.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString()}
                {isManager && (
                  <button style={styles.deleteBtn} onClick={() => deleteReview(review.id)}>?</button>
                )}
              </div>
            </div>
            {review.comment && (
              <div style={styles.cardComment}>"{review.comment}"</div>
            )}
            {review.tipAmount > 0 && isManager && (
              <div style={styles.tipChip}>${parseFloat(review.tipAmount).toFixed(2)} tip</div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={styles.empty}>No reviews yet. They'll show up here after customers rate their experience.</div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f8f8f8', fontFamily: 'system-ui, sans-serif', maxWidth: 600, margin: '0 auto' },
  hero: { background: '#1a1a1a', color: '#fff', padding: '40px 24px', textAlign: 'center' },
  heroLogo: { fontSize: 14, letterSpacing: 6, color: '#888', marginBottom: 16 },
  heroRating: { fontSize: 72, fontWeight: 900, lineHeight: 1, marginBottom: 8 },
  heroStars: { fontSize: 28, marginBottom: 8 },
  heroCount: { fontSize: 14, color: '#888' },
  distWrap: { background: '#fff', padding: '16px 24px', borderBottom: '1px solid #eee' },
  distRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 },
  distLabel: { fontSize: 13, width: 28, color: '#888' },
  distBar: { flex: 1, height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' },
  distFill: { height: '100%', background: '#f4c542', borderRadius: 4, transition: 'width 0.3s' },
  distCount: { fontSize: 12, color: '#888', width: 24, textAlign: 'right' },
  filters: { padding: '12px 16px', display: 'flex', gap: 10, background: '#fff', borderBottom: '1px solid #eee' },
  select: { flex: 1, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, background: '#fff' },
  reviewList: { padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
  card: { background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardStars: { fontSize: 18, marginBottom: 4 },
  cardAuthor: { fontWeight: 600, fontSize: 14 },
  cardValet: { fontWeight: 400, color: '#888' },
  cardMeta: { fontSize: 12, color: '#aaa', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 },
  deleteBtn: { background: '#fee', color: '#c00', border: 'none', borderRadius: 6, padding: '2px 6px', fontSize: 11, cursor: 'pointer' },
  cardComment: { fontSize: 15, color: '#333', lineHeight: 1.5, fontStyle: 'italic' },
  tipChip: { display: 'inline-block', marginTop: 8, background: '#fff3cd', color: '#856404', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  empty: { textAlign: 'center', color: '#bbb', padding: 48, lineHeight: 1.6 },
};
