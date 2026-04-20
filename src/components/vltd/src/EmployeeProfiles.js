// ============================================================
// FILE: src/EmployeeProfiles.js
// PURPOSE: Full valet profiles with performance tracking,
//          rating trends, tips, cars parked, retrieval log
// USAGE: <EmployeeProfiles /> in manager view
//        <ValetProfile valetName="John" /> for single valet
// ============================================================

import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";

// ── MANAGER: All Employees Overview ──────────────────────
export default function EmployeeProfiles() {
  const [valets, setValets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllValets();
  }, []);

  async function loadAllValets() {
    setLoading(true);
    try {
      // Get all tickets to extract valet names + build profiles
      const snap = await getDocs(
        query(collection(db, "tickets"), orderBy("createdAt", "desc"))
      );
      const tickets = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Get all reviews
      const revSnap = await getDocs(collection(db, "reviews"));
      const reviews = revSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Build profile per valet name
      const profileMap = {};

      tickets.forEach((t) => {
        const name = t.valetName || t.createdBy || "Unknown";
        if (!profileMap[name]) {
          profileMap[name] = {
            name,
            carsParked: 0,
            carsRetrieved: 0,
            totalTips: 0,
            tipCount: 0,
            ratings: [],
            events: new Set(),
            recentActivity: [],
          };
        }
        profileMap[name].carsParked++;
        if (t.status === "retrieved" || t.status === "delivered") {
          profileMap[name].carsRetrieved++;
        }
        if (t.tipAmount) {
          profileMap[name].totalTips += parseFloat(t.tipAmount) || 0;
          profileMap[name].tipCount++;
        }
        if (t.eventId) profileMap[name].events.add(t.eventId);
        if (t.eventName) profileMap[name].events.add(t.eventName);
        profileMap[name].recentActivity.push(t);
      });

      reviews.forEach((r) => {
        const name = r.valetName;
        if (name && profileMap[name]) {
          profileMap[name].ratings.push(r.rating || 0);
        }
      });

      const profiles = Object.values(profileMap).map((p) => ({
        ...p,
        avgRating:
          p.ratings.length > 0
            ? p.ratings.reduce((a, b) => a + b, 0) / p.ratings.length
            : null,
        avgTip: p.tipCount > 0 ? p.totalTips / p.tipCount : 0,
        eventCount: p.events.size,
        events: [...p.events],
      }));

      // Sort by most cars parked
      profiles.sort((a, b) => b.carsParked - a.carsParked);
      setValets(profiles);
    } catch (err) {
      console.error("Error loading employees:", err);
    }
    setLoading(false);
  }

  if (selected) {
    return (
      <ValetProfileDetail
        profile={selected}
        onBack={() => setSelected(null)}
      />
    );
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <p style={styles.muted}>Loading employee profiles...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>👥 Employee Profiles</h1>
      <p style={styles.muted}>{valets.length} valets · Manager view only</p>

      {valets.length === 0 && (
        <p style={styles.muted}>No tickets yet — profiles will appear after first shift.</p>
      )}

      {valets.map((valet) => (
        <div
          key={valet.name}
          style={styles.card}
          onClick={() => setSelected(valet)}
        >
          <div style={styles.cardRow}>
            <div style={styles.avatar}>
              {valet.name.charAt(0).toUpperCase()}
            </div>
            <div style={styles.cardInfo}>
              <strong style={styles.valetName}>{valet.name}</strong>
              <div style={styles.miniStats}>
                <span>🚗 {valet.carsParked} parked</span>
                <span>✅ {valet.carsRetrieved} retrieved</span>
                {valet.avgRating && (
                  <span>⭐ {valet.avgRating.toFixed(1)}</span>
                )}
                <span>💵 ${valet.totalTips.toFixed(2)}</span>
              </div>
            </div>
            <div style={styles.arrow}>›</div>
          </div>

          {/* Mini rating bar */}
          {valet.avgRating && (
            <div style={styles.miniBar}>
              <div
                style={{
                  ...styles.miniBarFill,
                  width: `${(valet.avgRating / 5) * 100}%`,
                  background:
                    valet.avgRating >= 4
                      ? "#22c55e"
                      : valet.avgRating >= 3
                      ? "#f59e0b"
                      : "#ef4444",
                }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── SINGLE VALET DETAIL VIEW ──────────────────────────────
function ValetProfileDetail({ profile, onBack }) {
  const [activeTab, setActiveTab] = useState("overview");

  const recentTickets = (profile.recentActivity || [])
    .sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    })
    .slice(0, 20);

  return (
    <div style={styles.page}>
      {/* HEADER */}
      <button style={styles.backBtn} onClick={onBack}>
        ← Back
      </button>

      <div style={styles.profileHeader}>
        <div style={{ ...styles.avatar, width: 64, height: 64, fontSize: 28, margin: "0 auto 12px" }}>
          {profile.name.charAt(0).toUpperCase()}
        </div>
        <h2 style={styles.profileName}>{profile.name}</h2>
        {profile.avgRating && (
          <div style={styles.ratingDisplay}>
            <span style={styles.ratingBig}>{profile.avgRating.toFixed(1)}</span>
            <span style={styles.stars}>
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  style={{
                    color: i < Math.round(profile.avgRating) ? "#f59e0b" : "#334155",
                    fontSize: 20,
                  }}
                >
                  ★
                </span>
              ))}
            </span>
            <span style={styles.muted}>{profile.ratings.length} reviews</span>
          </div>
        )}
      </div>

      {/* STATS GRID */}
      <div style={styles.statsGrid}>
        <StatCard label="Cars Parked" value={profile.carsParked} icon="🚗" />
        <StatCard label="Retrieved" value={profile.carsRetrieved} icon="✅" />
        <StatCard label="Total Tips" value={`$${profile.totalTips.toFixed(2)}`} icon="💵" accent />
        <StatCard label="Avg Tip" value={`$${profile.avgTip.toFixed(2)}`} icon="💰" />
        <StatCard label="Events" value={profile.eventCount} icon="📍" />
        <StatCard
          label="Avg Rating"
          value={profile.avgRating ? profile.avgRating.toFixed(1) : "—"}
          icon="⭐"
        />
      </div>

      {/* TABS */}
      <div style={styles.tabs}>
        {["overview", "tickets", "reviews"].map((tab) => (
          <button
            key={tab}
            style={{
              ...styles.tab,
              background: activeTab === tab ? "#2563eb" : "#1e293b",
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      {activeTab === "overview" && (
        <div>
          <h3 style={styles.sectionTitle}>Rating Distribution</h3>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = profile.ratings.filter((r) => r === star).length;
            const pct =
              profile.ratings.length > 0
                ? (count / profile.ratings.length) * 100
                : 0;
            return (
              <div key={star} style={styles.ratingRow}>
                <span style={{ color: "#f59e0b", minWidth: 60, fontSize: 13 }}>
                  {"★".repeat(star)}
                </span>
                <div style={styles.barBg}>
                  <div
                    style={{
                      ...styles.barFill,
                      width: `${pct}%`,
                      background:
                        star >= 4 ? "#22c55e" : star === 3 ? "#f59e0b" : "#ef4444",
                    }}
                  />
                </div>
                <span style={{ color: "#64748b", fontSize: 13, minWidth: 20 }}>
                  {count}
                </span>
              </div>
            );
          })}

          <h3 style={styles.sectionTitle}>Events Worked</h3>
          {profile.events.length === 0 && (
            <p style={styles.muted}>No events recorded yet.</p>
          )}
          {profile.events.map((ev, i) => (
            <div key={i} style={styles.eventTag}>
              📍 {ev}
            </div>
          ))}
        </div>
      )}

      {activeTab === "tickets" && (
        <div>
          <h3 style={styles.sectionTitle}>Recent Tickets ({recentTickets.length})</h3>
          {recentTickets.map((t) => (
            <div key={t.id} style={styles.ticketRow}>
              <div>
                <span style={styles.ticketNum}>#{t.ticketNumber}</span>
                <span style={styles.ticketCar}>
                  {t.color} {t.make} {t.model}
                </span>
                <span style={styles.ticketPlate}>{t.plate}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    color:
                      t.status === "retrieved" ? "#22c55e" : "#94a3b8",
                    fontSize: 12,
                  }}
                >
                  {t.status}
                </span>
                {t.tipAmount && (
                  <span style={{ display: "block", color: "#22c55e", fontSize: 12 }}>
                    ${t.tipAmount} tip
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "reviews" && (
        <div>
          <h3 style={styles.sectionTitle}>Customer Reviews</h3>
          {profile.ratings.length === 0 && (
            <p style={styles.muted}>No reviews yet.</p>
          )}
          {/* Reviews with comments are in the reviews collection */}
          <p style={styles.muted}>
            {profile.ratings.length} total ratings · Average {profile.avgRating?.toFixed(1) || "—"} stars
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, accent }) {
  return (
    <div style={styles.statCard}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: accent ? "#22c55e" : "#f1f5f9",
        }}
      >
        {value}
      </span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  );
}

const styles = {
  page: {
    background: "#0f172a",
    minHeight: "100vh",
    padding: 16,
    fontFamily: "system-ui, sans-serif",
    color: "#f1f5f9",
  },
  heading: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  muted: { color: "#64748b", fontSize: 13, margin: "4px 0" },
  card: {
    background: "#1e293b",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    cursor: "pointer",
    transition: "transform 0.1s",
  },
  cardRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 8 },
  avatar: {
    width: 44,
    height: 44,
    background: "#2563eb",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 700,
    color: "#fff",
    flexShrink: 0,
  },
  cardInfo: { flex: 1 },
  valetName: { display: "block", fontSize: 16, color: "#f1f5f9" },
  miniStats: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 4,
  },
  arrow: { color: "#475569", fontSize: 24 },
  miniBar: { background: "#0f172a", borderRadius: 4, height: 4, overflow: "hidden" },
  miniBarFill: { height: "100%", borderRadius: 4 },
  backBtn: {
    background: "transparent",
    color: "#94a3b8",
    border: "none",
    fontSize: 15,
    cursor: "pointer",
    padding: "8px 0",
    marginBottom: 16,
  },
  profileHeader: { textAlign: "center", marginBottom: 24 },
  profileName: { fontSize: 24, fontWeight: 700, margin: "0 0 8px", color: "#f1f5f9" },
  ratingDisplay: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  ratingBig: { fontSize: 36, fontWeight: 700, color: "#fbbf24" },
  stars: { letterSpacing: 2 },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    background: "#1e293b",
    borderRadius: 10,
    padding: "14px 10px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  statLabel: { color: "#64748b", fontSize: 11, textAlign: "center" },
  tabs: { display: "flex", gap: 8, marginBottom: 20 },
  tab: {
    flex: 1,
    border: "none",
    borderRadius: 8,
    padding: "10px 0",
    fontSize: 14,
    color: "#fff",
    cursor: "pointer",
    fontWeight: 500,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "#94a3b8",
    marginBottom: 12,
    marginTop: 8,
  },
  ratingRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 6 },
  barBg: { flex: 1, background: "#1e293b", borderRadius: 4, height: 8, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4 },
  eventTag: {
    background: "#1e3a5f",
    color: "#93c5fd",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 13,
    marginBottom: 6,
    display: "inline-block",
    marginRight: 6,
  },
  ticketRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#1e293b",
    borderRadius: 8,
    padding: "10px 12px",
    marginBottom: 8,
  },
  ticketNum: { display: "block", fontWeight: 700, fontSize: 16 },
  ticketCar: { display: "block", color: "#94a3b8", fontSize: 12 },
  ticketPlate: {
    fontFamily: "monospace",
    color: "#fbbf24",
    fontSize: 12,
    display: "block",
  },
};
