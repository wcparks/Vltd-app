import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

const ACCENT = '#C8F04B';
const CARD = '#161616';
const BORDER = '#2a2a2a';

function today() { return new Date().toISOString().slice(0, 10); }

export default function ManagerDashboard({ tickets = [], todayTickets = [] }) {
  const [clockEvents, setClockEvents] = useState([]);
  const [allTickets, setAllTickets] = useState([]);
  const [range, setRange] = useState('today');

  useEffect(() => {
    // Load all tickets for history
    const unsub = onSnapshot(
      query(collection(db, 'tickets'), orderBy('time', 'desc')),
      snap => setAllTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'clockEvents'), where('date', '==', today())),
      snap => setClockEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  // Pick dataset based on range
  const rangeTickets = range === 'today' ? todayTickets
    : range === 'week' ? allTickets.filter(t => {
        const d = new Date(t.date);
        const now = new Date();
        const weekAgo = new Date(now - 7 * 24 * 3600 * 1000);
        return d >= weekAgo;
      })
    : allTickets; // all time

  // Peak hours ? bucket tickets by hour
  const hourBuckets = Array(24).fill(0);
  rangeTickets.forEach(t => {
    if (t.time?.toDate) {
      const hour = t.time.toDate().getHours();
      hourBuckets[hour]++;
    }
  });
  const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));
  const maxBucket = Math.max(...hourBuckets, 1);

  // Show only hours 10am-2am (valet relevant)
  const relevantHours = [...Array(16).keys()].map(i => (i + 10) % 24);

  // Revenue / tips
  const totalTips = rangeTickets.reduce((s, t) => s + (t.tip || 0), 0);
  const ratedTickets = rangeTickets.filter(t => t.rating > 0);
  const avgRating = ratedTickets.length
    ? (ratedTickets.reduce((s, t) => s + t.rating, 0) / ratedTickets.length).toFixed(1)
    : '--';

  // Per valet breakdown
  const valetNames = [...new Set(rangeTickets.map(t => t.createdBy).filter(Boolean))];
  const valetStats = valetNames.map(name => {
    const vt = rangeTickets.filter(t => t.createdBy === name);
    const tips = vt.reduce((s, t) => s + (t.tip || 0), 0);
    const rated = vt.filter(t => t.rating > 0);
    const avg = rated.length ? (rated.reduce((s, t) => s + t.rating, 0) / rated.length).toFixed(1) : '--';
    return { name, count: vt.length, tips, avg };
  }).sort((a, b) => b.count - a.count);

  // Hours worked today
  const hoursWorked = {};
  const clockIns = {};
  clockEvents.filter(e => e.type === 'in').forEach(e => { clockIns[e.name] = e; });
  clockEvents.filter(e => e.type === 'out').forEach(e => {
    if (clockIns[e.name] && e.hoursWorked) {
      hoursWorked[e.name] = (hoursWorked[e.name] || 0) + e.hoursWorked;
    }
  });

  // Daily revenue chart (last 7 days)
  const last7 = Array(7).fill(0).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const dailyTips = last7.map(date =>
    allTickets.filter(t => t.date === date).reduce((s, t) => s + (t.tip || 0), 0)
  );
  const maxDaily = Math.max(...dailyTips, 1);

  return (
    <div style={{ color: '#fff', fontFamily: "'DM Mono', monospace" }}>

      {/* Range selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['today', 'Today'], ['week', '7 Days'], ['all', 'All Time']].map(([key, label]) => (
          <button key={key} onClick={() => setRange(key)} style={{ flex: 1, padding: '9px', background: range === key ? ACCENT : 'transparent', color: range === key ? '#000' : '#666', border: `1px solid ${range === key ? ACCENT : BORDER}`, borderRadius: 8, fontSize: 10, fontWeight: range === key ? 700 : 400, cursor: 'pointer', letterSpacing: 1 }}>
            {label}
          </button>
        ))}
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'CARS', value: rangeTickets.length },
          { label: 'TIPS', value: `$${totalTips.toFixed(0)}` },
          { label: 'RATING', value: avgRating === '--' ? '--' : `${avgRating}/5` },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontFamily: 'sans-serif', fontWeight: 900, color: ACCENT }}>{value}</div>
            <div style={{ fontSize: 8, color: '#888', letterSpacing: '1.5px', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Peak hours chart */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: '#888', letterSpacing: '2px', marginBottom: 12 }}>PEAK HOURS</div>
        {rangeTickets.length === 0 ? (
          <div style={{ color: '#777', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>No data yet.</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 64, marginBottom: 6 }}>
              {relevantHours.map(h => {
                const count = hourBuckets[h];
                const height = Math.max((count / maxBucket) * 56, count > 0 ? 4 : 0);
                const isPeak = h === peakHour && count > 0;
                return (
                  <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <div style={{ width: '100%', height: `${height}px`, background: isPeak ? ACCENT : '#2a2a2a', borderRadius: '3px 3px 0 0', transition: 'height 0.3s' }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {relevantHours.map(h => (
                <div key={h} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: h === peakHour && hourBuckets[h] > 0 ? ACCENT : '#444' }}>
                  {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
                </div>
              ))}
            </div>
            {hourBuckets[peakHour] > 0 && (
              <div style={{ fontSize: 10, color: ACCENT, marginTop: 8, textAlign: 'center' }}>
                Peak: {peakHour === 0 ? '12am' : peakHour < 12 ? `${peakHour}am` : peakHour === 12 ? '12pm' : `${peakHour - 12}pm`} ({hourBuckets[peakHour]} cars)
              </div>
            )}
          </>
        )}
      </div>

      {/* 7-day revenue chart */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: '#888', letterSpacing: '2px', marginBottom: 12 }}>TIPS - LAST 7 DAYS</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 64, marginBottom: 6 }}>
          {dailyTips.map((amount, i) => {
            const height = Math.max((amount / maxDaily) * 56, amount > 0 ? 4 : 0);
            const isToday = i === 6;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                <div style={{ width: '100%', height: `${height}px`, background: isToday ? ACCENT : '#2a2a2a', borderRadius: '3px 3px 0 0' }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {last7.map((date, i) => {
            const d = new Date(date + 'T12:00:00');
            const isToday = i === 6;
            return (
              <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: isToday ? ACCENT : '#444' }}>
                {d.toLocaleDateString('en', { weekday: 'narrow' })}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: '#888', textAlign: 'center', marginTop: 8 }}>
          Total: ${dailyTips.reduce((s, v) => s + v, 0).toFixed(2)}
        </div>
      </div>

      {/* Valet performance */}
      {valetStats.length > 0 && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: '#888', letterSpacing: '2px', marginBottom: 12 }}>VALET PERFORMANCE</div>
          {valetStats.map((v, i) => (
            <div key={v.name} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: i === 0 ? '#FFD70022' : '#111', color: i === 0 ? '#FFD700' : '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 3 }}>{v.name}</div>
                <div style={{ height: 6, background: '#222', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(v.count / (valetStats[0]?.count || 1)) * 100}%`, background: ACCENT, borderRadius: 3 }} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontFamily: 'sans-serif', fontWeight: 900, color: ACCENT }}>{v.count}</div>
                <div style={{ fontSize: 10, color: '#888' }}>${v.tips} - {v.avg}/5</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hours worked today */}
      {Object.keys(hoursWorked).length > 0 && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 9, color: '#888', letterSpacing: '2px', marginBottom: 12 }}>HOURS WORKED TODAY</div>
          {Object.entries(hoursWorked).map(([name, hours]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 13, color: '#ccc' }}>{name}</div>
              <div style={{ fontSize: 14, fontFamily: 'sans-serif', fontWeight: 700, color: ACCENT }}>{hours.toFixed(1)}h</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
