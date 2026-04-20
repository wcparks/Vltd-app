// ============================================================
// FILE: src/ReviewsPage.js
// PURPOSE: Public /reviews page — customer ratings + comments
//          Manager sees names, public sees anonymous stars only
// ADD TO ROUTER: <Route path="/reviews" element={<ReviewsPage />} />
// PASS isManager={true} when rendering in manager dashboard
// ============================================================

import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
} from "firebase/firestore";

export default function ReviewsPage({ isManager = false }) {
  const [reviews, setReviews] = useState([]);
  const [valets, setValets] = useState([]);
  const [filterValet, setFilterValet] = useState("all");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadReviews();
  }, []);

  async function loadReviews() {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "reviews"),
          where("rating", ">", 0),
          orderBy("rating", "desc"),
          orderBy("createdAt", "desc")
        )
      );
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setReviews(data);

      // Extract unique valets
      const valetNames = [...new Set(data.map((r) => r.valetName).filter(Boolean))];
      setValets(valetNames);

      // Calculate stats
      const total = data.length;
      const avgRating = total > 0
        ? data.reduce((sum, r) => sum + (r.rating || 0), 0) / total
        : 0;
      const fiveStar = data.filter((r) => r.rating === 5).length;
      setStats({ total, avgRating, fiveStar });
    } catch (err) {
      console.error("Error loading reviews:", err);
    }
    setLoading(false);
  }

  const filtered = filterValet === "all"
    ? reviews
    : reviews.filter((r) => r.valetName === filterValet);

  if (loading) {
    return (
      <div style={styles.page}>
        <p style={styles.muted}>Loading reviews...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* HEADER */}
      <div style={styles.header}>
        {!isManager && <span style={styles.logo}>VLTD</span>}
        <h1 style={styles.title}>
          {isManager ? "📊 All Reviews" : "⭐ Customer Reviews"}
        </h1>
        {!isManager && (
          <p style={styles.subtitle}>
            Real ratings from real customers — unfiltered
          </p>
        )}
      </div>

      {/* STATS BAR */}
      {stats && (
        <div style={styles.statsBar}>
          <StatPill
            icon="⭐"
            label="Average Rating"
            value={`${stats.avgRating.toFixed(1)} / 5`}
            accent
          />
          <StatPill
            icon="💬"
            label="Total Reviews"
            value={stats.total}
          />
          <StatPill
            icon="🏆"
            label="5-Star Reviews"
            value={stats.fiveStar}
          />
        </div>
      )}

      {/* RATING BREAKDOWN */}
      {stats && (
        <div style={styles.ratingBreakdown}>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = reviews.filter((r) => r.rating === star).length;
            const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
            return (
              <div key={star} style={styles.ratingRow}>
                <span style={styles.starLabel}>{"★".repeat(star)}</span>
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
                <span style={styles.ratingCount}>{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* VALET FILTER */}
      {valets.length > 1 && (
        <div style={styles.filterRow}>
          <button
            style={{
              ...styles.filterBtn,
              background: filterValet === "all" ? "#2563eb" : "#1e293b",
            }}
            onClick={() => setFilterValet("all")}
          >
            All Valets
          </button>
          {valets.map((v) => (
            <button
              key={v}
              style={{
                ...styles.filterBtn,
                background: filterValet === v ? "#2563eb" : "#1e293b",
              }}
              onClick={() => setFilterValet(v)}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {/* REVIEWS LIST */}
      <div style={styles.reviewsList}>
        {filtered.length === 0 && (
          <p style={styles.muted}>No reviews yet.</p>
        )}
        {filtered.map((review) => (
          <ReviewCard key={review.id} review={review} isManager={isManager} />
        ))}
      </div>

      {!isManager && (
        <div style={styles.footer}>
          <a href="/" style={styles.link}>← Back to App</a>
        </div>
      )}
    </div>
  );
}

function ReviewCard({ review, isManager }) {
  const stars = review.rating || 0;
  const date = review.createdAt?.toDate
    ? review.createdAt.toDate().toLocaleDateString()
    : review.createdAtISO
    ? new Date(review.createdAtISO).toLocaleDateString()
    : "";

  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        <div>
          <span style={styles.stars}>
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} style={{ color: i < stars ? "#f59e0b" : "#334155" }}>
                ★
              </span>
            ))}
          </span>
          {isManager && review.customerName && (
            <span style={styles.customerName}>{review.customerName}</span>
          )}
          {!isManager && (
            <span style={styles.customerName}>Verified Customer</span>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          {review.valetName && (
            <span style={styles.valetTag}>👤 {review.valetName}</span>
          )}
          {date && <span style={styles.dateTag}>{date}</span>}
        </div>
      </div>

      {review.comment && (
        <p style={styles.comment}>"{review.comment}"</p>
      )}

      {review.tipAmount && isManager && (
        <span style={styles.tipTag}>💵 Tip: ${review.tipAmount}</span>
      )}

      {review.vehicleInfo && (
        <span style={styles.vehicleTag}>🚗 {review.vehicleInfo}</span>
      )}
    </div>
  );
}

function StatPill({ icon, label, value, accent }) {
  return (
    <div style={styles.statPill}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span
        style={{
          ...styles.statValue,
          color: accent ? "#fbbf24" : "#f1f5f9",
          fontSize: accent ? 28 : 22,
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
    padding: "32px 16px",
    fontFamily: "system-ui, sans-serif",
    color: "#f1f5f9",
    maxWidth: 700,
    margin: "0 auto",
  },
  header: { textAlign: "center", marginBottom: 32 },
  logo: {
    fontSize: 11,
    fontFamily: "monospace",
    letterSpacing: 6,
    color: "#64748b",
    display: "block",
    marginBottom: 8,
  },
  title: { fontSize: 28, fontWeight: 700, margin: "0 0 8px", color: "#f1f5f9" },
  subtitle: { color: "#64748b", fontSize: 15, margin: 0 },
  statsBar: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    marginBottom: 24,
    flexWrap: "wrap",
  },
  statPill: {
    background: "#1e293b",
    borderRadius: 12,
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    minWidth: 110,
  },
  statValue: { fontWeight: 700, lineHeight: 1 },
  statLabel: { color: "#64748b", fontSize: 11, textAlign: "center" },
  ratingBreakdown: {
    background: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  ratingRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  starLabel: { color: "#f59e0b", fontSize: 13, minWidth: 60 },
  barBg: {
    flex: 1,
    background: "#0f172a",
    borderRadius: 4,
    height: 8,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 4, transition: "width 0.5s ease" },
  ratingCount: { color: "#64748b", fontSize: 13, minWidth: 20, textAlign: "right" },
  filterRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 20,
  },
  filterBtn: {
    border: "none",
    borderRadius: 20,
    padding: "8px 14px",
    fontSize: 13,
    color: "#fff",
    cursor: "pointer",
    fontWeight: 500,
  },
  reviewsList: { display: "flex", flexDirection: "column", gap: 12 },
  card: {
    background: "#1e293b",
    borderRadius: 12,
    padding: 16,
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    flexWrap: "wrap",
    gap: 8,
  },
  stars: { fontSize: 20, letterSpacing: 2 },
  customerName: {
    display: "block",
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 2,
  },
  valetTag: { display: "block", color: "#60a5fa", fontSize: 12 },
  dateTag: { display: "block", color: "#475569", fontSize: 11, marginTop: 2 },
  comment: {
    color: "#e2e8f0",
    fontSize: 15,
    lineHeight: 1.6,
    fontStyle: "italic",
    margin: "0 0 8px",
  },
  tipTag: {
    display: "inline-block",
    background: "#14532d",
    color: "#86efac",
    borderRadius: 6,
    padding: "2px 8px",
    fontSize: 12,
    marginRight: 6,
  },
  vehicleTag: {
    display: "inline-block",
    background: "#1e3a5f",
    color: "#93c5fd",
    borderRadius: 6,
    padding: "2px 8px",
    fontSize: 12,
  },
  footer: { textAlign: "center", marginTop: 40 },
  link: { color: "#3b82f6", textDecoration: "none", fontSize: 14 },
  muted: { color: "#64748b", fontSize: 14 },
};
