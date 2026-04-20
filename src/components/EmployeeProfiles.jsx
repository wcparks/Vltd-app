import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, increment, getDoc } from 'firebase/firestore';

const ACCENT = '#C8F04B';

export async function upsertEmployee(name) {
  if (!name) return;
  const ref = doc(db, 'employees', name.toLowerCase().replace(/\s+/g, '_'));
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { name, totalParked: 0, totalRetrieved: 0, totalTips: 0, totalRatings: 0, ratingSum: 0, avgRating: 0, firstSeen: Date.now(), lastSeen: Date.now(), reviews: [] });
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
  const reviews = [...(data.reviews || []).slice(-49), review];
  await updateDoc(ref, { ratingSum: newSum, totalRatings: newCount, avgRating: parseFloat((newSum / newCount).toFixed(2)), totalTips: newTips, reviews });
}

export default function EmployeeProfiles() {
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('team');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'employees'), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.totalParked || 0) - (a.totalParked || 0));
      setEmployees(list);
    });
    return unsub;
  }, []);

  if (selected) return <EmployeeDetail employee={selected} onBack={() => setSelected(null)} />;

  const leaderboards = {
    cars: [...employees].sort((a, b) => (b.totalParked || 0) - (a.totalParked || 0)),
    tips: [...employees].sort((a, b) => (b.totalTips || 0) - (a.totalTips || 0)),
    rating: [...employees].filter(e => e.totalRatings > 0).sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0)),
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#fff' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['team', 'leaderboard'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '10px', background: tab === t ? ACCENT : 'transparent', color: tab === t ? '#000' : '#666', border: `1px solid ${tab === t ? ACCENT : '#2a2a2a'}`, borderRadius: 8, fontSize: 11, fontWeight: tab === t ? 700 : 400, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1 }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'team' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {employees.map(emp => (
            <div key={emp.id} onClick={() => setSelected(emp)} style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, background: '#1a1a1a', border: `1px solid ${ACCENT}44`, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, flexShrink: 0 }}>
                {emp.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginBottom: 2 }}>{emp.name}</div>
                <div style={{ fontSize: 11, color: '#999' }}>{emp.totalParked || 0} parked - {emp.totalRetrieved || 0} retrieved</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                  {emp.totalRatings > 0 ? `${emp.avgRating}/5 avg - $${(emp.totalTips || 0).toFixed(0)} tips` : 'No reviews yet'}
                </div>
              </div>
              <div style={{ fontSize: 20, color: '#777' }}>&#x203A;</div>
            </div>
          ))}
          {employees.length === 0 && <div style={{ color: '#777', fontSize: 12, textAlign: 'center', padding: 32 }}>No profiles yet. Created automatically on login.</div>}
        </div>
      )}

      {tab === 'leaderboard' && (
        <div>
          <LeaderboardSection title="CARS PARKED" employees={leaderboards.cars} valueKey="totalParked" format={v => v} unit="cars" />
          <LeaderboardSection title="TIPS EARNED" employees={leaderboards.tips} valueKey="totalTips" format={v => `$${(v || 0).toFixed(0)}`} unit="" />
          <LeaderboardSection title="TOP RATED" employees={leaderboards.rating} valueKey="avgRating" format={v => `${v}/5`} unit="" />
        </div>
      )}
    </div>
  );
}

function LeaderboardSection({ title, employees, valueKey, format }) {
  const medals = ['#FFD700', '#C0C0C0', '#CD7F32'];
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 9, color: '#888', letterSpacing: '2px', marginBottom: 10 }}>{title}</div>
      {employees.slice(0, 5).map((emp, i) => (
        <div key={emp.id} style={{ background: '#161616', border: `1px solid ${i === 0 ? '#FFD70033' : '#2a2a2a'}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: i < 3 ? medals[i] + '22' : '#111', color: i < 3 ? medals[i] : '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
            {i + 1}
          </div>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#fff' }}>{emp.name}</div>
          <div style={{ fontSize: 16, fontFamily: 'sans-serif', fontWeight: 900, color: i === 0 ? ACCENT : '#ccc' }}>{format(emp[valueKey])}</div>
        </div>
      ))}
      {employees.length === 0 && <div style={{ color: '#777', fontSize: 12, padding: '8px 0' }}>No data yet.</div>}
    </div>
  );
}

function EmployeeDetail({ employee: emp, onBack }) {
  const [tab, setTab] = useState('stats');
  const recentReviews = (emp.reviews || []).slice().reverse().slice(0, 20);
  const reviews = emp.reviews || [];
  const ratingChunks = [];
  for (let i = 0; i < reviews.length; i += 5) {
    const chunk = reviews.slice(i, i + 5);
    ratingChunks.push(parseFloat((chunk.reduce((s, r) => s + r.rating, 0) / chunk.length).toFixed(1)));
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#fff' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', color: '#888', padding: '0 0 16px', fontWeight: 600 }}>
        &larr; Back
      </button>
      <div style={{ textAlign: 'center', padding: '16px 0', marginBottom: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: 36, background: '#1a1a1a', border: `2px solid ${ACCENT}44`, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, margin: '0 auto 12px' }}>
          {emp.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{emp.name}</div>
        <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Since {emp.firstSeen ? new Date(emp.firstSeen).toLocaleDateString() : '--'}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Parked', value: emp.totalParked || 0 },
          { label: 'Retrieved', value: emp.totalRetrieved || 0 },
          { label: 'Avg Rating', value: emp.totalRatings > 0 ? `${emp.avgRating}/5` : '--' },
          { label: 'Total Tips', value: `$${(emp.totalTips || 0).toFixed(2)}` },
          { label: 'Reviews', value: emp.totalRatings || 0 },
          { label: 'Last Active', value: emp.lastSeen ? new Date(emp.lastSeen).toLocaleDateString() : '--' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>{value}</div>
            <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['stats', 'reviews'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: 10, background: tab === t ? '#1a1a1a' : 'transparent', color: tab === t ? '#fff' : '#666', border: `1px solid ${tab === t ? '#444' : '#2a2a2a'}`, borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'stats' && (
        <div>
          {ratingChunks.length > 1 ? (
            <>
              <div style={{ fontSize: 10, color: '#888', letterSpacing: '1.5px', marginBottom: 8 }}>RATING TREND</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80, marginBottom: 16 }}>
                {ratingChunks.map((val, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                    <div style={{ width: '100%', height: `${(val / 5) * 64}px`, background: val >= 4 ? '#27ae60' : val >= 3 ? '#f39c12' : '#e74c3c', borderRadius: '4px 4px 0 0', minHeight: 4 }} />
                    <div style={{ fontSize: 10, color: '#888' }}>{val}</div>
                  </div>
                ))}
              </div>
            </>
          ) : <div style={{ color: '#777', fontSize: 12, padding: '8px 0 16px' }}>Not enough reviews for trend yet.</div>}

          <div style={{ fontSize: 10, color: '#888', letterSpacing: '1.5px', marginBottom: 8 }}>RATING BREAKDOWN</div>
          {[5, 4, 3, 2, 1].map(s => {
            const count = reviews.filter(r => r.rating === s).length;
            const pct = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 12, width: 24, color: '#aaa' }}>{s}/5</span>
                <div style={{ flex: 1, height: 8, background: '#222', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#f4c542', borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 11, color: '#999', width: 20, textAlign: 'right' }}>{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'reviews' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recentReviews.length === 0 && <div style={{ color: '#777', fontSize: 12, padding: 24, textAlign: 'center' }}>No reviews yet.</div>}
          {recentReviews.map((r, i) => (
            <div key={i} style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: ACCENT, fontWeight: 700 }}>{r.rating}/5</span>
                <span style={{ fontSize: 11, color: '#888' }}>{r.tipAmount > 0 ? `$${r.tipAmount.toFixed(2)} tip` : 'No tip'} - {new Date(r.date).toLocaleDateString()}</span>
              </div>
              {r.comment && <div style={{ fontSize: 13, color: '#888', fontStyle: 'italic' }}>"{r.comment}"</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
